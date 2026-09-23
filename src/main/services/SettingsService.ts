import Store from "electron-store"
import { DEFAULT_SETTINGS, type AppSettings } from "@shared/types"

/** Settings persist locally; missing keys fall back to defaults (section 6.11). */
export class SettingsService {
	private store = new Store<{ settings: AppSettings }>({
		name: "desktop-buddy-settings",
		defaults: { settings: DEFAULT_SETTINGS },
	})

	get(): AppSettings {
		return { ...DEFAULT_SETTINGS, ...this.store.get("settings") }
	}

	update(patch: Partial<AppSettings>): AppSettings {
		const next = { ...this.get(), ...patch }
		this.store.set("settings", next)
		return next
	}

	reset(): AppSettings {
		this.store.set("settings", DEFAULT_SETTINGS)
		return { ...DEFAULT_SETTINGS }
	}
}
