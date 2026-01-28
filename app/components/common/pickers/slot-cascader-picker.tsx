import { Label } from "~/components/ui/label";
import { WarehousePicker } from "~/components/common/pickers/warehouse-picker";
import { RackPicker } from "~/components/common/pickers/rack-picker";
import { SlotPicker, type SlotRow } from "~/components/common/pickers/slot-picker";
import { Badge } from "~/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { tauriInvoke } from "~/lib/tauri";
import { useEffect, useState, useRef } from "react";

type Props = {
  label?: string;
  value: {
    warehouseId: string;
    rackId: string;
    levelNo: string;
    slotId: string;
  };
  onChange: (next: { warehouseId: string; rackId: string; levelNo: string; slotId: string }) => void;
  disabled?: boolean;
};

export function SlotCascaderPicker({ label, value, onChange, disabled }: Props) {
  // derive level options from selected rack via RackPicker is not exposed here,
  // so caller should ensure rack's level_count is available via rack selection. For simplicity,
  // we will render level options after rack selected by querying level_count using RackPicker's constraints.
  // To keep UI consistent, we compute level options length by attempting to parse number from value.levelNo when necessary.
  const [levelOptions, setLevelOptions] = useState<string[]>(value.rackId ? (value.levelNo ? [value.levelNo] : []) : []);
  // 本地状态用于在 fetch 后立即反映到子控件，减少竞态
  const [localValue, setLocalValue] = useState(value);

  // 当父组件外部 value 变化时同步本地状态
  // 但在我们本地刚刚通过 fetch 回填后会短暂跳过一次同步，避免父组件在同一时刻传入空值覆盖本地值（竞态）
  const skipSyncRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (skipSyncRef.current) return;
    setLocalValue(value);
  }, [value]);

  // 清理任何未完成的定时器
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!active) return;
      if (!value.slotId || value.levelNo) return;
      const single = await tauriInvoke<SlotRow>("get_slot", { input: { id: value.slotId } });
      if (!active) return;
      // 查询到 slot 后，通过 onChange 回填父组件数据，禁止直接修改 props
      if (single) {
        const wh = single.warehouse_id || "";
        const rk = single.rack_id || "";
        const lvl = single.level_no ? single.level_no.toString() : "";
        // 先更新本地状态并通知父组件。localValue 会立刻传给子控件，减少竞态。
        const nextFull = { warehouseId: wh, rackId: rk, levelNo: lvl, slotId: value.slotId || "" };

        localValue.rackId = rk;
        localValue.warehouseId = wh;
        localValue.levelNo = lvl;
        localValue.slotId = value.slotId;
        // 标记跳过下一次来自 props 的同步，防止父组件短时传回空值覆盖
        skipSyncRef.current = true;
        syncTimerRef.current = window.setTimeout(() => {
          skipSyncRef.current = false;
        }, 100);
        setLocalValue(nextFull);
        if (lvl) setLevelOptions([lvl]);
        // 通知父组件（一次性回填完整数据）
        onChange(nextFull);
        // 清理计时器将在组件卸载时处理
      }
    })();
    return () => {
      active = false;
    };
  }, [value.slotId, onChange]);

  return (
    <div className="grid gap-2 md:col-span-2">
      {label ? <Label>{label}</Label> : null}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <WarehousePicker
          value={localValue.warehouseId}
          onChange={(next) => {
            // 当仓库值相同，仍回传合并后的 nv（保留其他字段），避免子组件初始化清空父级状态
            if (next === localValue.warehouseId) {
              const nv = { ...localValue };
              setLocalValue(nv);
              return;
            }
            const nv = { warehouseId: next, rackId: "", levelNo: "", slotId: "" };
            setLocalValue(nv);
            setLevelOptions([]);
            onChange(nv);
          }}
          disabled={disabled}
        />
        <RackPicker
          warehouseId={localValue.warehouseId}
          value={localValue.rackId}
          onChange={(next, node) => {
            // 当货架值相同时，仍回传合并后的 nv（保留其他字段）以避免子组件初始化清空
            if (next === localValue.rackId) {
              const nextLevels = node && node.level_count ? Array.from({ length: node.level_count }, (_, i) => (i + 1).toString()) : [];
              setLevelOptions(nextLevels);
              const nvSame = { warehouseId: localValue.warehouseId, rackId: next, levelNo: localValue.levelNo, slotId: localValue.slotId };
              setLocalValue(nvSame);
              return;
            }
            const nextLevels = node && node.level_count ? Array.from({ length: node.level_count }, (_, i) => (i + 1).toString()) : [];
            setLevelOptions(nextLevels);
            const nv = { warehouseId: localValue.warehouseId, rackId: next, levelNo: "", slotId: "" };
            setLocalValue(nv);
            onChange(nv);
          }}
          valueKey="id"
          disabled={!localValue.warehouseId || disabled}
        />
        <Select
          value={localValue.levelNo}
          onValueChange={(next) => {
            if (next === localValue.levelNo) {
              const nvSame = { warehouseId: localValue.warehouseId, rackId: localValue.rackId, levelNo: next, slotId: localValue.slotId };
              setLocalValue(nvSame);
              return;
            }
            const nv = { warehouseId: localValue.warehouseId, rackId: localValue.rackId, levelNo: next, slotId: "" };
            setLocalValue(nv);
            onChange(nv);
          }}
          disabled={!localValue.rackId || disabled}
        >
          <SelectTrigger className="w-full min-w-0">
            <SelectValue placeholder="层数" />
          </SelectTrigger>
          <SelectContent>
            {levelOptions.map((level) => (
              <SelectItem key={level} value={level}>
                <Badge variant="secondary" className="shrink-0">
                  {level}层
                </Badge>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SlotPicker
          value={localValue.slotId}
          onChange={(next) => {
            if (next === localValue.slotId) {
              const nvSame = { warehouseId: localValue.warehouseId, rackId: localValue.rackId, levelNo: localValue.levelNo, slotId: next };
              setLocalValue(nvSame);
              return;
            }
            const nv = { warehouseId: localValue.warehouseId, rackId: localValue.rackId, levelNo: localValue.levelNo, slotId: next };
            setLocalValue(nv);
            onChange(nv);
          }}
          warehouseId={localValue.warehouseId}
          rackId={localValue.rackId}
          levelNo={localValue.levelNo}
          disabled={!localValue.levelNo || disabled}
        />
      </div>
    </div>
  );
}

export default SlotCascaderPicker;
