import { tauriInvoke } from "~/lib/tauri";
import type { StockSlotItem } from "./types";

export async function getItemListBySlotId(slotId: string): Promise<StockSlotItem[]> {
  return tauriInvoke<{ items: Array<{ slot_id: string; item_code: string; item_name: string; qty: number }> }>("list_stock_by_slot", {
    input: {
      page_index: 1,
      page_size: 200,
      slot_id: slotId,
    },
  }).then((result) =>
    result.items.map((r) => ({
      slot_id: r.slot_id,
      item_code: r.item_code,
      item_name: r.item_name,
      qty: Number(r.qty),
    })),
  );
}
