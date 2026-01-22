import { Combobox } from "~/components/common/combobox";
import { tauriInvoke } from "~/lib/tauri";
import { Badge } from "~/components/ui/badge";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type RackRow = { id: string; code: string; name: string; status: string; warehouse_id?: string | null, level_count?: number | null };

type Props = {
  value: string;
  onChange: (value: string, node?: RackRow) => void;
  warehouseId?: string;
  /**
   * 控制返回值使用哪一项：'id' 返回货架 id（默认），'code' 返回货架 code
   */
  valueKey?: "id" | "code";
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
};

export function RackPicker({ value, onChange, warehouseId, valueKey = "id", disabled, placeholder = "货架", searchPlaceholder = "搜索货架...", emptyText = "未找到货架" }: Props) {
  const [initialOptions, setInitialOptions] = useState<
    {
      node?: RackRow;
      value: string;
      label: ReactNode;
      searchLabel?: string;
    }[]
  >([]);

  // 通用方法：根据 keyword 和 warehouseId 加载货架列表并返回 Combobox 选项数组
  async function fetchRacks(
    keyword: string | undefined,
    pageSize = 200,
  ): Promise<
    {
      node?: RackRow;
      value: string;
      label: ReactNode;
      searchLabel?: string;
    }[]
  > {
    if (!warehouseId) return [];
    try {
      const result = await tauriInvoke<{ items: RackRow[] }>("list_racks", {
        input: { keyword: keyword || undefined, warehouse_id: warehouseId, status: "active", page_index: 1, page_size: pageSize },
      });
      const items = result.items
        .filter((r) => r.status === "active" && r.warehouse_id === warehouseId)
        .map((r) => ({
          node: r,
          value: valueKey === "code" ? r.code : r.id,
          label: (
            <span className="flex items-center gap-2">
              <Badge variant="secondary" className="shrink-0">
                {r.code}
              </Badge>
              <span className="truncate">{r.name}</span>
            </span>
          ) as unknown as ReactNode,
          searchLabel: `${r.code} ${r.name}`,
        }));
      return items;
    } catch {
      return [];
    }
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!active) return;
      const opts = await fetchRacks(value || undefined, 1);
      if (!active) return;
      // value 存在但未包含于 opts 时，尝试额外加载该仓库下的货架并加入
      if (value && !opts.some((o) => o.value === value)) {
        try {
          // 优先尝试按 id 精确加载货架，支持 warehouseId 约束
          try {
            const single = await tauriInvoke<RackRow>("get_rack", { input: { id: value, warehouse_id: warehouseId } });
            if (single && single.id) {
              const found = {
                node: single,
                value: valueKey === "code" ? single.code : single.id,
                label: (
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary" className="shrink-0">
                      {single.code}
                    </Badge>
                    <span className="truncate">{single.name}</span>
                  </span>
                ) as unknown as ReactNode,
                searchLabel: `${single.code} ${single.name}`,
              };
              setInitialOptions([found, ...opts]);
              onChange(found.value, found.node)
              return;
            }
          } catch {
            // ignore get_rack 失败，回退到模糊查询
          }
          // 使用 fetchRacks 的默认 pageSize（200）并以 value 作为 keyword 查询
          const extraOpts = await fetchRacks(value, 200);
          const found = extraOpts.find((o) => o.value === value);
          if (found) {
            setInitialOptions([found, ...opts]);
            onChange(found.value, found.node);
            return;
          }
        } catch {
          // ignore
        }
      }
      setInitialOptions(opts);
    })();
    return () => {
      active = false;
    };
  }, [value, warehouseId, valueKey]);

  return (
    <Combobox
      options={initialOptions}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      onSearch={async (keyword: string) => {
        return await fetchRacks(keyword || undefined, 200);
      }}
      disabled={disabled || !warehouseId}
    />
  );
}
