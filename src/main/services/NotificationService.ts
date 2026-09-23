import { Notification } from "electron"
import type { AppSettings, BuddyScript, Priority } from "@shared/types"
import type { FocusModeService } from "./FocusModeService"
import { isWithinLocalWindow, systemTimezone } from "./time"

/** §5.3 — at most one popup every two minutes; gentle nudges get combined. */
export const COOLDOWN_MS = 2 * 60_000

export type NotifyRequest = {
	/** Stable key so one reminder can only hold one notification (§5.2). */
	key: string
	priority: Priority
	script: BuddyScript
	reminderId?: string | null
}

export type NotifyOutcome = {
	shown: boolean
	reason?: "focus" | "quietHours" | "duplicate" | "cooldown"
}

export class NotificationService {
	private lastPopupAt = 0
	private active = new Set<string>()
	private pendingGentle: NotifyRequest[] = []

	constructor(
		private settings: AppSettings,
		private focus: FocusModeService,
		private showPopup: (request: NotifyRequest, sticky: boolean) => void,
	) {}

	setSettings(settings: AppSettings): void {
		this.settings = settings
	}

	/** Releases the "one notification per reminder" hold. */
	release(key: string): void {
		this.active.delete(key)
	}

	request(request: NotifyRequest): NotifyOutcome {
		const now = Date.now()

		// Focus Mode and Quiet Hours are absolute (§5.4).
		if (this.focus.isActive()) {
			this.focus.recordSuppressed()
			return { shown: false, reason: "focus" }
		}
		if (
			this.settings.quietHoursEnabled &&
			isWithinLocalWindow(
				now,
				this.settings.quietHoursStart,
				this.settings.quietHoursEnd,
				systemTimezone(),
			)
		) {
			return { shown: false, reason: "quietHours" }
		}

		if (this.active.has(request.key)) {
			return { shown: false, reason: "duplicate" }
		}

		if (now - this.lastPopupAt < COOLDOWN_MS) {
			if (request.priority === "important") {
				// Important reminders are the one exception to the cooldown.
				return this.present(request, now)
			}
			if (request.priority === "gentle") {
				this.pendingGentle.push(request)
				return { shown: false, reason: "cooldown" }
			}
			return { shown: false, reason: "cooldown" }
		}

		return this.present(request, now)
	}

	/** Combines gentle nudges that piled up during a cooldown into one popup. */
	drainGentle(): NotifyRequest | null {
		if (this.pendingGentle.length === 0) return null
		if (Date.now() - this.lastPopupAt < COOLDOWN_MS) return null
		const queued = this.pendingGentle
		this.pendingGentle = []
		const first = queued[0]!
		if (queued.length === 1) {
			this.present(first, Date.now())
			return first
		}
		const combined: NotifyRequest = {
			key: "gentle-combined",
			priority: "gentle",
			script: {
				...first.script,
				title: "A couple of nudges",
				message: queued.map((item) => item.script.title).join(" · "),
			},
		}
		this.present(combined, Date.now())
		return combined
	}

	private present(request: NotifyRequest, now: number): NotifyOutcome {
		this.active.add(request.key)
		this.lastPopupAt = now
		const sticky = request.priority === "important"
		this.showPopup(request, sticky)

		// §6.9 — only normal and important reminders also raise an OS toast.
		if (request.priority !== "gentle" && Notification.isSupported()) {
			const toast = new Notification({
				title: request.script.title,
				body: request.script.message ?? "",
				silent: request.priority === "normal",
				timeoutType: sticky ? "never" : "default",
			})
			toast.show()
		}
		return { shown: true }
	}

	/** A plain informational toast with no popup and no cooldown bookkeeping. */
	info(title: string, body: string): void {
		if (!Notification.isSupported()) return
		new Notification({ title, body, silent: true }).show()
	}
}
