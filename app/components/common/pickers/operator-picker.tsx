import { Combobox } from "~/components/common/combobox";
import { tauriInvoke } from "~/lib/tauri";
import { Badge } from "~/components/ui/badge";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type OperatorRow = { id: string; username: string; display_name: string; status: string };

type Props = {
  value: string;
  onChange: (value: string, node?: OperatorRow) => void;
  /**
   * 控制返回值使用哪一项：'id'（默认）|'username'|'display_name'
   */
  valueKey?: "id" | "username" | "display_name";
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
};

export function OperatorPicker({ value, onChange, valueKey = "id", disabled, placeholder = "记录人", searchPlaceholder = "搜索人员...", emptyText = "未找到人员" }: Props) {
  const [initialOptions, setInitialOptions] = useState<
    {
      value: string;
      label: ReactNode;
      searchLabel?: string;
      node?: OperatorRow;
    }[]
  >([]);

  // 通用方法：根据 keyword 加载 operator 列表并返回 Combobox 选项数组
  async function fetchOperatorsList(
    keyword: string | undefined,
    pageSize = 50,
  ): Promise<
    {
      node?: OperatorRow;
      value: string;
      label: ReactNode;
      searchLabel?: string;
    }[]
  > {
    try {
      const result = await tauriInvoke<{ items: OperatorRow[] }>("list_operators", {
        query: { keyword: keyword || undefined, page_index: 1, page_size: pageSize },
      });
      return result.items
        .filter((o) => o.status === "active")
        .map((o) => ({
          node: o,
          value: valueKey === "username" ? o.username : valueKey === "display_name" ? o.display_name : o.id,
          label: (
            <span className="flex items-center gap-2">
              <Badge variant="secondary" className="shrink-0">
                {o.username}
              </Badge>
              <span className="truncate">{o.display_name}</span>
            </span>
          ) as unknown as ReactNode,
          searchLabel: `${o.username} ${o.display_name}`,
        }));
    } catch {
      return [];
    }
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!active) return;
      const opts = await fetchOperatorsList(value || undefined, 1);
      if (!active) return;
      // 当 value 有值但不在 opts 中时，额外拉取较大页的数据查找并加入
      if (value && !opts.some((o) => o.value === value)) {
        try {
          // 优先按 id 精确加载单项，减少模糊查询误判
          try {
            const single = await tauriInvoke<OperatorRow>("get_operator", { input: { id: value } });
            if (single && single.id) {
              const found = {
                node: single,
                value: valueKey === "username" ? single.username : valueKey === "display_name" ? single.display_name : single.id,
                label: (
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary" className="shrink-0">
                      {single.username}
                    </Badge>
                    <span className="truncate">{single.display_name}</span>
                  </span>
                ) as unknown as ReactNode,
                searchLabel: `${single.username} ${single.display_name}`,
              };
              setInitialOptions([found, ...opts]);
              onChange(found.value, found.node);
              return;
            }
          } catch {
            // ignore get_operator 失败，回退到模糊查询
          }
          // 使用 fetchOperatorsList 的默认 pageSize（50）并以 value 作为 keyword 查询
          const extraOpts = await fetchOperatorsList(value, 50);
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
        return await fetchOperatorsList(keyword || undefined, 50);
      }}
      disabled={disabled}
    />
  );
}
