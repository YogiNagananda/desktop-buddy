import { BrowserWindow, app, screen, shell } from "electron"
import { join } from "node:path"

const preload = join(__dirname, "../preload/preload.js")
const devServer = process.env["ELECTRON_RENDERER_URL"]
const isDev = !app.isPackaged && Boolean(devServer)

let dashboard: BrowserWindow | null = null
let popup: BrowserWindow | null = null
let quickAdd: BrowserWindow | null = null

function load(window: BrowserWindow, page: "index" | "popup" | "quickadd"): void {
	if (isDev) {
		void window.loadURL(devServer + "/" + page + ".html")
	} else {
		void window.loadFile(join(__dirname, "../renderer/" + page + ".html"))
	}
}

export function createDashboard(show: boolean): BrowserWindow {
	if (dashboard && !dashboard.isDestroyed()) {
		if (show) dashboard.show()
		return dashboard
	}
	dashboard = new BrowserWindow({
		width: 1040,
		height: 720,
		minWidth: 880,
		minHeight: 600,
		show: false,
		autoHideMenuBar: true,
		backgroundColor: "#ffffff",
		title: "Desktop Buddy",
		webPreferences: { preload, sandbox: false, contextIsolation: true, nodeIntegration: false },
	})
	dashboard.on("ready-to-show", () => {
		if (show) dashboard?.show()
	})
	// Closing the window only hides it - the buddy keeps running in the tray.
	dashboard.on("close", (event) => {
		if (!(app as unknown as { isQuitting?: boolean }).isQuitting) {
			event.preventDefault()
			dashboard?.hide()
		}
	})
	dashboard.webContents.setWindowOpenHandler(({ url }) => {
		void shell.openExternal(url)
		return { action: "deny" }
	})
	load(dashboard, "index")
	return dashboard
}

export function showDashboard(): void {
	const window = createDashboard(true)
	if (window.isMinimized()) window.restore()
	window.show()
	window.focus()
}

export function getDashboard(): BrowserWindow | null {
	return dashboard && !dashboard.isDestroyed() ? dashboard : null
}

/** The reminder popup: small, frameless, bottom-right, never stealing focus. */
export function showPopupWindow(sticky: boolean, allowOverFullscreen: boolean): BrowserWindow {
	const width = 240
	const height = 310
	const area = screen.getPrimaryDisplay().workArea

	if (!popup || popup.isDestroyed()) {
		popup = new BrowserWindow({
			width,
			height,
			show: false,
			frame: false,
			transparent: true,
			resizable: false,
			movable: true,
			skipTaskbar: true,
			focusable: true,
			acceptFirstMouse: true,
			alwaysOnTop: true,
			webPreferences: { preload, sandbox: false, contextIsolation: true, nodeIntegration: false },
		})
		popup.on("closed", () => {
			popup = null
		})
		load(popup, "popup")
	}

	popup.setBounds({
		x: area.x + area.width - width - 24,
		y: area.y + area.height - height - 24,
		width,
		height,
	})
	// "screen-saver" is the only level that can sit over a fullscreen app.
	popup.setAlwaysOnTop(true, allowOverFullscreen ? "screen-saver" : "floating")
	popup.setVisibleOnAllWorkspaces(allowOverFullscreen, { visibleOnFullScreen: allowOverFullscreen })
	popup.showInactive()
	if (sticky) popup.moveTop()
	return popup
}

/** Move the popup window to a new screen position (called via IPC drag). */
export function movePopupWindow(x: number, y: number): void {
	if (popup && !popup.isDestroyed()) {
		popup.setPosition(Math.round(x), Math.round(y))
	}
}

export function hidePopupWindow(): void {
	if (popup && !popup.isDestroyed()) popup.hide()
}

/** Show the buddy popup on demand (e.g. from the dashboard "Show Buddy" button). */
export function showBuddyOnScreen(): void {
	showPopupWindow(false, false)
}

export function showQuickAdd(): BrowserWindow {
	if (!quickAdd || quickAdd.isDestroyed()) {
		quickAdd = new BrowserWindow({
			width: 460,
			height: 260,
			show: false,
			frame: false,
			resizable: false,
			skipTaskbar: true,
			alwaysOnTop: true,
			webPreferences: { preload, sandbox: false, contextIsolation: true, nodeIntegration: false },
		})
		quickAdd.on("blur", () => quickAdd?.hide())
		quickAdd.on("closed", () => {
			quickAdd = null
		})
		load(quickAdd, "quickadd")
	}
	quickAdd.center()
	quickAdd.show()
	quickAdd.focus()
	return quickAdd
}

export function hideQuickAdd(): void {
	if (quickAdd && !quickAdd.isDestroyed()) quickAdd.hide()
}

export function allWindows(): BrowserWindow[] {
	return [dashboard, popup, quickAdd].filter(
		(window): window is BrowserWindow => Boolean(window) && !window!.isDestroyed(),
	)
}
