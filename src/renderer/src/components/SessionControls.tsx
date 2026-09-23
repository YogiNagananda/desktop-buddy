import type { SessionState } from "@shared/types"
import { formatDuration } from "../useSnapshot"

export function SessionControls({ session }: { session: SessionState }) {
	const running = session.phase === "working" || session.phase === "break"
	const remaining = session.phaseEndsAt === null ? null : session.phaseEndsAt - Date.now()

	return (
		<section className="card">
			<h3 className="card__title">Work session</h3>
			{session.phase === "idle" ? (
				<>
					<p className="muted">Pick a rhythm and I'll keep time.</p>
					<div className="row">
						<button
							className="button button--primary"
							onClick={() => void window.buddy.startSession({ preset: "classic" })}
						>
							Classic 25/5
						</button>
						<button
							className="button"
							onClick={() => void window.buddy.startSession({ preset: "deep" })}
						>
							Deep work 50/10
						</button>
					</div>
				</>
			) : (
				<>
					<p className="session__phase">
						{session.phase === "paused" ? "Paused" : session.phase === "working" ? "Focus" : "Break"}
						{" "}
						&middot; cycle {session.cycleIndex + 1} of {session.totalCycles}
					</p>
					<p className="session__timer">
						{formatDuration(session.phase === "paused" ? session.pausedRemainingMs : remaining)}
					</p>
					<div className="row">
						{running ? (
							<button className="button" onClick={() => void window.buddy.pauseSession()}>
								Pause
							</button>
						) : (
							<button className="button button--primary" onClick={() => void window.buddy.resumeSession()}>
								Resume
							</button>
						)}
						<button className="button" onClick={() => void window.buddy.endSession()}>
							End session
						</button>
					</div>
				</>
			)}
		</section>
	)
}
