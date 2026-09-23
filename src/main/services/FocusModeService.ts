import type { FocusModeState } from "@shared/types"
import { MINUTE_MS } from "./time"

/**
 * §6.3 — Focus Mode. While active nothing interrupts (§5.4), and on exit the
 * user gets one calm summary line instead of a replayed backlog (§5.9).
 */
export class FocusModeService {
	private active = false
	private endsAt: number | null = null
	private suppressed = 0
	private timer: NodeJS.Timeout | null = null

	constructor(private onExit: (summary: string) => void) {}

	state(): FocusModeState {
		return {
			active: this.active,
			endsAt: this.endsAt,
			suppressedCount: this.suppressed,
		}
	}

	isActive(): boolean {
		if (this.active && this.endsAt !== null && Date.now() >= this.endsAt) {
			this.end()
		}
		return this.active
	}

	start(minutes: number): void {
		this.active = true
		this.suppressed = 0
		this.endsAt = Date.now() + Math.max(1, minutes) * MINUTE_MS
		if (this.timer) clearTimeout(this.timer)
		this.timer = setTimeout(() => this.end(), this.endsAt - Date.now())
	}

	end(): void {
		if (!this.active) return
		const count = this.suppressed
		this.active = false
		this.endsAt = null
		this.suppressed = 0
		if (this.timer) clearTimeout(this.timer)
		this.timer = null
		this.onExit(
			count === 0
				? "Nothing came up while you were focused."
				: count === 1
					? "One reminder waited for you. It's on your list."
					: `${count} reminders waited for you. They're on your list.`,
		)
	}

	recordSuppressed(): void {
		if (this.active) this.suppressed += 1
	}

	/** Called after sleep/resume so an expired focus window closes itself. */
	recheck(): void {
		if (this.active && this.endsAt !== null && Date.now() >= this.endsAt) this.end()
	}
}
