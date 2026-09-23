import { Menu, Tray, app, nativeImage } from "electron"
import { join } from "node:path"
import type { BuddyState } from "@shared/types"
import { assetsRoot } from "./assetPath"
import { showDashboard, showQuickAdd } from "./windows"

export type TrayHooks = {
	startFocus: (minutes: number) => void
	endFocus: () => void
	startReset: () => void
	isFocusActive: () => boolean
	focusDefaults: () => number[]
}

let tray: Tray | null = null
let hooks: TrayHooks | null = null

function iconFor(state: BuddyState): Electron.NativeImage {
	const name =
		state === "warning"
			? "tray-warning.png"
			: state === "break" || state === "relaxing"
				? "tray-break.png"
				: state === "working"
					? "tray-working.png"
					: "tray-idle.png"
	return nativeImage.createFromPath(join(assetsRoot(), "tray", name))
}

function buildMenu(): Electron.Menu {
	const focusActive = hooks?.isFocusActive() ?? false
	const defaults = hooks?.focusDefaults() ?? [25, 50, 90]
	return Menu.buildFromTemplate([
		{ label: "Open Desktop Buddy", click: () => showDashboard() },
		{ label: "Remember This...", click: () => showQuickAdd() },
		{ type: "separator" },
		{ label: "2-Minute Reset", click: () => hooks?.startReset() },
		focusActive
			? { label: "End Focus Mode", click: () => hooks?.endFocus() }
			: {
					label: "Focus Mode",
					submenu: defaults.map((minutes) => ({
						label: minutes + " minutes",
						click: () => hooks?.startFocus(minutes),
					})),
				},
		{ type: "separator" },
		{
			label: "Quit",
			click: () => {
				;(app as unknown as { isQuitting?: boolean }).isQuitting = true
				app.quit()
			},
		},
	])
}

export function createTray(trayHooks: TrayHooks): void {
	hooks = trayHooks
	tray = new Tray(iconFor("idle"))
	tray.setToolTip("Desktop Buddy")
	tray.setContextMenu(buildMenu())
	tray.on("double-click", () => showDashboard())
}

export function updateTrayState(state: BuddyState, tooltip: string): void {
	if (!tray) return
	tray.setImage(iconFor(state))
	tray.setToolTip(tooltip)
	tray.setContextMenu(buildMenu())
}

export function destroyTray(): void {
	tray?.destroy()
	tray = null
}
