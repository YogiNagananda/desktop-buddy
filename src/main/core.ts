import type {
	AppSettings,
	BuddyActionId,
	DashboardSnapshot,
	MissedNotice,
	Reminder,
	ReminderCreateInput,
	ReminderUpdateInput,
	ResetFlowState,
	UpNextItem,
} from "@shared/types"
import {
	RESET_STEPS,
	SCRIPTS,
	customReminderScript,
	missedMessage,
} from "@shared/copy"
import { SettingsService } from "./services/SettingsService"
import { ReminderService, effectiveTriggerAt } from "./services/ReminderService"
import { SessionService, type SessionBoundary } from "./services/SessionService"
import { ActiveTimeService } from "./services/ActiveTimeService"
import { FocusModeService } from "./services/FocusModeService"
import { CurrentStateService, sourceForPriority } from "./services/CurrentStateService"
import { NotificationService, type NotifyRequest } from "./services/NotificationService"
import { SchedulerService } from "./services/SchedulerService"
import { MINUTE_MS, endOfLocalDay, systemTimezone } from "./services/time"
import { closeDb, logHistory, resetAllData } from "./services/db"
import {
	allWindows,
	hidePopupWindow,
	showPopupWindow,
} from "./windows"
import { updateTrayState } from "./tray"
import type { TrayHooks } from "./tray"

const UI_TICK_MS = 1000
const SNOOZE_DEFAULT_MINUTES = 10

/**
 * The orchestrator. Every feature emits a state candidate and the
 * CurrentStateService decides what the buddy is actually doing, so the
 * precedence rules in section 4 live in exactly one place.
 */
export class BuddyCore {
	readonly settings = new SettingsService()
	readonly reminders = new ReminderService()
	readonly currentState = new CurrentStateService()
	readonly session: SessionService
	readonly focus: FocusModeService
	readonly activeTime: ActiveTimeService
	readonly notifications: NotificationService
	readonly scheduler: SchedulerService

	private missed: MissedNotice[] = []
	private resetState: ResetFlowState = {
		active: false,
		step: 0,
		totalSteps: RESET_STEPS.length,
		label: null,
		stepEndsAt: null,
	}
	private resetTimer: NodeJS.Timeout | null = null
	private tickTimer: NodeJS.Timeout | null = null

	constructor() {
		const settings = this.settings.get()
		this.session = new SessionService(settings)
		this.focus = new FocusModeService((summary) => {
			this.notifications.info("Focus Mode ended", summary)
			this.pushSnapshot()
		})
		this.activeTime = new ActiveTimeService(settings, () => this.fireActiveTimeWarning())
		this.notifications = new NotificationService(settings, this.focus, (request, sticky) =>
			this.presentPopup(request, sticky),
		)
		this.scheduler = new SchedulerService(this.reminders, settings, {
			onFire: (reminder) => this.fireReminder(reminder),
			onSessionBoundary: () => this.advanceSession(),
			onMissed: (notices) => this.handleMissed(notices),
		})
	}

	start(): void {
		const settings = this.settings.get()
		this.reminders.syncBuiltIns(settings)
		this.scheduler.start()
		this.activeTime.start()
		this.scheduler.setSessionEndsAt(this.session.phaseEndsAt())
		this.tickTimer = setInterval(() => this.tick(), UI_TICK_MS)
		this.tick()
	}

	stop(): void {
		if (this.tickTimer) clearInterval(this.tickTimer)
		if (this.resetTimer) clearTimeout(this.resetTimer)
		this.tickTimer = null
		this.resetTimer = null
		this.scheduler.stop()
		this.activeTime.stop()
		closeDb()
	}

	// ---- tick / snapshot ---------------------------------------------------

	private tick(): void {
		const now = Date.now()
		this.currentState.prune(now)
		this.focus.recheck()
		this.notifications.drainGentle()

		const boundary = this.session.tick(now)
		if (boundary) this.onSessionBoundary(boundary)

		const session = this.session.get()
		this.currentState.setAmbient(session.phase === "working")
		this.currentState.setSessionTiming(
			session.phaseStartedAt === null ? null : now - session.phaseStartedAt,
			session.phaseEndsAt === null ? null : Math.max(0, session.phaseEndsAt - now),
		)
		this.currentState.setNextEvent(this.upNext(1)[0] ?? null)
		this.pushSnapshot()
	}

