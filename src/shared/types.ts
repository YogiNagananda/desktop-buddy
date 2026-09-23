/** The nine Buddy states from section 6.12. */
export const BUDDY_STATES = [
	"idle",
	"working",
	"break",
	"drinking",
	"eating",
	"relaxing",
	"warning",
	"reminder",
	"celebrating",
] as const

export type BuddyState = (typeof BUDDY_STATES)[number]

/** gentle = popup only, normal = popup + toast, important = stays until dismissed. */
export type Priority = "gentle" | "normal" | "important"
export type RecurrenceRule = "none" | "daily" | "interval"
export type ReminderKind = "water" | "lunch" | "custom"

export type Reminder = {
	id: string
	title: string
	description?: string
	category?: string
	priority: Priority
	localDate?: string
	localTime: string
	timezone: string
	recurrenceRule: RecurrenceRule
	intervalMinutes?: number
	nextTriggerAt: number | null
	lastTriggeredAt?: number | null
	snoozedUntil?: number | null
	completedAt?: number | null
	kind: ReminderKind
	enabled: boolean
	buddyState: BuddyState
	createdAt: number
	missedAt?: number | null
}

export type ReminderCreateInput = {
	title: string
	description?: string
	category?: string
	priority: Priority
	localDate?: string
	localTime: string
	recurrenceRule: RecurrenceRule
	intervalMinutes?: number
	kind?: ReminderKind
	buddyState?: BuddyState
}

export type ReminderUpdateInput = Partial<ReminderCreateInput> & { enabled?: boolean }

export type BuddyActionId =
	| "done"
	| "snooze"
	| "skip"
	| "dismiss"
	| "gotIt"
	| "takeBreak"
	| "fiveMore"
	| "startReset"

export type BuddyAction = { id: BuddyActionId; label: string }

export type StateSource =
	| "celebration"
	| "reset"
	| "importantReminder"
	| "activeTimeWarning"
	| "sessionBoundary"
	| "normalReminder"
	| "gentleReminder"
	| "ambient"

export type BuddyScript = {
	state: BuddyState
	title: string
	message?: string
	actions: BuddyAction[]
}

export type UpNextItem = {
	id: string
	label: string
	at: number
	kind: ReminderKind | "session"
	priority: Priority
	buddyState: BuddyState
}

export type CurrentState = {
	state: BuddyState
	title: string
	message?: string
	actions: BuddyAction[]
	source: StateSource
	reminderId: string | null
	elapsedMs: number | null
	remainingMs: number | null
	nextEvent: UpNextItem | null
}

export type SessionPhase = "idle" | "working" | "break" | "paused"
export type SessionPresetId = "classic" | "deep" | "custom"

export type SessionState = {
	phase: SessionPhase
	preset: SessionPresetId
	workMinutes: number
	breakMinutes: number
	cycleIndex: number
	totalCycles: number
	phaseStartedAt: number | null
	phaseEndsAt: number | null
	pausedRemainingMs: number | null
	pausedPhase: "working" | "break" | null
}

export type FocusModeState = { active: boolean; endsAt: number | null; suppressedCount: number }
export type ResetFlowState = {
	active: boolean
	step: number
	totalSteps: number
	label: string | null
	stepEndsAt: number | null
}
export type MissedNotice = { reminderId: string; title: string; missedAt: number }

export type AppSettings = {
	waterEnabled: boolean
	waterIntervalMinutes: number
	waterWindowStart: string
	waterWindowEnd: string
	lunchEnabled: boolean
	lunchTime: string
	activeTimeEnabled: boolean
	activeTimeThresholdMinutes: number
	workMinutes: number
	breakMinutes: number
	cycles: number
	quietHoursEnabled: boolean
	quietHoursStart: string
	quietHoursEnd: string
	focusDefaultMinutes: number[]
	theme: "system" | "light" | "dark"
	startWithWindows: boolean
	startMinimized: boolean
	allowOverFullscreen: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
	waterEnabled: true,
	waterIntervalMinutes: 60,
	waterWindowStart: "09:00",
	waterWindowEnd: "20:00",
	lunchEnabled: true,
	lunchTime: "12:30",
	activeTimeEnabled: true,
	activeTimeThresholdMinutes: 60,
	workMinutes: 25,
	breakMinutes: 5,
	cycles: 4,
	quietHoursEnabled: true,
	quietHoursStart: "22:00",
	quietHoursEnd: "08:00",
	focusDefaultMinutes: [25, 50, 90],
	theme: "system",
	startWithWindows: false,
	startMinimized: false,
	allowOverFullscreen: false,
}

export type DashboardSnapshot = {
	current: CurrentState
	session: SessionState
	focus: FocusModeState
	reset: ResetFlowState
	upNext: UpNextItem[]
	todayTimeline: UpNextItem[]
	missed: MissedNotice[]
	activeComputerMinutes: number
	settings: AppSettings
	reminders: Reminder[]
}
