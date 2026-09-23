import { powerMonitor } from "electron"
import type { AppSettings } from "@shared/types"
import { MINUTE_MS } from "./time"

const SAMPLE_MS = 30_000
/** Five idle minutes means you actually stepped away, so the stretch resets. */
const IDLE_RESET_SECONDS = 300

/**
 * §6.4 — "Active Computer Time": how long you have been continuously active
 * at the machine. Deliberately not called screen time.
 */
export class ActiveTimeService {
	private stretchStartedAt = Date.now()
	private lastSampleAt = Date.now()
	private suppressedUntil = 0
	private firedForCurrentStretch = false
	private timer: NodeJS.Timeout | null = null

	constructor(
		private settings: AppSettings,
		private onThreshold: () => void,
	) {}

	setSettings(settings: AppSettings): void {
		this.settings = settings
	}

	start(): void {
		if (this.timer) return
		this.timer = setInterval(() => this.sample(), SAMPLE_MS)
	}

	stop(): void {
		if (this.timer) clearInterval(this.timer)
		this.timer = null
	}

	/** Minutes of the current continuous-activity stretch. */
	activeMinutes(): number {
		return Math.floor((Date.now() - this.stretchStartedAt) / MINUTE_MS)
	}

	reset(): void {
		this.stretchStartedAt = Date.now()
		this.firedForCurrentStretch = false
	}

	suppressFor(minutes: number): void {
		this.suppressedUntil = Date.now() + minutes * MINUTE_MS
	}

	private sample(): void {
		const now = Date.now()
		const gap = now - this.lastSampleAt
		this.lastSampleAt = now

		// A gap much larger than the sample interval means the machine slept.
		if (gap > SAMPLE_MS * 4) {
			this.reset()
			return
		}

		const idleSeconds = powerMonitor.getSystemIdleTime()
		if (idleSeconds >= IDLE_RESET_SECONDS) {
			this.reset()
			return
		}

		if (!this.settings.activeTimeEnabled) return
		if (now < this.suppressedUntil) return
		if (this.firedForCurrentStretch) return

		const threshold = this.settings.activeTimeThresholdMinutes * MINUTE_MS
		if (now - this.stretchStartedAt >= threshold) {
			// One nudge per stretch — never a repeating drumbeat (§5.2).
			this.firedForCurrentStretch = true
			this.onThreshold()
		}
	}
}
