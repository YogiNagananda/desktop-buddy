import { useEffect, useState } from "react"
import { useSnapshot } from "./useSnapshot"
import { DashboardPage } from "./pages/DashboardPage"
import { RemindersPage } from "./pages/RemindersPage"
import { SettingsPage } from "./pages/SettingsPage"

type Tab = "dashboard" | "reminders" | "settings"

export function App() {
	const snapshot = useSnapshot()
	const [tab, setTab] = useState<Tab>("dashboard")

	// Theme follows the setting, defaulting to the OS preference.
	useEffect(() => {
		const theme = snapshot?.settings.theme ?? "system"
		const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
		const resolved = theme === "system" ? (prefersDark ? "dark" : "light") : theme
		document.documentElement.setAttribute("data-theme", resolved)
	}, [snapshot?.settings.theme])

	if (!snapshot) {
		return <div className="app app--loading">Waking up...</div>
	}

	return (
		<div className="app">
			<nav className="nav">
				<span className="nav__brand">Desktop Buddy</span>
				{(["dashboard", "reminders", "settings"] as Tab[]).map((item) => (
					<button
						key={item}
						className={"nav__tab" + (tab === item ? " nav__tab--active" : "")}
						onClick={() => setTab(item)}
					>
						{item === "dashboard" ? "Today" : item === "reminders" ? "Reminders" : "Settings"}
					</button>
				))}
				<button className="button nav__cta" onClick={() => void window.buddy.openQuickAdd()}>
					Remember This
				</button>
			</nav>
			<main className="main">
				{tab === "dashboard" ? <DashboardPage snapshot={snapshot} /> : null}
				{tab === "reminders" ? <RemindersPage snapshot={snapshot} /> : null}
				{tab === "settings" ? <SettingsPage settings={snapshot.settings} /> : null}
			</main>
		</div>
	)
}
