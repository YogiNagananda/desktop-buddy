import { useEffect, useState, type FormEvent } from "react"
import type { Priority } from "@shared/types"

function defaultTime(): string {
	const soon = new Date(Date.now() + 60 * 60 * 1000)
	return String(soon.getHours()).padStart(2, "0") + ":" + String(soon.getMinutes()).padStart(2, "0")
}

/** "Remember This" - open, type, save. Three actions at most (section 6.8). */
export function QuickAdd() {
	const [title, setTitle] = useState("")
	const [time, setTime] = useState(defaultTime)
	const [priority, setPriority] = useState<Priority>("normal")

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") void window.buddy.closeQuickAdd()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [])

	const submit = (event: FormEvent) => {
		event.preventDefault()
		if (!title.trim()) return
		void window.buddy
			.createReminder({ title: title.trim(), localTime: time, priority, recurrenceRule: "none" })
			.then(() => {
				setTitle("")
				void window.buddy.closeQuickAdd()
			})
	}

	return (
		<form className="quickadd" onSubmit={submit}>
			<label className="quickadd__label" htmlFor="quickadd-title">
				Remember this
			</label>
			<input
				id="quickadd-title"
				className="input"
				autoFocus
				placeholder="Call the dentist"
				value={title}
				onChange={(event) => setTitle(event.target.value)}
			/>
			<div className="quickadd__row">
				<input
					className="input"
					type="time"
					value={time}
					onChange={(event) => setTime(event.target.value)}
				/>
				<select
					className="input"
					value={priority}
					onChange={(event) => setPriority(event.target.value as Priority)}
				>
					<option value="gentle">Gentle</option>
					<option value="normal">Normal</option>
					<option value="important">Important</option>
				</select>
				<button className="button button--primary" type="submit">
					Save
				</button>
			</div>
		</form>
	)
}
