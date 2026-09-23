import { app } from "electron"
import { join } from "node:path"

/**
 * In development assets live beside the source tree; in a packaged build they
 * are copied next to the app via electron-builder extraResources.
 */
export function assetsRoot(): string {
	return app.isPackaged ? join(process.resourcesPath, "assets") : join(app.getAppPath(), "assets")
}
