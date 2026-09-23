import { globalShortcut } from "electron"
import { showQuickAdd } from "./windows"

/** Section 6.8 - "Remember This" is always at most three actions away. */
export const QUICK_ADD_ACCELERATOR = "CommandOrControl+Shift+B"

export function registerGlobalShortcuts(): boolean {
	return globalShortcut.register(QUICK_ADD_ACCELERATOR, () => showQuickAdd())
}

export function unregisterGlobalShortcuts(): void {
	globalShortcut.unregisterAll()
}
