import type { AppSettings, FocusModeState } from "@shared/types"
import { relativeFromNow } from "../useSnapshot"

/** While Focus Mode is on, nothing interrupts (section 5.4). */
export function FocusModePanel({
	focus,
	settings,
}: {
	focus: FocusModeState
	settings: AppSettings
}) {
	return (
		<section className="card">
			<h3 className="card__title">Focus Mode</h3>
			{focus.active ? (
				<>
					<p className="muted">
						Quiet until {focus.endsAt ? relativeFromNow(focus.endsAt) : "you say otherwise"}.
					</p>
					<button className="button" onClick={() => void window.buddy.endFocus()}>
						End Focus Mode
					</button>
				</>
			) : (
				<>
					<p className="muted">I'll hold everything until it ends.</p>
					<div className="row">
						{settings.focusDefaultMinutes.map((minutes) => (
							<button
								key={minutes}
								className="button"
								onClick={() => void window.buddy.startFocus(minutes)}
							>
								{minutes} min
							</button>
						))}
					</div>
				</>
			)}
		</section>
	)
}
