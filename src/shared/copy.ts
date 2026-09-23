import type { BuddyScript, Priority } from "./types"

/** Tone rules (section 5.8): short, warm, never guilt-inducing, always an exit. */
export const SCRIPTS: Record<
	"water" | "lunch" | "activeTime" | "workStart" | "breakStart" | "breakOver" | "reset",
	BuddyScript
> = {
	water: {
		state: "drinking",
		title: "Hydration check",
		message: "Grab some water?",
		actions: [
			{ id: "done", label: "Done" },
			{ id: "snooze", label: "Snooze" },
			{ id: "skip", label: "Skip" },
		],
	},
	lunch: {
		state: "eating",
		title: "Lunch time",
		message: "Step away and eat something?",
		actions: [
			{ id: "gotIt", label: "Got it" },
			{ id: "snooze", label: "Snooze 10m" },
		],
	},
	activeTime: {
		// Always "Active Computer Time", never "screen time".
		state: "warning",
		title: "Active Computer Time",
		message: "You've been at the screen a while - time for a reset?",
		actions: [
			{ id: "takeBreak", label: "Take a Break" },
			{ id: "fiveMore", label: "5 More Minutes" },
			{ id: "snooze", label: "Snooze" },
		],
	},
	workStart: {
		state: "working",
		title: "Session started",
		message: "I'll keep an eye on the clock.",
		actions: [{ id: "gotIt", label: "Got it" }],
	},
	breakStart: {
		state: "break",
		title: "Break time",
		message: "Stand up, look away, stretch a little.",
		actions: [
			{ id: "gotIt", label: "Got it" },
			{ id: "startReset", label: "Guide me" },
		],
	},
	breakOver: {
		state: "working",
		title: "Back to it",
		message: "Ready when you are.",
		actions: [{ id: "gotIt", label: "Got it" }],
	},
	reset: {
		state: "relaxing",
		title: "2-Minute Reset",
		actions: [{ id: "dismiss", label: "Skip the rest" }],
	},
}

/** Three guided steps, 40 seconds each (section 6.6). */
export const RESET_STEPS: Array<{ label: string; seconds: number }> = [
	{ label: "Look at something 20 feet away.", seconds: 40 },
	{ label: "Roll your shoulders and unclench your jaw.", seconds: 40 },
	{ label: "Take five slow breaths.", seconds: 40 },
]

export function celebrationMessage(): string {
	const lines = ["Nice one.", "Done and dusted.", "That's the way.", "Logged it."]
	return lines[Math.floor(Math.random() * lines.length)] as string
}

export function celebrationScript(message?: string): BuddyScript {
	return { state: "celebrating", title: message ?? celebrationMessage(), actions: [] }
}

export function ambientScript(isWorking: boolean): BuddyScript {
	return isWorking
		? {
				state: "working",
				title: "Working alongside you",
				message: "I'll speak up when something's due.",
				actions: [],
			}
		: {
				state: "idle",
				title: "Hanging out",
				message: "Nothing needs you right now.",
				actions: [],
			}
}

export function customReminderScript(
	title: string,
	description: string | undefined,
	priority: Priority,
): BuddyScript {
	return {
		state: "reminder",
		title,
		message: description,
		actions:
			priority === "important"
				? [
						{ id: "done", label: "Done" },
						{ id: "snooze", label: "Snooze" },
						{ id: "dismiss", label: "Dismiss" },
					]
				: [
						{ id: "done", label: "Done" },
						{ id: "snooze", label: "Snooze" },
						{ id: "skip", label: "Skip" },
					],
	}
}

/** One calm line, no guilt, no backlog replay (section 7.3). */
export function missedMessage(title: string): string {
	return title + " came due while you were away. No rush."
}
