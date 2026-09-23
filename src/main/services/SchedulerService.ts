import { powerMonitor } from "electron"
import type { AppSettings, MissedNotice, Reminder } from "@shared/types"
import { ReminderService, effectiveTriggerAt } from "./ReminderService"
import { MINUTE_MS, systemTimezone } from "./time"

/** Anything more than two minutes late counts as missed rather than due (§7.3). */
const MISSED_GRACE_MS = 2 * MINUTE_MS
const TZ_CHECK_MS = 5 * MINUTE_MS
/** Timers are re-armed at least this often so clock drift cannot strand them. */
const MAX_TIMER_MS = 10 * MINUTE_MS

type Hooks = {
	onFire: (reminder: Reminder) => void
	onSessionBoundary: () => void
	onMissed: (notices: MissedNotice[]) => void
}

/**
 * §7.2 — one timer, always armed for the single earliest due thing.
 * Absolute UTC timestamps are the source of truth, so sleep, clock changes
 * and timezone changes are all handled by recomputing rather than counting.
 */
export class SchedulerService {
	private timer: NodeJS.Timeout | null = null
	private tzTimer: NodeJS.Timeout | null = null
	private sessionEndsAt: number | null = null
	private lastTimezone = systemTimezone()
	private started = false

	constructor(
		private reminders: ReminderService,
		private settings: AppSettings,
		private hooks: Hooks,
	) {}

	setSettings(settings: AppSettings): void {
		this.settings = settings
	}

	setSessionEndsAt(at: number | null): void {
		this.sessionEndsAt = at
		this.rearm()
	}

	start(): void {
		if (this.started) return
		this.started = true
		this.handleStartupAndWake()
		this.tzTimer = setInterval(() => this.checkTimezone(), TZ_CHECK_MS)
		powerMonitor.on("resume", () => this.handleStartupAndWake())
		powerMonitor.on("unlock-screen", () => this.handleStartupAndWake())
		this.rearm()
	}

	stop(): void {
		if (this.timer) clearTimeout(this.timer)
		if (this.tzTimer) clearInterval(this.tzTimer)
		this.timer = null
		this.tzTimer = null
		this.started = false
	}

	/** The earliest absolute time the scheduler needs to wake up for. */
	nextDue(): number | null {
		let soonest: number | null = null
		for (const reminder of this.reminders.list()) {
			const at = effectiveTriggerAt(reminder)
			if (at === null) continue
			if (soonest === null || at < soonest) soonest = at
		}
		if (
			this.sessionEndsAt !== null &&
			(soonest === null || this.sessionEndsAt < soonest)
		) {
			soonest = this.sessionEndsAt
		}
		return soonest
	}

	rearm(): void {
		if (this.timer) clearTimeout(this.timer)
		this.timer = null
		if (!this.started) return
		const due = this.nextDue()
		const delay =
			due === null
				? MAX_TIMER_MS
				: Math.min(MAX_TIMER_MS, Math.max(250, due - Date.now()))
		this.timer = setTimeout(() => this.onTimer(), delay)
	}

	private onTimer(): void {
		const now = Date.now()

		if (this.sessionEndsAt !== null && now >= this.sessionEndsAt) {
			this.sessionEndsAt = null
			this.hooks.onSessionBoundary()
		}

		for (const reminder of this.reminders.list()) {
			const at = effectiveTriggerAt(reminder)
			if (at === null || at > now) continue
			this.hooks.onFire(reminder)
		}

		this.rearm()
	}

	/**
	 * §7.3 — on boot or wake: a one-off that came due while away becomes a
	 * single calm notice; a recurring one simply skips forward to its next
	 * occurrence. Nothing is replayed.
	 */
	handleStartupAndWake(): void {
		const now = Date.now()
		const notices: MissedNotice[] = []

		for (const reminder of this.reminders.list()) {
			const at = effectiveTriggerAt(reminder)
			if (at === null) continue
			if (at > now - MISSED_GRACE_MS) continue

			if (reminder.recurrenceRule === "none") {
				const updated: Reminder = {
					...reminder,
					missedAt: at,
					snoozedUntil: null,
					nextTriggerAt: null,
				}
				this.reminders.save(updated)
				notices.push({
					reminderId: reminder.id,
					title: reminder.title,
					missedAt: at,
				})
			} else {
				const updated: Reminder = { ...reminder, snoozedUntil: null }
				updated.nextTriggerAt = this.reminders.computeNextTriggerAt(
					updated,
					now,
					this.settings,
				)
				this.reminders.save(updated)
			}
		}

		if (notices.length > 0) this.hooks.onMissed(notices)
		this.checkTimezone()
		this.rearm()
	}

	/** §7.5 — a travel/DST timezone change re-anchors every absolute trigger. */
	checkTimezone(): void {
		const current = systemTimezone()
		if (current === this.lastTimezone) return
		this.lastTimezone = current
		this.reminders.recomputeAllForTimezoneChange(this.settings)
		this.rearm()
	}
}
