import type { DashboardSnapshot } from "@shared/types"
import { Buddy } from "./Buddy"
import { formatDuration, relativeFromNow } from "../useSnapshot"

/** The hero: what the buddy is doing right now and what comes next. */
export function RightNowPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
	const { current, session } = snapshot

	return (
		<section className="card card--hero">
			<Buddy state={current.state} size={240} />
			<div className="hero__text">
				<h2 className="hero__title">{current.title}</h2>
				{current.message ? <p className="hero__message">{current.message}</p> : null}
				{session.phase === "working" || session.phase === "break" ? (
					<p className="hero__timer">
						{session.phase === "working" ? "Focus" : "Break"} &middot;{" "}
						{formatDuration(current.remainingMs)} left
					</p>
				) : null}
				{current.nextEvent ? (
					<p className="hero__next">
						Next: {current.nextEvent.label} {relativeFromNow(current.nextEvent.at)}
					</p>
				) : (
					<p className="hero__next">Nothing scheduled.</p>
				)}
				<div className="hero__actions">
					{current.actions.map((action) => (
						<button
							key={action.id}
							className={
								"button" + (action.id === "done" || action.id === "gotIt" ? " button--primary" : "")
							}
							onClick={() => void window.buddy.action(action.id, current.reminderId)}
						>
							{action.label}
						</button>
					))}
				</div>
			</div>
		</section>
	)
}