	snapshot(): DashboardSnapshot {
		return {
			current: this.currentState.resolve(),
			session: this.session.get(),
			focus: this.focus.state(),
			reset: this.resetState,
			upNext: this.upNext(5),
			todayTimeline: this.todayTimeline(),
			missed: this.missed,
			activeComputerMinutes: this.activeTime.activeMinutes(),
			settings: this.settings.get(),
			reminders: this.reminders.list(),
		}
	}

	pushSnapshot(): void {
		const snapshot = this.snapshot()
		for (const window of allWindows()) {
			window.webContents.send("buddy:snapshot", snapshot)
		}
		updateTrayState(
			snapshot.current.state,
			snapshot.current.title + (snapshot.current.message ? " - " + snapshot.current.message : ""),
		)
	}

	trayHooks(): TrayHooks {
		return {
			startFocus: (minutes) => this.startFocus(minutes),
			endFocus: () => this.endFocus(),
			startReset: () => this.startReset(),
			isFocusActive: () => this.focus.isActive(),
			focusDefaults: () => this.settings.get().focusDefaultMinutes,
		}
	}

	// ---- up next / timeline ------------------------------------------------

	upNext(limit: number): UpNextItem[] {
		const items: UpNextItem[] = []
		for (const reminder of this.reminders.list()) {
			const at = effectiveTriggerAt(reminder)
			if (at === null) continue
			items.push({
				id: reminder.id,
				label: reminder.title,
				at,
				kind: reminder.kind,
				priority: reminder.priority,
				buddyState: reminder.buddyState,
			})
		}
		const session = this.session.get()
		if (session.phaseEndsAt !== null) {
			items.push({
				id: "session",
				label: session.phase === "working" ? "Break starts" : "Back to work",
				at: session.phaseEndsAt,
				kind: "session",
				priority: "normal",
				buddyState: session.phase === "working" ? "break" : "working",
			})
		}
		return items.sort((a, b) => a.at - b.at).slice(0, limit)
	}

	todayTimeline(): UpNextItem[] {
		const timezone = systemTimezone()
		const endOfDay = endOfLocalDay(Date.now(), timezone)
		return this.upNext(50).filter((item) => item.at <= endOfDay)
	}

	// ---- firing ------------------------------------------------------------

	private presentPopup(request: NotifyRequest, sticky: boolean): void {
		this.currentState.emit({
			source: sourceForPriority(request.priority),
			script: request.script,
			reminderId: request.reminderId ?? null,
			expiresAt: sticky ? null : Date.now() + 2 * MINUTE_MS,
		})
		showPopupWindow(sticky, this.settings.get().allowOverFullscreen)
		this.pushSnapshot()
	}

	fireReminder(reminder: Reminder): void {
		const settings = this.settings.get()
		this.reminders.markTriggered(reminder.id)
		const script =
			reminder.kind === "water"
				? SCRIPTS.water
				: reminder.kind === "lunch"
					? SCRIPTS.lunch
					: customReminderScript(reminder.title, reminder.description, reminder.priority)

		const outcome = this.notifications.request({
			key: reminder.id,
			priority: reminder.priority,
			script,
			reminderId: reminder.id,
		})

		// Suppressed for any reason: roll the schedule forward, never queue a backlog.
		if (!outcome.shown) {
			const next = this.reminders.computeNextTriggerAt(reminder, Date.now(), settings)
			this.reminders.save({ ...reminder, snoozedUntil: null, nextTriggerAt: next })
		}
		this.scheduler.rearm()
		this.pushSnapshot()
	}

	fireActiveTimeWarning(): void {
		this.notifications.request({
			key: "active-time",
			priority: "normal",
			script: SCRIPTS.activeTime,
		})
		this.pushSnapshot()
	}

	advanceSession(): void {
		const boundary = this.session.tick()
		if (boundary) this.onSessionBoundary(boundary)
	}

