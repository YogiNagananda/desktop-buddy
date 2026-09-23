import { randomUUID } from "node:crypto"
import type { AppSettings, Reminder, ReminderCreateInput, ReminderUpdateInput } from "@shared/types"
import {
	MINUTE_MS,
	isWithinLocalWindow,
	isoDateInZone,
	nextDailyOccurrence,
	parseHhMm,
	parseIsoDate,
	safeTimezone,
	systemTimezone,
	zonedToUtcMs,
} from "./time"
import { deleteReminderRow, loadReminders, logHistory, saveReminder } from "./db"

const WATER_ID = "builtin-water"
const LUNCH_ID = "builtin-lunch"

/** A snooze wins over the scheduled time, so only one fire is ever pending. */
export function effectiveTriggerAt(reminder: Reminder): number | null {
	if (!reminder.enabled) return null
	if (reminder.snoozedUntil) return reminder.snoozedUntil
	return reminder.nextTriggerAt
}

export class ReminderService {
	private reminders = new Map<string, Reminder>()

	constructor() {
		for (const reminder of loadReminders()) this.reminders.set(reminder.id, reminder)
	}

	list(): Reminder[] {
		return [...this.reminders.values()].sort((a, b) => {
			const left = effectiveTriggerAt(a) ?? Number.MAX_SAFE_INTEGER
			const right = effectiveTriggerAt(b) ?? Number.MAX_SAFE_INTEGER
			return left - right
		})
	}

	get(id: string): Reminder | null {
		const reminder = this.reminders.get(id)
		return reminder ? { ...reminder } : null
	}

	save(reminder: Reminder): void {
		this.reminders.set(reminder.id, reminder)
		saveReminder(reminder)
	}

	create(input: ReminderCreateInput, settings: AppSettings): Reminder {
		const reminder: Reminder = {
			id: randomUUID(),
			title: input.title,
			description: input.description,
			category: input.category,
			priority: input.priority,
			localDate: input.localDate,
			localTime: input.localTime,
			timezone: systemTimezone(),
			recurrenceRule: input.recurrenceRule,
			intervalMinutes: input.intervalMinutes,
			nextTriggerAt: null,
			lastTriggeredAt: null,
			snoozedUntil: null,
			completedAt: null,
			kind: input.kind ?? "custom",
			enabled: true,
			buddyState: input.buddyState ?? "reminder",
			createdAt: Date.now(),
			missedAt: null,
		}
		reminder.nextTriggerAt = this.computeNextTriggerAt(reminder, Date.now(), settings)
		this.save(reminder)
		logHistory("created", reminder.id)
		return reminder
	}

	update(id: string, patch: ReminderUpdateInput, settings: AppSettings): Reminder | null {
		const existing = this.reminders.get(id)
		if (!existing) return null
		const next: Reminder = {
			...existing,
			...patch,
			// Re-authoring a time re-anchors it to the current timezone.
			timezone: patch.localTime ? systemTimezone() : existing.timezone,
			snoozedUntil: null,
		}
		next.nextTriggerAt = this.computeNextTriggerAt(next, Date.now(), settings)
		this.save(next)
		return next
	}

	remove(id: string): void {
		this.reminders.delete(id)
		deleteReminderRow(id)
	}

	duplicate(id: string, settings: AppSettings): Reminder | null {
		const existing = this.reminders.get(id)
		if (!existing) return null
		return this.create(
			{
				title: existing.title + " (copy)",
				description: existing.description,
				category: existing.category,
				priority: existing.priority,
				localDate: existing.localDate,
				localTime: existing.localTime,
				recurrenceRule: existing.recurrenceRule,
				intervalMinutes: existing.intervalMinutes,
				buddyState: existing.buddyState,
			},
			settings,
		)
	}

	snooze(id: string, minutes: number): void {
		const reminder = this.reminders.get(id)
		if (!reminder) return
		reminder.snoozedUntil = Date.now() + minutes * MINUTE_MS
		reminder.missedAt = null
		this.save(reminder)
		logHistory("snoozed", id)
	}

	complete(id: string, settings: AppSettings): void {
		this.advance(id, settings, "completed")
	}

	/** A skipped occurrence never re-fires; the next one is scheduled instead. */
	skip(id: string, settings: AppSettings): void {
		this.advance(id, settings, "skipped")
	}

	private advance(id: string, settings: AppSettings, event: "completed" | "skipped"): void {
		const reminder = this.reminders.get(id)
		if (!reminder) return
		reminder.snoozedUntil = null
		reminder.missedAt = null
		if (reminder.recurrenceRule === "none") {
			reminder.completedAt = Date.now()
			reminder.nextTriggerAt = null
		} else {
			reminder.nextTriggerAt = this.computeNextTriggerAt(reminder, Date.now(), settings)
		}
		this.save(reminder)
		logHistory(event, id)
	}

