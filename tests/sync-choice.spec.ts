import { describe, expect, it } from "vitest";
import { normalizedOrder, platformOf } from "../supabase/functions/sync-choice/normalize";

describe("ChoiceQR normalization", () => {
  it("reads the partner only from external.data.partnerName", () => {
    expect(platformOf({ external: { data: { partnerName: "bolt food" }, marketPlace: "WOLT" } })).toBe("BOLT");
    expect(platformOf({ external: { marketPlace: "WOLT" } })).toBe("choice");
    expect(platformOf({ external: { data: { partnerName: "unknown" } } })).toBe("choice");
  });

  it("converts total minor units and uses Czech then English dish names", () => {
    const result = normalizedOrder({
      id: 42,
      createdAt: "2026-09-12T10:30:00Z",
      total: 12345,
      place: { id: 7, name: "  Karlín  " },
      external: { data: { partnerName: "WOLT" } },
      items: [
        { quantity: 2, name: { cz: { name: "  Hranolky " }, en: { name: "Fries" } } },
        { count: 1, name: { en: { name: "Cheesesteak" } } },
      ],
    }, new Date("2026-09-12T11:00:00Z"));

    expect(result).toMatchObject({
      order_id: "42",
      branch_id: "7",
      branch_name: "Karlín",
      platform: "WOLT",
      total: 123.45,
      item_count: 3,
      items: [{ name: "Hranolky", quantity: 2 }, { name: "Cheesesteak", quantity: 1 }],
    });
  });
});
