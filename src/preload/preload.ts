import { contextBridge, ipcRenderer } from "electron"
import type {
	AppSettings,
	BuddyActionId,
	DashboardSnapshot,
	Reminder,
	ReminderCreateInput,
	ReminderUpdateInput,
} from "@shared/types"

type StartSessionArgs =
	| { preset: "classic" | "deep" }
	| { preset: "custom"; workMinutes: number; breakMinutes: number; cycles: number }

const api = {
	getSnapshot: (): Promise<DashboardSnapshot> => ipcRenderer.invoke("buddy:getSnapshot"),
	listReminders: (): Promise<Reminder[]> => ipcRenderer.invoke("buddy:listReminders"),
	action: (action: BuddyActionId, reminderId?: string | null): Promise<void> =>
		ipcRenderer.invoke("buddy:action", action, reminderId ?? null),
	createReminder: (input: ReminderCreateInput): Promise<Reminder> =>
		ipcRenderer.invoke("buddy:createReminder", input),
	updateReminder: (id: string, patch: ReminderUpdateInput): Promise<Reminder | null> =>
		ipcRenderer.invoke("buddy:updateReminder", id, patch),
	deleteReminder: (id: string): Promise<void> => ipcRenderer.invoke("buddy:deleteReminder", id),
	duplicateReminder: (id: string): Promise<Reminder | null> =>
		ipcRenderer.invoke("buddy:duplicateReminder", id),
	snoozeReminder: (id: string, minutes: number): Promise<void> =>
		ipcRenderer.invoke("buddy:snoozeReminder", id, minutes),
	dismissMissed: (id: string): Promise<void> => ipcRenderer.invoke("buddy:dismissMissed", id),
	startSession: (args: StartSessionArgs): Promise<void> =>
		ipcRenderer.invoke("buddy:startSession", args),
	pauseSession: (): Promise<void> => ipcRenderer.invoke("buddy:pauseSession"),
	resumeSession: (): Promise<void> => ipcRenderer.invoke("buddy:resumeSession"),
	endSession: (): Promise<void> => ipcRenderer.invoke("buddy:endSession"),
	startFocus: (minutes: number): Promise<void> => ipcRenderer.invoke("buddy:startFocus", minutes),
	endFocus: (): Promise<void> => ipcRenderer.invoke("buddy:endFocus"),
	startReset: (): Promise<void> => ipcRenderer.invoke("buddy:startReset"),
	endReset: (): Promise<void> => ipcRenderer.invoke("buddy:endReset"),
	updateSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
		ipcRenderer.invoke("buddy:updateSettings", patch),
	resetData: (): Promise<void> => ipcRenderer.invoke("buddy:resetData"),
	closePopup: (): Promise<void> => ipcRenderer.invoke("buddy:closePopup"),
	showBuddy: (): Promise<void> => ipcRenderer.invoke("buddy:showBuddy"),
	movePopup: (x: number, y: number): Promise<void> => ipcRenderer.invoke("buddy:movePopup", x, y),
	openQuickAdd: (): Promise<void> => ipcRenderer.invoke("buddy:openQuickAdd"),
	closeQuickAdd: (): Promise<void> => ipcRenderer.invoke("buddy:closeQuickAdd"),
	openDashboard: (): Promise<void> => ipcRenderer.invoke("buddy:openDashboard"),
	onSnapshot: (listener: (snapshot: DashboardSnapshot) => void): (() => void) => {
		const handler = (_event: unknown, snapshot: DashboardSnapshot) => listener(snapshot)
		ipcRenderer.on("buddy:snapshot", handler)
		return () => ipcRenderer.removeListener("buddy:snapshot", handler)
	},
}

export type BuddyApi = typeof api

contextBridge.exposeInMainWorld("buddy", api)
