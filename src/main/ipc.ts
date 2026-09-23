import { ipcMain } from "electron"
import type {
	AppSettings,
	BuddyActionId,
	ReminderCreateInput,
	ReminderUpdateInput,
} from "@shared/types"
import type { BuddyCore } from "./core"
import { SESSION_PRESETS } from "./services/SessionService"
import { hidePopupWindow, hideQuickAdd, movePopupWindow, showBuddyOnScreen, showDashboard, showQuickAdd } from "./windows"

type StartSessionArgs =
	| { preset: "classic" | "deep" }
	| { preset: "custom"; workMinutes: number; breakMinutes: number; cycles: number }

/** The renderer never touches services directly - everything goes through here. */
export function registerIpc(core: BuddyCore): void {
	ipcMain.handle("buddy:getSnapshot", () => core.snapshot())
	ipcMain.handle("buddy:listReminders", () => core.reminders.list())
	ipcMain.handle("buddy:presets", () => SESSION_PRESETS)

	ipcMain.handle("buddy:action", (_event, action: BuddyActionId, reminderId?: string | null) => {
		core.handleAction(action, reminderId ?? null)
	})

	ipcMain.handle("buddy:createReminder", (_event, input: ReminderCreateInput) =>
		core.createReminder(input),
	)
	ipcMain.handle("buddy:updateReminder", (_event, id: string, patch: ReminderUpdateInput) =>
		core.updateReminder(id, patch),
	)
	ipcMain.handle("buddy:deleteReminder", (_event, id: string) => core.deleteReminder(id))
	ipcMain.handle("buddy:duplicateReminder", (_event, id: string) => core.duplicateReminder(id))
	ipcMain.handle("buddy:snoozeReminder", (_event, id: string, minutes: number) =>
		core.snoozeReminder(id, minutes),
	)
	ipcMain.handle("buddy:dismissMissed", (_event, id: string) => core.dismissMissed(id))

	ipcMain.handle("buddy:startSession", (_event, args: StartSessionArgs) => core.startSession(args))
	ipcMain.handle("buddy:pauseSession", () => core.pauseSession())
	ipcMain.handle("buddy:resumeSession", () => core.resumeSession())
	ipcMain.handle("buddy:endSession", () => core.endSession())

	ipcMain.handle("buddy:startFocus", (_event, minutes: number) => core.startFocus(minutes))
	ipcMain.handle("buddy:endFocus", () => core.endFocus())

	ipcMain.handle("buddy:startReset", () => core.startReset())
	ipcMain.handle("buddy:endReset", () => core.endReset())

	ipcMain.handle("buddy:updateSettings", (_event, patch: Partial<AppSettings>) =>
		core.updateSettings(patch),
	)
	ipcMain.handle("buddy:resetData", () => core.resetData())

	ipcMain.handle("buddy:closePopup", () => hidePopupWindow())
	ipcMain.handle("buddy:showBuddy", () => showBuddyOnScreen())
	ipcMain.handle("buddy:movePopup", (_event, x: number, y: number) => movePopupWindow(x, y))
	ipcMain.handle("buddy:openQuickAdd", () => showQuickAdd())
	ipcMain.handle("buddy:closeQuickAdd", () => hideQuickAdd())
	ipcMain.handle("buddy:openDashboard", () => showDashboard())
}
