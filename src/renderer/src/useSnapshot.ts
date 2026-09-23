import { useEffect, useState } from "react"
import type { DashboardSnapshot } from "@shared/types"

/** One subscription per window; the main process pushes a snapshot each second. */
export function useSnapshot(): DashboardSnapshot | null {
	const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)

	useEffect(() => {
		let cancelled = false
		void window.buddy.getSnapshot().then((initial) => {
			if (!cancelled) setSnapshot(initial)
		})
		const unsubscribe = window.buddy.onSnapshot(setSnapshot)
		return () => {
			cancelled = true
			unsubscribe()
		}
	}, [])

	return snapshot
}

export function formatDuration(ms: number | null | undefined): string {
	if (ms === null || ms === undefined) return "--:--"
	const total = Math.max(0, Math.round(ms / 1000))
	const minutes = Math.floor(total / 60)
	const seconds = total % 60
	return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0")
}

export function formatClock(at: number): string {
	return new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
}

export function relativeFromNow(at: number): string {
	const diff = at - Date.now()
	if (diff <= 0) return "now"
	const minutes = Math.round(diff / 60000)
	if (minutes < 1) return "in under a minute"
	if (minutes < 60) return "in " + minutes + " min"
	const hours = Math.floor(minutes / 60)
	const rest = minutes % 60
	return "in " + hours + "h" + (rest ? " " + rest + "m" : "")
}
