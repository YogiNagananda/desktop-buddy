import type { UpNextItem } from "@shared/types"
import { formatClock } from "../useSnapshot"

/** A quiet read-only view of what is still planned for today. */
export function Timeline({ items }: { items: UpNextItem[] }) {
	return (
		<section className="card">
			<h3 className="card__title">Rest of today</h3>
			{items.length === 0 ? (
				<p className="muted">Nothing else planned today.</p>
			) : (
				<ol className="timeline">
					{items.map((item) => (
						<li className="timeline__row" key={item.id + item.at}>
							<span className="timeline__time">{formatClock(item.at)}</span>
							<span className="timeline__dot" />
							<span>{item.label}</span>
						</li>
					))}
				</ol>
			)}
		</section>
	)
}
