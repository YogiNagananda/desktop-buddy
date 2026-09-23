/// <reference types="vite/client" />
import type { BuddyApi } from "../../preload/preload"

declare global {
	interface Window {
		buddy: BuddyApi
	}
}

export {}
