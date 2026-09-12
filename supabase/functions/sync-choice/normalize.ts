export type NormalizedPlatform = "BOLT" | "WOLT" | "DAMEJIDLO" | "choice";

export function platformOf(order: Record<string, unknown>): NormalizedPlatform {
  const external = order.external as Record<string, unknown> | undefined;
  const data = external?.data as Record<string, unknown> | undefined;
  const raw = typeof data?.partnerName === "string" ? data.partnerName.trim().toUpperCase() : "";
  if (raw.includes("BOLT")) return "BOLT";
  if (raw.includes("WOLT")) return "WOLT";
  if (raw.includes("DAME") || raw.includes("DÁME") || raw.includes("FOODORA")) return "DAMEJIDLO";
  return "choice";
}

export function normalizedOrder(order: Record<string, unknown>, now = new Date()) {
  const place = order.place as Record<string, unknown> | undefined;
  const rawItems = Array.isArray(order.items) ? order.items as Record<string, unknown>[] : [];
  const items = rawItems.map(item => {
    const names = item.name as Record<string, unknown> | undefined;
    const cz = names?.cz as Record<string, unknown> | undefined;
    const en = names?.en as Record<string, unknown> | undefined;
    const name = (typeof cz?.name === "string" && cz.name.trim()) || (typeof en?.name === "string" && en.name.trim()) || "Без названия";
    const quantity = Number(item.quantity ?? item.count ?? 1);
    return { name, quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1 };
  });
  const id = order.id ?? order.uuid ?? order.orderId;
  const orderedAt = order.createdAt ?? order.created_at ?? order.closedAt ?? order.date;
  if (id == null || typeof orderedAt !== "string" || Number.isNaN(Date.parse(orderedAt))) return null;
  const totalMinor = Number(order.total);
  if (!Number.isFinite(totalMinor)) return null;
  const branchName = typeof place?.name === "string" ? place.name.trim() : "";
  if (!branchName) return null;
  return {
    order_id: String(id),
    ordered_at: new Date(orderedAt).toISOString(),
    branch_id: place?.id == null ? null : String(place.id),
    branch_name: branchName,
    platform: platformOf(order),
    total: totalMinor / 100,
    item_count: items.reduce((sum, item) => sum + item.quantity, 0),
    items,
    updated_at: now.toISOString(),
  };
}