	onSessionBoundary(boundary: SessionBoundary): void {
		const script =
			boundary.type === "breakStarted"
				? SCRIPTS.breakStart
				: boundary.type === "workStarted"
					? SCRIPTS.breakOver
					: SCRIPTS.workStart

		if (boundary.type === "sessionFinished") {
			logHistory("sessionFinished")
			this.currentState.celebrate("Session complete. Nicely done.")
		} else {
			this.currentState.emit({
				source: "sessionBoundary",
				script,
				expiresAt: Date.now() + 2 * MINUTE_MS,
			})
			showPopupWindow(false, this.settings.get().allowOverFullscreen)
		}
		if (boundary.type === "breakStarted") this.activeTime.reset()
		this.scheduler.setSessionEndsAt(this.session.phaseEndsAt())
		this.pushSnapshot()
	}

	handleMissed(notices: MissedNotice[]): void {
		this.missed = notices
		const first = notices[0]
		if (first) this.notifications.info("While you were away", missedMessage(first.title))
		this.pushSnapshot()
	}

	dismissMissed(reminderId: string): void {
		this.missed = this.missed.filter((notice) => notice.reminderId !== reminderId)
		this.reminders.clearMissed(reminderId)
		this.pushSnapshot()
	}

	// ---- actions -----------------------------------------------------------

	handleAction(action: BuddyActionId, reminderId?: string | null): void {
		const settings = this.settings.get()
		switch (action) {
			case "done":
				if (reminderId) {
					this.reminders.complete(reminderId, settings)
					this.notifications.release(reminderId)
					this.currentState.clearReminder(reminderId)
				}
				this.currentState.celebrate()
				hidePopupWindow()
				break
			case "gotIt":
				if (reminderId) {
					this.reminders.complete(reminderId, settings)
					this.notifications.release(reminderId)
					this.currentState.clearReminder(reminderId)
				}
				this.currentState.clear("sessionBoundary")
				hidePopupWindow()
				break
			case "snooze":
				if (reminderId) {
					this.reminders.snooze(reminderId, SNOOZE_DEFAULT_MINUTES)
					this.notifications.release(reminderId)
					this.currentState.clearReminder(reminderId)
				} else {
					this.activeTime.suppressFor(SNOOZE_DEFAULT_MINUTES)
					this.notifications.release("active-time")
					this.currentState.clear("activeTimeWarning")
					this.currentState.clear("normalReminder")
				}
				hidePopupWindow()
				break
			case "skip":
				// Skipped means skipped: this occurrence never comes back.
				if (reminderId) {
					this.reminders.skip(reminderId, settings)
					this.notifications.release(reminderId)
					this.currentState.clearReminder(reminderId)
				}
				hidePopupWindow()
				break
			case "dismiss":
				if (reminderId) {
					this.reminders.skip(reminderId, settings)
					this.notifications.release(reminderId)
					this.currentState.clearReminder(reminderId)
				}
				if (this.resetState.active) this.endReset()
				this.notifications.release("active-time")
				this.currentState.clear("activeTimeWarning")
				this.currentState.clear("sessionBoundary")
				hidePopupWindow()
				break
			case "takeBreak":
				this.notifications.release("active-time")
				this.currentState.clear("activeTimeWarning")
				this.activeTime.reset()
				this.session.startBreakNow()
				this.startReset()
				break
			case "fiveMore":
				this.activeTime.suppressFor(5)
				this.notifications.release("active-time")
				this.currentState.clear("activeTimeWarning")
				hidePopupWindow()
				break
			case "startReset":
				this.startReset()
				break
		}
		this.scheduler.rearm()
		this.pushSnapshot()
	}

	// ---- 2-minute reset ----------------------------------------------------

	startReset(): void {
		this.resetState = {
			active: true,
			step: 0,
			totalSteps: RESET_STEPS.length,
			label: RESET_STEPS[0]?.label ?? null,
			stepEndsAt: Date.now() + (RESET_STEPS[0]?.seconds ?? 40) * 1000,
		}
		this.emitResetState()
		showPopupWindow(false, this.settings.get().allowOverFullscreen)
		this.scheduleResetStep()
		this.pushSnapshot()
	}

