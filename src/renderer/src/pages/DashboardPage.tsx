import type { DashboardSnapshot } from "@shared/types"
import { RightNowPanel } from "../components/RightNowPanel"
import { UpNext } from "../components/UpNext"
import { Timeline } from "../components/Timeline"
import { SessionControls } from "../components/SessionControls"
import { FocusModePanel } from "../components/FocusModePanel"

function greeting(): string {
	const hour = new Date().getHours()
	if (hour < 12) return "Good morning"
	if (hour < 18) return "Good afternoon"
	return "Good evening"
}

export function DashboardPage({ snapshot }: { snapshot: DashboardSnapshot }) {
	const { missed, activeComputerMinutes } = snapshot

	return (
		<div className="page">
			<header className="page__header">
				<h1 className="page__title">{greeting()}</h1>
				{/* Named "Active Computer Time" everywhere - never "screen time". */}
				<span className="chip">Active Computer Time: {activeComputerMinutes} min</span>
				<button
					className="button"
					style={{ marginLeft: "auto" }}
					onClick={() => void window.buddy.showBuddy()}
					title="Float the buddy widget on your screen"
				>
					📌 Show Buddy
				</button>
			</header>

			{missed.map((notice) => (
				<div className="banner" key={notice.reminderId}>
					<span>{notice.title} came due while you were away. No rush.</span>
					<button className="button" onClick={() => void window.buddy.dismissMissed(notice.reminderId)}>
						Got it
					</button>
				</div>
			))}

			<RightNowPanel snapshot={snapshot} />

			<div className="grid">
				<UpNext items={snapshot.upNext} />
				<SessionControls session={snapshot.session} />
				<FocusModePanel focus={snapshot.focus} settings={snapshot.settings} />
				<Timeline items={snapshot.todayTimeline} />
			</div>

			<button className="button button--primary page__reset" onClick={() => void window.buddy.startReset()}>
				Start 2-Minute Reset
			</button>
		</div>
	)
}
