import { useEffect, useRef, useState } from "react"
import type { BuddyState } from "@shared/types"
import { clipUrlForState, isFallbackClip } from "@shared/assets"

type Props = { state: BuddyState; size?: number }

/**
 * Two stacked <video> elements cross-fade so a state change never flashes an
 * empty frame. The incoming clip is only revealed once it can actually play.
 */
export function Buddy({ state, size = 260 }: Props) {
	const [layers, setLayers] = useState<[BuddyState, BuddyState]>([state, state])
	const [front, setFront] = useState<0 | 1>(0)
	const incomingRef = useRef<HTMLVideoElement | null>(null)

	useEffect(() => {
		if (layers[front] === state) return
		const back = front === 0 ? 1 : 0
		setLayers((current) => {
			const next: [BuddyState, BuddyState] = [...current] as [BuddyState, BuddyState]
			next[back] = state
			return next
		})

		let done = false
		const swap = () => {
			if (done) return
			done = true
			setFront(back)
		}
		const video = incomingRef.current
		video?.addEventListener("canplay", swap, { once: true })
		// Fallback so a slow or undecodable clip cannot freeze the buddy.
		const timer = window.setTimeout(swap, 400)
		return () => {
			video?.removeEventListener("canplay", swap)
			window.clearTimeout(timer)
		}
	}, [state, front, layers])

	return (
		<div className="buddy" style={{ width: size, height: size }}>
			{layers.map((layerState, index) => (
				<video
					key={index}
					ref={index === front ? undefined : incomingRef}
					className={"buddy__clip" + (index === front ? " buddy__clip--front" : "")}
					src={clipUrlForState(layerState)}
					autoPlay
					loop
					muted
					playsInline
				/>
			))}
			{isFallbackClip(state) ? (
				<span className="buddy__note" title={"No dedicated clip for \"" + state + "\" yet"}>
					stand-in clip
				</span>
			) : null}
		</div>
	)
}
