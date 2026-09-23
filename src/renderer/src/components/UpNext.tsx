import type { UpNextItem } from "@shared/types"
import { formatClock, relativeFromNow } from "../useSnapshot"

export function UpNext({ items }: { items: UpNextItem[] }) {
	return (
		<section className="card">
			<h3 className="card__title">Up next</h3>
			{items.length === 0 ? (
				<p className="muted">Nothing due. Enjoy the quiet.</p>
			) : (
				<ul className="list">
					{items.map((item) => (
						<li className="list__row" key={item.id + item.at}>
							<span className={"pill pill--" + item.priority}>{item.priority}</span>
							<span className="list__label">{item.label}</span>
							<span className="muted">
								{formatClock(item.at)} &middot; {relativeFromNow(item.at)}
							</span>
						</li>
					))}
				</ul>
			)}
		</section>
	)
}