	private scheduleResetStep(): void {
		if (this.resetTimer) clearTimeout(this.resetTimer)
		const step = RESET_STEPS[this.resetState.step]
		if (!step) return
		this.resetTimer = setTimeout(() => {
			const nextIndex = this.resetState.step + 1
			const next = RESET_STEPS[nextIndex]
			if (!next) {
				this.endReset(true)
				return
			}
			this.resetState = {
				...this.resetState,
				step: nextIndex,
				label: next.label,
				stepEndsAt: Date.now() + next.seconds * 1000,
			}
			this.emitResetState()
			this.scheduleResetStep()
			this.pushSnapshot()
		}, step.seconds * 1000)
	}

	private emitResetState(): void {
		this.currentState.emit({
			source: "reset",
			script: {
				...SCRIPTS.reset,
				message: this.resetState.label ?? undefined,
			},
		})
	}

	endReset(completed = false): void {
		if (this.resetTimer) clearTimeout(this.resetTimer)
		this.resetTimer = null
		this.resetState = {
			active: false,
			step: 0,
			totalSteps: RESET_STEPS.length,
			label: null,
			stepEndsAt: null,
		}
		this.currentState.clear("reset")
		this.activeTime.reset()
		if (completed) {
			logHistory("resetCompleted")
			this.currentState.celebrate("Reset done. Eyes and shoulders thank you.")
		} else {
			hidePopupWindow()
		}
		this.pushSnapshot()
	}

	// ---- sessions / focus / settings ---------------------------------------

	startSession(
		options:
			| { preset: "classic" | "deep" }
			| { preset: "custom"; workMinutes: number; breakMinutes: number; cycles: number },
	): void {
		this.session.start(options)
		this.scheduler.setSessionEndsAt(this.session.phaseEndsAt())
		this.currentState.emit({
			source: "sessionBoundary",
			script: SCRIPTS.workStart,
			expiresAt: Date.now() + 8000,
		})
		this.pushSnapshot()
	}

	pauseSession(): void {
		this.session.pause()
		this.scheduler.setSessionEndsAt(null)
		this.pushSnapshot()
	}

	resumeSession(): void {
		this.session.resume()
		this.scheduler.setSessionEndsAt(this.session.phaseEndsAt())
		this.pushSnapshot()
	}

	endSession(): void {
		this.session.endEarly()
		this.scheduler.setSessionEndsAt(null)
		this.currentState.clear("sessionBoundary")
		this.pushSnapshot()
	}

	startFocus(minutes: number): void {
		this.focus.start(minutes)
		hidePopupWindow()
		this.pushSnapshot()
	}

	endFocus(): void {
		this.focus.end()
		this.pushSnapshot()
	}

	updateSettings(patch: Partial<AppSettings>): AppSettings {
		const settings = this.settings.update(patch)
		this.session.setSettings(settings)
		this.activeTime.setSettings(settings)
		this.notifications.setSettings(settings)
		this.scheduler.setSettings(settings)
		this.reminders.syncBuiltIns(settings)
		this.scheduler.rearm()
		this.pushSnapshot()
		return settings
	}

	resetData(): void {
		resetAllData()
		this.missed = []
		this.reminders.syncBuiltIns(this.settings.get())
		this.scheduler.rearm()
		this.pushSnapshot()
	}

	// ---- reminder CRUD -----------------------------------------------------

	createReminder(input: ReminderCreateInput): Reminder {
		const reminder = this.reminders.create(input, this.settings.get())
		this.scheduler.rearm()
		this.pushSnapshot()
		return reminder
	}

	updateReminder(id: string, patch: ReminderUpdateInput): Reminder | null {
		const reminder = this.reminders.update(id, patch, this.settings.get())
		this.scheduler.rearm()
		this.pushSnapshot()
		return reminder
	}

	deleteReminder(id: string): void {
		this.reminders.remove(id)
		this.scheduler.rearm()
		this.pushSnapshot()
	}

	duplicateReminder(id: string): Reminder | null {
		const reminder = this.reminders.duplicate(id, this.settings.get())
		this.scheduler.rearm()
		this.pushSnapshot()
		return reminder
	}

	snoozeReminder(id: string, minutes: number): void {
		this.reminders.snooze(id, minutes)
		this.scheduler.rearm()
		this.pushSnapshot()
	}
}
