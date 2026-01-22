import { Combobox } from "~/components/common/combobox";
import { tauriInvoke } from "~/lib/tauri";
import { Badge } from "~/components/ui/badge";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type ItemRow = { id: string; item_code: string; name: string; status: string };

type Props = {
  value: string;
  onChange: (value: string, node?: ItemRow) => void;
  /** 返回值键：'id'（默认）|'item_code' */
  valueKey?: "id" | "item_code";
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
};

export function ItemPicker({ value, onChange, valueKey = "id", disabled, placeholder = "物品", searchPlaceholder = "搜索物品...", emptyText = "未找到物品" }: Props) {
  const [initialOptions, setInitialOptions] = useState<
    {
      node?: ItemRow;
      value: string;
      label: ReactNode;
      searchLabel?: string;
    }[]
  >([]);

  // 通用方法：根据 keyword 加载物品列表并返回 Combobox 选项数组
  async function fetchItems(
    keyword: string | undefined,
    pageSize = 50,
  ): Promise<
    {
      node?: ItemRow;
      value: string;
      label: ReactNode;
      searchLabel?: string;
    }[]
  > {
    try {
      const result = await tauriInvoke<{ items: ItemRow[] }>("list_items", {
        query: { keyword: keyword || undefined, page_index: 1, page_size: pageSize },
      });
      return result.items
        .filter((i) => i.status === "active")
        .map((i) => ({
          node: i,
          value: valueKey === "item_code" ? i.item_code : i.id,
          label: (
            <span className="flex items-center gap-2">
              <Badge variant="secondary" className="shrink-0">
                {i.item_code}
              </Badge>
              <span className="truncate">{i.name}</span>
            </span>
          ) as unknown as ReactNode,
          searchLabel: `${i.item_code} ${i.name}`,
        }));
    } catch {
      return [];
    }
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!active) return;
      const opts = await fetchItems(value || undefined, 1);
      if (!active) return;
      // 如果 value 有值但未包含在 opts 中，尝试按 id 精确加载单项以显示 label
      if (value && !opts.some((o) => o.value === value)) {
        try {
          try {
            const single = await tauriInvoke<ItemRow>("get_item", { input: { id: value } });
            if (single && (single as any).id) {
              const found = {
                node: single,
                value: valueKey === "item_code" ? single.item_code : single.id,
                label: (
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary" className="shrink-0">
                      {single.item_code}
                    </Badge>
                    <span className="truncate">{single.name}</span>
                  </span>
                ) as unknown as ReactNode,
                searchLabel: `${single.item_code} ${single.name}`,
              };
              setInitialOptions([found, ...opts]);
              onChange(found.value, found.node);
              return;
            }
          } catch {
            // ignore get_item 失败，回退到模糊查询
          }
          const extraOpts = await fetchItems(value, 50);
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
  }, [value]);

  return (
    <Combobox
      options={initialOptions}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      onSearch={async (keyword: string) => {
        return await fetchItems(keyword || undefined, 50);
      }}
      disabled={disabled}
    />
  );
}