	clearMissed(id: string): void {
		const reminder = this.reminders.get(id)
		if (!reminder) return
		reminder.missedAt = null
		this.save(reminder)
	}

	markTriggered(id: string): void {
		const reminder = this.reminders.get(id)
		if (!reminder) return
		reminder.lastTriggeredAt = Date.now()
		reminder.snoozedUntil = null
		this.save(reminder)
		logHistory("fired", id)
	}

	/** Absolute UTC ms is always derived from stored local time plus zone. */
	computeNextTriggerAt(reminder: Reminder, from: number, settings: AppSettings): number | null {
		if (!reminder.enabled) return null
		const timezone = safeTimezone(reminder.timezone)

		if (reminder.recurrenceRule === "interval") {
			const interval = Math.max(5, reminder.intervalMinutes ?? 60)
			const candidate = from + interval * MINUTE_MS
			return reminder.kind === "water" ? this.clampToWindow(candidate, settings, timezone) : candidate
		}

		if (reminder.recurrenceRule === "daily") {
			return nextDailyOccurrence(from, reminder.localTime, timezone)
		}

		if (reminder.completedAt) return null
		const date = reminder.localDate ? parseIsoDate(reminder.localDate) : null
		const { hour, minute } = parseHhMm(reminder.localTime)
		if (date) return zonedToUtcMs({ ...date, hour, minute }, timezone)
		return nextDailyOccurrence(from, reminder.localTime, timezone)
	}

	/** Water only fires inside the configured active window (section 6.1). */
	private clampToWindow(candidate: number, settings: AppSettings, timezone: string): number {
		if (isWithinLocalWindow(candidate, settings.waterWindowStart, settings.waterWindowEnd, timezone)) {
			return candidate
		}
		return nextDailyOccurrence(candidate, settings.waterWindowStart, timezone)
	}

	/** After a timezone change, recompute every absolute trigger (section 7.5). */
	recomputeAllForTimezoneChange(settings: AppSettings): void {
		const timezone = systemTimezone()
		const now = Date.now()
		for (const reminder of this.reminders.values()) {
			if (reminder.recurrenceRule === "none" && reminder.completedAt) continue
			reminder.timezone = timezone
			reminder.nextTriggerAt = this.computeNextTriggerAt(reminder, now, settings)
			this.save(reminder)
		}
	}

	/** Keeps the two built-in reminders in step with settings. */
	syncBuiltIns(settings: AppSettings): void {
		const timezone = systemTimezone()
		const now = Date.now()
		const existingWater = this.reminders.get(WATER_ID)
		const water: Reminder = {
			id: WATER_ID,
			title: "Hydration check",
			description: "Grab some water?",
			priority: "gentle",
			localTime: settings.waterWindowStart,
			timezone,
			recurrenceRule: "interval",
			intervalMinutes: settings.waterIntervalMinutes,
			nextTriggerAt: existingWater?.nextTriggerAt ?? null,
			lastTriggeredAt: existingWater?.lastTriggeredAt ?? null,
			snoozedUntil: existingWater?.snoozedUntil ?? null,
			completedAt: null,
			kind: "water",
			enabled: settings.waterEnabled,
			buddyState: "drinking",
			createdAt: existingWater?.createdAt ?? now,
			missedAt: null,
		}
		if (!water.enabled) water.nextTriggerAt = null
		else if (water.nextTriggerAt === null || water.nextTriggerAt <= now) {
			water.nextTriggerAt = this.computeNextTriggerAt(water, now, settings)
		}
		this.save(water)

		const existingLunch = this.reminders.get(LUNCH_ID)
		const lunch: Reminder = {
			id: LUNCH_ID,
			title: "Lunch time",
			description: "Step away and eat something?",
			priority: "normal",
			localTime: settings.lunchTime,
			timezone,
			recurrenceRule: "daily",
			nextTriggerAt: null,
			lastTriggeredAt: existingLunch?.lastTriggeredAt ?? null,
			snoozedUntil: null,
			completedAt: null,
			kind: "lunch",
			enabled: settings.lunchEnabled,
			buddyState: "eating",
			createdAt: existingLunch?.createdAt ?? now,
			missedAt: null,
		}
		lunch.nextTriggerAt = lunch.enabled ? this.computeNextTriggerAt(lunch, now, settings) : null
		this.save(lunch)
	}

	todayIn(timezone: string): Reminder[] {
		const today = isoDateInZone(Date.now(), timezone)
		return this.list().filter(
			(reminder) =>
				reminder.localDate === today ||
				(reminder.nextTriggerAt !== null && isoDateInZone(reminder.nextTriggerAt, timezone) === today),
		)
	}
}
