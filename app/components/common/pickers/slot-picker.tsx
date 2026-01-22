import { useEffect, useState, useRef } from "react";
import type { ReactNode } from "react";
import { Badge } from "~/components/ui/badge";
import { Combobox } from "~/components/common/combobox";
import { tauriInvoke } from "~/lib/tauri";

export type SlotRow = {
  id: string;
  slot_no: number;
  code: string;
  status: string;
  rack_id: string | null;
  level_no: number | null;
  warehouse_id: string | null;
};

type Props = {
  value: string;
  onChange: (value: string, node?: SlotRow) => void;
  /** 可选的上下文过滤：优先使用 rackId，其次 warehouseId */
  warehouseId?: string;
  rackId?: string;
  levelNo?: string;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
};

export function SlotPicker({ value, onChange, warehouseId, rackId, levelNo, disabled, placeholder = "格位", searchPlaceholder = "搜索格位...", emptyText = "未找到格位" }: Props) {
  const [options, setOptions] = useState<{ node?: SlotRow; value: string; label: ReactNode; searchLabel?: string }[]>([]);
  const [initialOptions, setInitialOptions] = useState<{ node?: SlotRow; value: string; label: ReactNode; searchLabel?: string }[]>([]);

  async function fetchSlots(keyword: string | undefined, pageSize = 200) {
    console.info(1,rackId ,warehouseId);
    // 需要至少有 rackId 或 warehouseId 以便限定范围
    if (!rackId && !warehouseId) return [];
    try {
      const query: any = { page_index: 1, page_size: pageSize };
      if (rackId) query.rack_id = rackId;
      else if (warehouseId) query.warehouse_id = warehouseId;
      if (levelNo) query.level_no = Number(levelNo);
      if (keyword) query.keyword = keyword;
      const result = await tauriInvoke<{ items: SlotRow[] }>("list_slots", { query });
      const list = result.items.filter((s) => s.status === "active");
      return list.map((s) => ({
        node: s,
        value: s.id,
        label: (
          <span className="flex items-center gap-2">
            <Badge variant="secondary" className="shrink-0">
              {s.slot_no}格
            </Badge>
            <span className="truncate">{s.code}</span>
          </span>
        ) as unknown as ReactNode,
        searchLabel: s.code,
      }));
    } catch {
      return [];
    }
  }
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!active) return;
      if (!value && !rackId && !warehouseId) {
        setOptions([]);
        setInitialOptions([]);
        return;
      }
      const opts = await fetchSlots(undefined, 50);
      if (!active) return;
      // 若 value（slot id）存在但不在 opts 中，尝试按 id 精确加载
      if (value && !opts.some((o) => o.value === value)) {
        try {
          const single = await tauriInvoke<SlotRow | null>("get_slot", { input: { id: value, rack_id: rackId || undefined, warehouse_id: warehouseId || undefined } });
          if (single && single.id) {
            const found = {
              node: single,
              value: single.id,
              label: (
                <span className="flex items-center gap-2">
                  <Badge variant="secondary" className="shrink-0">
                    {single.slot_no}格
                  </Badge>
                  <span className="truncate">{single.code}</span>
                </span>
              ) as unknown as ReactNode,
              searchLabel: single.code,
            };
            setInitialOptions([found, ...opts]);
            onChange(found.value, found.node);
            setOptions((prev) => (prev.some((p) => p.value === found.value) ? prev : [found, ...prev]));
            return;
          }
        } catch {
          // ignore
        }
        // 回退到使用 keyword 查询
        const extra = await fetchSlots(value, 200);
        const found = extra.find((o) => o.value === value);
        if (found) {
          setInitialOptions([found, ...opts]);
          onChange(found.value, found.node);
          setOptions((prev) => (prev.some((p) => p.value === found.value) ? prev : [found, ...prev]));
          return;
        }
      }
      setInitialOptions(opts);
    })();
    return () => {
      active = false;
    };
  }, [value, rackId, levelNo, warehouseId]);

  return (
    <Combobox
      options={initialOptions}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      onSearch={async (keyword: string) => {
        return await fetchSlots(keyword || undefined, 200);
      }}
      disabled={disabled || (!rackId && !warehouseId)}
    />
  );
}
