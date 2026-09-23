import type { AppSettings, SessionState } from "@shared/types"
import { MINUTE_MS } from "./time"
import { loadSessionState, saveSessionState } from "./db"

export const SESSION_PRESETS = {
	classic: { label: "Classic", workMinutes: 25, breakMinutes: 5, cycles: 4 },
	deep: { label: "Deep work", workMinutes: 50, breakMinutes: 10, cycles: 3 },
} as const

export type SessionBoundary = { type: "workStarted" | "breakStarted" | "sessionFinished" }

const IDLE_STATE: SessionState = {
	phase: "idle",
	preset: "custom",
	workMinutes: 25,
	breakMinutes: 5,
	cycleIndex: 0,
	totalCycles: 4,
	phaseStartedAt: null,
	phaseEndsAt: null,
	pausedRemainingMs: null,
	pausedPhase: null,
}

/** Work/break cycles with presets, pause/resume and end early (section 6.5). */
export class SessionService {
	private state: SessionState

	constructor(private settings: AppSettings) {
		this.state =
			loadSessionState<SessionState>() ?? {
				...IDLE_STATE,
				workMinutes: settings.workMinutes,
				breakMinutes: settings.breakMinutes,
				totalCycles: settings.cycles,
			}
	}

	setSettings(settings: AppSettings): void {
		this.settings = settings
		if (this.state.phase === "idle") {
			this.state = {
				...this.state,
				workMinutes: settings.workMinutes,
				breakMinutes: settings.breakMinutes,
				totalCycles: settings.cycles,
			}
			this.persist()
		}
	}

	get(): SessionState {
		return { ...this.state }
	}

	phaseEndsAt(): number | null {
		return this.state.phaseEndsAt
	}

	start(
		options:
			| { preset: "classic" | "deep" }
			| { preset: "custom"; workMinutes: number; breakMinutes: number; cycles: number },
	): void {
		const config =
			options.preset === "custom"
				? {
						workMinutes: options.workMinutes || this.settings.workMinutes,
						breakMinutes: options.breakMinutes || this.settings.breakMinutes,
						cycles: options.cycles || this.settings.cycles,
					}
				: SESSION_PRESETS[options.preset]
		const now = Date.now()
		this.state = {
			phase: "working",
			preset: options.preset,
			workMinutes: config.workMinutes,
			breakMinutes: config.breakMinutes,
			cycleIndex: 0,
			totalCycles: config.cycles,
			phaseStartedAt: now,
			phaseEndsAt: now + config.workMinutes * MINUTE_MS,
			pausedRemainingMs: null,
			pausedPhase: null,
		}
		this.persist()
	}

	pause(): void {
		if (this.state.phase !== "working" && this.state.phase !== "break") return
		const remaining = Math.max(0, (this.state.phaseEndsAt ?? 0) - Date.now())
		this.state = {
			...this.state,
			pausedPhase: this.state.phase,
			pausedRemainingMs: remaining,
			phase: "paused",
			phaseEndsAt: null,
		}
		this.persist()
	}

	resume(): void {
		if (this.state.phase !== "paused" || !this.state.pausedPhase) return
		const now = Date.now()
		this.state = {
			...this.state,
			phase: this.state.pausedPhase,
			phaseStartedAt: now,
			phaseEndsAt: now + (this.state.pausedRemainingMs ?? 0),
			pausedPhase: null,
			pausedRemainingMs: null,
		}
		this.persist()
	}

	endEarly(): void {
		this.state = {
			...IDLE_STATE,
			workMinutes: this.settings.workMinutes,
			breakMinutes: this.settings.breakMinutes,
			totalCycles: this.settings.cycles,
		}
		this.persist()
	}

	startBreakNow(): SessionBoundary | null {
		if (this.state.phase !== "working") return null
		const now = Date.now()
		this.state = {
			...this.state,
			phase: "break",
			phaseStartedAt: now,
			phaseEndsAt: now + this.state.breakMinutes * MINUTE_MS,
		}
		this.persist()
		return { type: "breakStarted" }
	}

	/** Advances the phase once its end time has passed. */
	tick(now = Date.now()): SessionBoundary | null {
		const { phase, phaseEndsAt } = this.state
		if ((phase !== "working" && phase !== "break") || phaseEndsAt === null) return null
		if (now < phaseEndsAt) return null

		if (phase === "working") {
			this.state = {
				...this.state,
				phase: "break",
				phaseStartedAt: now,
				phaseEndsAt: now + this.state.breakMinutes * MINUTE_MS,
			}
			this.persist()
			return { type: "breakStarted" }
		}

		const nextCycle = this.state.cycleIndex + 1
		if (nextCycle >= this.state.totalCycles) {
			this.endEarly()
			return { type: "sessionFinished" }
		}
		this.state = {
			...this.state,
			phase: "working",
			cycleIndex: nextCycle,
			phaseStartedAt: now,
			phaseEndsAt: now + this.state.workMinutes * MINUTE_MS,
		}
		this.persist()
		return { type: "workStarted" }
	}

	private persist(): void {
		saveSessionState(this.state)
	}
}
