import type { BuddyState } from "./types"

/** Custom scheme registered in main.ts so clips play in dev and packaged builds. */
export const ASSET_PROTOCOL = "buddy-asset"

type ClipEntry = { file: string; fallback: boolean }

/**
 * Seven clips were delivered for nine states, so warning and reminder fall
 * back to idle rather than showing nothing (section 12.12).
 */
export const BUDDY_CLIPS: Record<BuddyState, ClipEntry> = {
	idle: { file: "video_resource_idle.webm", fallback: false },
	working: { file: "video_resource_working.webm", fallback: false },
	break: { file: "video_resource_break.webm", fallback: false },
	drinking: { file: "video_resource_drinking.webm", fallback: false },
	eating: { file: "video_resource_eating.webm", fallback: false },
	relaxing: { file: "video_resource_relaxing.webm", fallback: false },
	celebrating: { file: "video_resource_celebrating.webm", fallback: false },
	warning: { file: "video_resource_idle.webm", fallback: true },
	reminder: { file: "video_resource_idle.webm", fallback: true },
}

export function clipUrlForState(state: BuddyState): string {
	const entry = BUDDY_CLIPS[state] ?? BUDDY_CLIPS.idle
	return ASSET_PROTOCOL + "://videos/" + entry.file
}

export function isFallbackClip(state: BuddyState): boolean {
	return (BUDDY_CLIPS[state] ?? BUDDY_CLIPS.idle).fallback
}
