import type { AppSettings } from "@shared/types"

function Toggle({
	label,
	value,
	onChange,
}: {
	label: string
	value: boolean
	onChange: (next: boolean) => void
}) {
	return (
		<label className="field field--inline">
			<input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
			<span>{label}</span>
		</label>
	)
}

export function SettingsPage({ settings }: { settings: AppSettings }) {
	const patch = (next: Partial<AppSettings>) => void window.buddy.updateSettings(next)

	return (
		<div className="page">
			<h1 className="page__title">Settings</h1>

			<section className="card">
				<h3 className="card__title">Water</h3>
				<Toggle
					label="Remind me to drink water"
					value={settings.waterEnabled}
					onChange={(waterEnabled) => patch({ waterEnabled })}
				/>
				<div className="row">
					<label className="field">
						<span>Every (minutes)</span>
						<input
							className="input input--narrow"
							type="number"
							min={15}
							value={settings.waterIntervalMinutes}
							onChange={(event) => patch({ waterIntervalMinutes: Number(event.target.value) })}
						/>
					</label>
					<label className="field">
						<span>From</span>
						<input
							className="input"
							type="time"
							value={settings.waterWindowStart}
							onChange={(event) => patch({ waterWindowStart: event.target.value })}
						/>
					</label>
					<label className="field">
						<span>To</span>
						<input
							className="input"
							type="time"
							value={settings.waterWindowEnd}
							onChange={(event) => patch({ waterWindowEnd: event.target.value })}
						/>
					</label>
				</div>
			</section>

			<section className="card">
				<h3 className="card__title">Lunch</h3>
				<Toggle
					label="Remind me to eat"
					value={settings.lunchEnabled}
					onChange={(lunchEnabled) => patch({ lunchEnabled })}
				/>
				<label className="field">
					<span>Lunch time</span>
					<input
						className="input"
						type="time"
						value={settings.lunchTime}
						onChange={(event) => patch({ lunchTime: event.target.value })}
					/>
				</label>
			</section>

			<section className="card">
				<h3 className="card__title">Active Computer Time</h3>
				<Toggle
					label="Nudge me after a long stretch"
					value={settings.activeTimeEnabled}
					onChange={(activeTimeEnabled) => patch({ activeTimeEnabled })}
				/>
				<label className="field">
					<span>After (minutes)</span>
					<input
						className="input input--narrow"
						type="number"
						min={20}
						value={settings.activeTimeThresholdMinutes}
						onChange={(event) => patch({ activeTimeThresholdMinutes: Number(event.target.value) })}
					/>
				</label>
			</section>

			<section className="card">
				<h3 className="card__title">Sessions</h3>
				<div className="row">
					<label className="field">
						<span>Work</span>
						<input
							className="input input--narrow"
							type="number"
							min={5}
							value={settings.workMinutes}
							onChange={(event) => patch({ workMinutes: Number(event.target.value) })}
						/>
					</label>
					<label className="field">
						<span>Break</span>
						<input
							className="input input--narrow"
							type="number"
							min={1}
							value={settings.breakMinutes}
							onChange={(event) => patch({ breakMinutes: Number(event.target.value) })}
						/>
					</label>
					<label className="field">
						<span>Cycles</span>
						<input
							className="input input--narrow"
							type="number"
							min={1}
							value={settings.cycles}
							onChange={(event) => patch({ cycles: Number(event.target.value) })}
						/>
					</label>
				</div>
			</section>

			<section className="card">
				<h3 className="card__title">Quiet hours</h3>
				<Toggle
					label="Stay silent overnight"
					value={settings.quietHoursEnabled}
					onChange={(quietHoursEnabled) => patch({ quietHoursEnabled })}
				/>
				<div className="row">
					<label className="field">
						<span>From</span>
						<input
							className="input"
							type="time"
							value={settings.quietHoursStart}
							onChange={(event) => patch({ quietHoursStart: event.target.value })}
						/>
					</label>
					<label className="field">
						<span>To</span>
						<input
							className="input"
							type="time"
							value={settings.quietHoursEnd}
							onChange={(event) => patch({ quietHoursEnd: event.target.value })}
						/>
					</label>
				</div>
			</section>

			<section className="card">
				<h3 className="card__title">App</h3>
				<label className="field">
					<span>Theme</span>
					<select
						className="input"
						value={settings.theme}
						onChange={(event) => patch({ theme: event.target.value as AppSettings["theme"] })}
					>
						<option value="system">Match system</option>
						<option value="light">Light</option>
						<option value="dark">Dark</option>
					</select>
				</label>
				<Toggle
					label="Start with Windows"
					value={settings.startWithWindows}
					onChange={(startWithWindows) => patch({ startWithWindows })}
				/>
				<Toggle
					label="Start minimised to the tray"
					value={settings.startMinimized}
					onChange={(startMinimized) => patch({ startMinimized })}
				/>
				<Toggle
					label="Allow popups over fullscreen apps"
					value={settings.allowOverFullscreen}
					onChange={(allowOverFullscreen) => patch({ allowOverFullscreen })}
				/>
				<button className="button" onClick={() => void window.buddy.resetData()}>
					Reset all data
				</button>
			</section>
		</div>
	)
}
