import { useEffect } from "react"
import { Buddy } from "./Buddy"
import { useSnapshot } from "../useSnapshot"

/** Animation, then one line of text, then the actions. Escape always dismisses. */
export function ReminderPopup() {
	const snapshot = useSnapshot()

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") void window.buddy.closePopup()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [])

	if (!snapshot) return null
	const { current, reset } = snapshot

	return (
		// The whole popup is a drag region; buttons opt out with no-drag style
		<div className="popup" style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
			<div className="popup__drag-hint">⠿</div>
			<button
				className="popup__close"
				aria-label="Dismiss"
				style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				onClick={() => void window.buddy.closePopup()}
			>
				&times;
			</button>
			<Buddy state={current.state} size={150} />
			<h1 className="popup__title">{current.title}</h1>
			{current.message ? <p className="popup__message">{current.message}</p> : null}
			{reset.active ? (
				<p className="popup__step">
					Step {reset.step + 1} of {reset.totalSteps}
				</p>
			) : null}
			<div
				className="popup__actions"
				style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
			>
				{current.actions.map((action) => (
					<button
						key={action.id}
						className={"button" + (action.id === "done" || action.id === "gotIt" ? " button--primary" : "")}
						onClick={() => void window.buddy.action(action.id, current.reminderId)}
					>
						{action.label}
					</button>
				))}
			</div>
		</div>
	)
}
