export const MINUTE_MS = 60_000

export function systemTimezone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
}

export function safeTimezone(timezone: string | undefined): string {
	if (!timezone) return systemTimezone()
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: timezone })
		return timezone
	} catch {
		return systemTimezone()
	}
}

export type LocalParts = {
	year: number
	month: number
	day: number
	hour: number
	minute: number
	second: number
}

const FORMATTERS = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timezone: string): Intl.DateTimeFormat {
	let formatter = FORMATTERS.get(timezone)
	if (!formatter) {
		formatter = new Intl.DateTimeFormat("en-US", {
			timeZone: timezone,
			hour12: false,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		})
		FORMATTERS.set(timezone, formatter)
	}
	return formatter
}

export function localPartsInZone(at: number, timezone: string): LocalParts {
	const parts = formatterFor(safeTimezone(timezone)).formatToParts(new Date(at))
	const lookup = (type: string) =>
		Number(parts.find((part) => part.type === type)?.value ?? "0")
	const hour = lookup("hour")
	return {
		year: lookup("year"),
		month: lookup("month"),
		day: lookup("day"),
		hour: hour === 24 ? 0 : hour,
		minute: lookup("minute"),
		second: lookup("second"),
	}
}

function offsetMsAt(at: number, timezone: string): number {
	const parts = localPartsInZone(at, timezone)
	const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
	return asUtc - at
}

/** Wall-clock time in a zone -> absolute UTC ms, two passes so DST resolves. */
export function zonedToUtcMs(
	parts: { year: number; month: number; day: number; hour: number; minute: number },
	timezone: string,
): number {
	const zone = safeTimezone(timezone)
	const naive = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0)
	let guess = naive - offsetMsAt(naive, zone)
	guess = naive - offsetMsAt(guess, zone)
	return guess
}

export function parseHhMm(value: string): { hour: number; minute: number } {
	const [hourText, minuteText] = String(value || "0:0").split(":")
	const hour = Math.min(23, Math.max(0, Number(hourText) || 0))
	const minute = Math.min(59, Math.max(0, Number(minuteText) || 0))
	return { hour, minute }
}

export function formatHhMm(hour: number, minute: number): string {
	return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0")
}

export function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
	if (!match) return null
	return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

export function isoDateInZone(at: number, timezone: string): string {
	const p = localPartsInZone(at, timezone)
	return p.year + "-" + String(p.month).padStart(2, "0") + "-" + String(p.day).padStart(2, "0")
}

/** Next occurrence of HH:mm in a zone, strictly after `from`. */
export function nextDailyOccurrence(from: number, localTime: string, timezone: string): number {
	const zone = safeTimezone(timezone)
	const { hour, minute } = parseHhMm(localTime)
	for (let dayOffset = 0; dayOffset <= 2; dayOffset += 1) {
		const anchor = localPartsInZone(from + dayOffset * 36 * 60 * MINUTE_MS, zone)
		const candidate = zonedToUtcMs(
			{ year: anchor.year, month: anchor.month, day: anchor.day, hour, minute },
			zone,
		)
		if (candidate > from) return candidate
	}
	return from + 24 * 60 * MINUTE_MS
}

export function startOfLocalDay(at: number, timezone: string): number {
	const p = localPartsInZone(at, timezone)
	return zonedToUtcMs({ year: p.year, month: p.month, day: p.day, hour: 0, minute: 0 }, timezone)
}

export function endOfLocalDay(at: number, timezone: string): number {
	return startOfLocalDay(at, timezone) + 24 * 60 * MINUTE_MS - 1
}

/** Handles windows that wrap past midnight, e.g. quiet hours 22:00-08:00. */
export function isWithinLocalWindow(at: number, start: string, end: string, timezone: string): boolean {
	const p = localPartsInZone(at, timezone)
	const minutes = p.hour * 60 + p.minute
	const from = parseHhMm(start)
	const to = parseHhMm(end)
	const fromMinutes = from.hour * 60 + from.minute
	const toMinutes = to.hour * 60 + to.minute
	if (fromMinutes === toMinutes) return false
	if (fromMinutes < toMinutes) return minutes >= fromMinutes && minutes < toMinutes
	return minutes >= fromMinutes || minutes < toMinutes
}
