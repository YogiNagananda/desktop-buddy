import type {
	BuddyScript,
	CurrentState,
	Priority,
	StateSource,
	UpNextItem,
} from "@shared/types"
import { ambientScript, celebrationScript } from "@shared/copy"

export type StateCandidate = {
	source: StateSource
	script: BuddyScript
	reminderId?: string | null
	/** Absolute ms; null means it stays until explicitly cleared. */
	expiresAt?: number | null
}

/**
 * §4 — the single precedence table. Lower number wins. Nothing else in the
 * app is allowed to set the animation directly; every feature emits a
 * candidate and this service decides what the Buddy is doing.
 */
const PRECEDENCE: Record<StateSource, number> = {
	celebration: 0,
	reset: 1,
	importantReminder: 2,
	activeTimeWarning: 3,
	sessionBoundary: 4,
	normalReminder: 5,
	gentleReminder: 6,
	ambient: 7,
}

/** Celebrations are a brief flourish, never a blocking state (§6.4). */
export const CELEBRATION_MS = 1800

export function sourceForPriority(priority: Priority): StateSource {
	if (priority === "important") return "importantReminder"
	if (priority === "gentle") return "gentleReminder"
	return "normalReminder"
}

export class CurrentStateService {
	private candidates = new Map<StateSource, StateCandidate>()
	private isWorking = false
	private elapsedMs: number | null = null
	private remainingMs: number | null = null
	private nextEvent: UpNextItem | null = null
	private listeners = new Set<(state: CurrentState) => void>()

	subscribe(listener: (state: CurrentState) => void): () => void {
		this.listeners.add(listener)
		return () => this.listeners.delete(listener)
	}

	emit(candidate: StateCandidate): void {
		this.candidates.set(candidate.source, candidate)
		this.publish()
	}

	clear(source: StateSource): void {
		if (this.candidates.delete(source)) this.publish()
	}

	/** Clears whichever reminder slot is holding this reminder id. */
	clearReminder(reminderId: string): void {
		let changed = false
		for (const [source, candidate] of this.candidates) {
			if (candidate.reminderId === reminderId) {
				this.candidates.delete(source)
				changed = true
			}
		}
		if (changed) this.publish()
	}

	celebrate(message?: string): void {
		this.emit({
			source: "celebration",
			script: celebrationScript(message),
			expiresAt: Date.now() + CELEBRATION_MS,
		})
	}

	setAmbient(isWorking: boolean): void {
		this.isWorking = isWorking
	}

	setSessionTiming(elapsedMs: number | null, remainingMs: number | null): void {
		this.elapsedMs = elapsedMs
		this.remainingMs = remainingMs
	}

	setNextEvent(next: UpNextItem | null): void {
		this.nextEvent = next
	}

	/** Drops expired candidates; called on the 1s tick. */
	prune(now = Date.now()): void {
		let changed = false
		for (const [source, candidate] of this.candidates) {
			if (candidate.expiresAt != null && now >= candidate.expiresAt) {
				this.candidates.delete(source)
				changed = true
			}
		}
		if (changed) this.publish()
	}

	/** True when something other than the ambient state is showing. */
	hasActiveEvent(): boolean {
		for (const source of this.candidates.keys()) {
			if (source !== "ambient" && source !== "celebration") return true
		}
		return false
	}

	resolve(): CurrentState {
		let winner: StateCandidate | null = null
		for (const candidate of this.candidates.values()) {
			if (
				!winner ||
				PRECEDENCE[candidate.source] < PRECEDENCE[winner.source]
			) {
				winner = candidate
			}
		}

		const script = winner?.script ?? ambientScript(this.isWorking)
		return {
			state: script.state,
			title: script.title,
			message: script.message,
			actions: script.actions,
			source: winner?.source ?? "ambient",
			reminderId: winner?.reminderId ?? null,
			elapsedMs: this.elapsedMs,
			remainingMs: this.remainingMs,
			nextEvent: this.nextEvent,
		}
	}

	private publish(): void {
		const state = this.resolve()
		for (const listener of this.listeners) listener(state)
	}
}
