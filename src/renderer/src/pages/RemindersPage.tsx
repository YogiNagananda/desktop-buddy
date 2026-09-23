import { useState, type FormEvent } from "react"
import type {
	DashboardSnapshot,
	Priority,
	RecurrenceRule,
	Reminder,
} from "@shared/types"
import { formatClock } from "../useSnapshot"

type Draft = {
	id: string | null
	title: string
	description: string
	localTime: string
	priority: Priority
	recurrenceRule: RecurrenceRule
	intervalMinutes: number
}

const EMPTY: Draft = {
	id: null,
	title: "",
	description: "",
	localTime: "09:00",
	priority: "normal",
	recurrenceRule: "none",
	intervalMinutes: 60,
}

function bucket(reminder: Reminder): "completed" | "recurring" | "today" | "upcoming" {
	if (reminder.completedAt) return "completed"
	if (reminder.recurrenceRule !== "none") return "recurring"
	const at = reminder.snoozedUntil ?? reminder.nextTriggerAt
	if (at === null) return "upcoming"
	return new Date(at).toDateString() === new Date().toDateString() ? "today" : "upcoming"
}

export function RemindersPage({ snapshot }: { snapshot: DashboardSnapshot }) {
	const [draft, setDraft] = useState<Draft>(EMPTY)
	const reminders = snapshot.reminders

	const submit = (event: FormEvent) => {
		event.preventDefault()
		if (!draft.title.trim()) return
		const input = {
			title: draft.title.trim(),
			description: draft.description.trim() || undefined,
			localTime: draft.localTime,
			priority: draft.priority,
			recurrenceRule: draft.recurrenceRule,
			intervalMinutes: draft.recurrenceRule === "interval" ? draft.intervalMinutes : undefined,
		}
		const done = () => setDraft(EMPTY)
		if (draft.id) void window.buddy.updateReminder(draft.id, input).then(done)
		else void window.buddy.createReminder(input).then(done)
	}

	const sections: Array<[string, Reminder[]]> = [
		["Today", reminders.filter((item) => bucket(item) === "today")],
		["Upcoming", reminders.filter((item) => bucket(item) === "upcoming")],
		["Recurring", reminders.filter((item) => bucket(item) === "recurring")],
		["Completed", reminders.filter((item) => bucket(item) === "completed")],
	]

	return (
		<div className="page">
			<h1 className="page__title">Reminders</h1>

			<form className="card" onSubmit={submit}>
				<h3 className="card__title">{draft.id ? "Edit reminder" : "New reminder"}</h3>
				<input
					className="input"
					placeholder="What should I remember?"
					value={draft.title}
					onChange={(event) => setDraft({ ...draft, title: event.target.value })}
				/>
				<input
					className="input"
					placeholder="Optional note"
					value={draft.description}
					onChange={(event) => setDraft({ ...draft, description: event.target.value })}
				/>
				<div className="row">
					<input
						className="input"
						type="time"
						value={draft.localTime}
						onChange={(event) => setDraft({ ...draft, localTime: event.target.value })}
					/>
					<select
						className="input"
						value={draft.priority}
						onChange={(event) => setDraft({ ...draft, priority: event.target.value as Priority })}
					>
						<option value="gentle">Gentle</option>
						<option value="normal">Normal</option>
						<option value="important">Important</option>
					</select>
					<select
						className="input"
						value={draft.recurrenceRule}
						onChange={(event) =>
							setDraft({ ...draft, recurrenceRule: event.target.value as RecurrenceRule })
						}
					>
						<option value="none">Once</option>
						<option value="daily">Daily</option>
						<option value="interval">Every X minutes</option>
					</select>
					{draft.recurrenceRule === "interval" ? (
						<input
							className="input input--narrow"
							type="number"
							min={5}
							value={draft.intervalMinutes}
							onChange={(event) =>
								setDraft({ ...draft, intervalMinutes: Number(event.target.value) })
							}
						/>
					) : null}
					<button className="button button--primary" type="submit">
						{draft.id ? "Save" : "Add"}
					</button>
					{draft.id ? (
						<button className="button" type="button" onClick={() => setDraft(EMPTY)}>
							Cancel
						</button>
					) : null}
				</div>
			</form>

			{sections.map(([label, items]) => (
				<section className="card" key={label}>
					<h3 className="card__title">{label}</h3>
					{items.length === 0 ? (
						<p className="muted">Nothing here.</p>
					) : (
						<ul className="list">
							{items.map((reminder) => (
								<li className="list__row" key={reminder.id}>
									<span className={"pill pill--" + reminder.priority}>{reminder.priority}</span>
									<span className="list__label">{reminder.title}</span>
									<span className="muted">
										{reminder.recurrenceRule === "interval"
											? "every " + (reminder.intervalMinutes ?? 60) + " min"
											: reminder.nextTriggerAt
												? formatClock(reminder.nextTriggerAt)
												: "--"}
									</span>
									<span className="row row--tight">
										<button
											className="button button--ghost"
											onClick={() =>
												setDraft({
													id: reminder.id,
													title: reminder.title,
													description: reminder.description ?? "",
													localTime: reminder.localTime,
													priority: reminder.priority,
													recurrenceRule: reminder.recurrenceRule,
													intervalMinutes: reminder.intervalMinutes ?? 60,
												})
											}
										>
											Edit
										</button>
										<button
											className="button button--ghost"
											onClick={() => void window.buddy.duplicateReminder(reminder.id)}
										>
											Duplicate
										</button>
										{reminder.kind === "custom" ? (
											<button
												className="button button--ghost"
												onClick={() => void window.buddy.deleteReminder(reminder.id)}
											>
												Delete
											</button>
										) : null}
									</span>
								</li>
							))}
						</ul>
					)}
				</section>
			))}
		</div>
	)
}
