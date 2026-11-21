import type { Item, OrderLine } from "@/lib/types";

export function ItemBadges({ item, line }: { item: Item; line?: OrderLine | null }) {
  return (
    <span className="flex flex-wrap gap-1">
      {item.priority ? <span className="badge badge-clay">Priority</span> : null}
      {item.listing === "estimated" ? <span className="badge badge-gold">Estimated</span> : null}
      {item.listing === "inferred" ? <span className="badge badge-sand">Inferred</span> : null}
      {item.otherPlatform ? <span className="badge badge-sand">Not on current menu</span> : null}
      {item.discontinued ? <span className="badge badge-out">Discontinued</span> : null}
      {line?.status === "ordered" ? <span className="badge badge-ok">Ordered</span> : null}
      {line?.status === "submitted" ? <span className="badge badge-clay">Sent</span> : null}
      {!line && item.stock === "low" ? <span className="badge badge-low">Low</span> : null}
      {!line && item.stock === "out" ? <span className="badge badge-out">Out</span> : null}
    </span>
  );
}
