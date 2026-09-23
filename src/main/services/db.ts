import { app } from "electron"
import { join } from "node:path"
import Database from "better-sqlite3"
import type { Reminder } from "@shared/types"

let db: Database.Database | null = null

/** Local SQLite only - no cloud, no accounts (section 7). */
export function getDb(): Database.Database {
	if (db) return db
	db = new Database(join(app.getPath("userData"), "desktop-buddy.db"))
	db.pragma("journal_mode = WAL")
	db.exec(`
		CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);
		CREATE TABLE IF NOT EXISTS reminders (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
		CREATE TABLE IF NOT EXISTS history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			reminder_id TEXT,
			event TEXT NOT NULL,
			at INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS session_state (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL);
	`)
	const row = db.prepare("SELECT version FROM schema_version LIMIT 1").get() as { version: number } | undefined
	if (!row) db.prepare("INSERT INTO schema_version (version) VALUES (1)").run()
	return db
}

export function loadReminders(): Reminder[] {
	const rows = getDb().prepare("SELECT payload FROM reminders").all() as Array<{ payload: string }>
	const reminders: Reminder[] = []
	for (const row of rows) {
		try {
			reminders.push(JSON.parse(row.payload) as Reminder)
		} catch {
			// One corrupt row must not stop the app from starting.
		}
	}
	return reminders
}

export function saveReminder(reminder: Reminder): void {
	getDb()
		.prepare(
			"INSERT INTO reminders (id, payload) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
		)
		.run(reminder.id, JSON.stringify(reminder))
}

export function deleteReminderRow(id: string): void {
	getDb().prepare("DELETE FROM reminders WHERE id = ?").run(id)
}

export function logHistory(event: string, reminderId?: string): void {
	getDb()
		.prepare("INSERT INTO history (reminder_id, event, at) VALUES (?, ?, ?)")
		.run(reminderId ?? null, event, Date.now())
}

export function completedSince(since: number): number {
	const row = getDb()
		.prepare("SELECT COUNT(*) AS total FROM history WHERE event = 'completed' AND at >= ?")
		.get(since) as { total: number }
	return row.total
}

export function loadSessionState<T>(): T | null {
	const row = getDb().prepare("SELECT payload FROM session_state WHERE id = 1").get() as
		| { payload: string }
		| undefined
	if (!row) return null
	try {
		return JSON.parse(row.payload) as T
	} catch {
		return null
	}
}

export function saveSessionState(state: unknown): void {
	getDb()
		.prepare(
			"INSERT INTO session_state (id, payload) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
		)
		.run(JSON.stringify(state))
}

export function resetAllData(): void {
	getDb().exec("DELETE FROM reminders; DELETE FROM history; DELETE FROM session_state;")
}

export function closeDb(): void {
	db?.close()
	db = null
}
