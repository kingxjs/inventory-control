import { Combobox } from "~/components/common/combobox";
import { tauriInvoke } from "~/lib/tauri";
import { Badge } from "~/components/ui/badge";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type WarehouseRow = { id: string; code: string; name: string; status: string };

type Props = {
  value: string;
  onChange: (value: string, node?: WarehouseRow) => void;
  /**
   * 控制返回值使用哪一项：'id' 返回仓库 id（默认），'code' 返回仓库 code
   */
  valueKey?: "id" | "code";
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
};

export function WarehousePicker({ value, onChange, valueKey = "id", disabled, placeholder = "仓库", searchPlaceholder = "搜索仓库...", emptyText = "未找到仓库" }: Props) {
  const [initialOptions, setInitialOptions] = useState<
    {
      node?: WarehouseRow;
      value: string;
      label: ReactNode;
      searchLabel?: string;
    }[]
  >([]);

  // 通用方法：根据 keyword 加载仓库列表并返回 Combobox 选项项数组
  async function fetchWarehouses(
    keyword: string | undefined,
    pageSize = 50,
  ): Promise<
    {
      node?: WarehouseRow;
      value: string;
      label: ReactNode;
      searchLabel?: string;
    }[]
  > {
    try {
      const result = await tauriInvoke<{ items: WarehouseRow[] }>("list_warehouses", {
        input: { keyword: keyword || undefined, status: "active", page_index: 1, page_size: pageSize },
      });
      return result.items.map((w) => ({
        node: w,
        value: valueKey === "code" ? w.code : w.id,
        label: (
          <span className="flex items-center gap-2">
            <Badge variant="secondary" className="shrink-0">
              {w.code}
            </Badge>
            <span className="truncate">{w.name}</span>
          </span>
        ) as unknown as ReactNode,
        searchLabel: `${w.code} ${w.name}`,
      }));
    } catch {
      return [];
    }
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!active) return;
      const opts = await fetchWarehouses(value || undefined, 1);
      if (!active) return;
      // 如果 value 有值但未包含在 opts 中，尝试额外加载该项并加入 options，确保 label 能显示
      if (value && !opts.some((o) => o.value === value)) {
        try {
          // 优先按 id 精确加载单项，减少模糊查询误判
          try {
            const single = await tauriInvoke<WarehouseRow>("get_warehouse", { input: { id: value } });
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
              onChange(found.value, found.node);
              return;
            }
          } catch {
            // ignore get_warehouse 失败，回退到模糊搜索
          }
          // 使用原来的 pageSize（fetchWarehouses 的默认 50）并根据 value 作为 keyword 查询
          const extraOpts = await fetchWarehouses(value, 50);
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
  }, [value, valueKey]);
  return (
    <Combobox
      options={initialOptions}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      onSearch={async (keyword: string) => {
        return await fetchWarehouses(keyword || undefined, 50);
      }}
      disabled={disabled}
    />
  );
}
