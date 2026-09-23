import { app, net, protocol } from "electron"
import { join, normalize } from "node:path"
import { pathToFileURL } from "node:url"
import { ASSET_PROTOCOL } from "@shared/assets"
import { assetsRoot } from "./assetPath"
import { BuddyCore } from "./core"
import { registerIpc } from "./ipc"
import { createTray, destroyTray } from "./tray"
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from "./globalShortcuts"
import { createDashboard, showDashboard } from "./windows"

// Must run before app is ready so the renderer can fetch clips over the scheme.
protocol.registerSchemesAsPrivileged([
	{
		scheme: ASSET_PROTOCOL,
		privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
	},
])

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
	app.quit()
} else {
	let core: BuddyCore | null = null

	app.on("second-instance", () => showDashboard())

	void app.whenReady().then(() => {
		protocol.handle(ASSET_PROTOCOL, (request) => {
			const url = new URL(request.url)
			// host is the folder (e.g. "videos"), pathname the file.
			const relative = normalize(join(url.hostname, decodeURIComponent(url.pathname))).replace(
				/^(\.\.(\/|\\|$))+/,
				"",
			)
			return net.fetch(pathToFileURL(join(assetsRoot(), relative)).toString())
		})

		core = new BuddyCore()
		const settings = core.settings.get()
		registerIpc(core)
		createTray(core.trayHooks())
		registerGlobalShortcuts()
		app.setLoginItemSettings({ openAtLogin: settings.startWithWindows })
		createDashboard(!settings.startMinimized)
		core.start()
	})

	// The buddy lives in the tray: closing the last window must not quit.
	app.on("window-all-closed", () => {})

	app.on("before-quit", () => {
		;(app as unknown as { isQuitting?: boolean }).isQuitting = true
		unregisterGlobalShortcuts()
		destroyTray()
		core?.stop()
	})
}
