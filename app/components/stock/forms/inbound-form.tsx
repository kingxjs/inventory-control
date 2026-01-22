import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { open as tauriOpen } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { DateTimePicker } from "~/components/ui/date-time-picker";
import { ItemPicker } from "~/components/common/pickers/item-picker";
import { SlotCascaderPicker } from "~/components/common/pickers/slot-cascader-picker";
import { OperatorPicker } from "~/components/common/pickers/operator-picker";
import { ImagePicker } from "~/components/common/image-picker";
import { tauriInvoke } from "~/lib/tauri";
import type { InboundFormValues, SlotPickerValue, StockSlotItem } from "../types";
import { getItemListBySlotId } from "../helpers";

import { ConfirmButton } from "~/components/common/confirm-button";

import {  getSession } from "~/lib/auth";
type Props = {
  onClose?: () => void;
  form?: UseFormReturn<InboundFormValues>;
};


export default function InboundForm({ onClose, form: externalForm }: Props) {
  const form = externalForm ?? useForm<InboundFormValues>({
    defaultValues: { item_id: "", to_slot_id: "", qty: "", occurred_at: "", operator_id: getSession()?.actor_operator_id || "", note: "" },
  });
  const [localTarget, setLocalTarget] = useState<SlotPickerValue>({ warehouseId: "", rackId: "", levelNo: "", slotId: "" });
  const target = localTarget;
  const setTarget = setLocalTarget;

  const [localSelectedPaths, setLocalSelectedPaths] = useState<string[]>([]);
  const [localPreviewUrls, setLocalPreviewUrls] = useState<Record<string, string>>({});
  const pickPhotos = async () => {
    const selected = await tauriOpen({ multiple: true, filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "bmp"] }] });
    if (!selected) return;
    const filePaths = Array.isArray(selected) ? selected : [selected];
    setLocalSelectedPaths((prev) => [...prev, ...filePaths]);
  };
  const removePhoto = (path: string) => setLocalSelectedPaths((prev) => prev.filter((p) => p !== path));
  const selectedPaths = localSelectedPaths;
  const previewUrls = localPreviewUrls;

  const [inboundSlotItemsState, setInboundSlotItemsState] = useState<StockSlotItem[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      for (const path of selectedPaths) {
        if (!previewUrls[path]) {
          try {
            const bytes = await tauriInvoke<number[]>("read_photo_bytes", { input: { path } });
            const blob = new Blob([new Uint8Array(bytes)]);
            const url = URL.createObjectURL(blob);
            if (!active) return;
            setLocalPreviewUrls((prev) => ({ ...prev, [path]: url }));
          } catch (err) {
            toast.error("图片预览失败");
          }
        }
      }
    };
    load();
    return () => {
      active = false;
      Object.values(previewUrls).forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPaths.join("|")]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!target?.slotId) {
        setInboundSlotItemsState([]);
        return;
      }
      try {
        setInboundSlotItemsState(await getItemListBySlotId(target.slotId));
      } catch (err) {
        setInboundSlotItemsState([]);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [target?.slotId]);

  const submitLocal = async () => {
    try {
      const ok = await form.trigger();
      if (!ok) return false;
      const values = form.getValues();
      if (!values.item_id) {
        toast.error("请选择物品");
        return false;
      }
      const toSlotId = target?.slotId || values.to_slot_id || "";
      if (!toSlotId) {
        toast.error("请选择目标库位");
        return false;
      }
      const txnNo = await tauriInvoke<string>("create_inbound", {
        input: {
          item_id: values.item_id,
          to_slot_id: toSlotId,
          qty: Number(values.qty),
          occurred_at: Math.floor(new Date(values.occurred_at || Date.now()).getTime() / 1000),
          operator_id: values.operator_id || undefined,
          note: values.note || null,
        },
      });
      if (selectedPaths.length > 0) {
        try {
          await tauriInvoke("add_photos", {
            input: {
              photo_type: "txn",
              data_id: txnNo,
              src_paths: selectedPaths,
            },
          });
          toast.success("图片上传成功");
        } catch (_) {
          toast.error("图片上传失败");
        }
      }
      toast.success("入库成功");
      form.reset({ item_id: "", to_slot_id: "", qty: "", occurred_at: "", operator_id: "", note: "" });
      if (onClose) onClose();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "入库失败";
      toast.error(message);
      return false;
    }
  };


  return (
    <Form {...form}>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="item_id"
          rules={{ validate: (value) => (value ? true : "请选择物品") }}
          render={({ field }) => (
            <FormItem className="grid gap-2">
              <FormLabel>物品</FormLabel>
              <FormControl>
                <ItemPicker value={field.value} onChange={field.onChange} placeholder="选择物品" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="to_slot_id"
          rules={{ validate: (value) => (value ? true : "请选择目标库位") }}
          render={({ field }) => (
            <FormItem className="grid gap-2 md:col-span-2">
              <FormControl>
                <SlotCascaderPicker
                  label="库位"
                  value={target}
                  onChange={async (next) => {
                    setTarget(next);
                    field.onChange(next.slotId || "");
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {target.slotId && inboundSlotItemsState.length > 0 ? (
          <div className="grid gap-2 md:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              {inboundSlotItemsState.map((row) => (
                <div key={`${row.slot_id}-${row.item_code}`}>
                  <div className="flex items-center gap-2">
                    <span className="truncate">{row.item_name}</span>
                    <span>× {row.qty}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {/* qty/operator/occurred_at/note */}
        <FormField control={form.control} name="qty" rules={{ validate: (value) => (Number(value) > 0 ? true : "请输入有效数量") }} render={({ field }) => (
          <FormItem className="grid gap-2">
            <FormLabel>数量</FormLabel>
            <FormControl>
              <Input placeholder="请输入数量" type="number" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="operator_id" rules={{ validate: (value) => (value.trim() ? true : "请输入记录人") }} render={({ field }) => (
          <FormItem className="grid gap-2">
            <FormLabel>记录人</FormLabel>
            <FormControl>
              <OperatorPicker value={field.value} onChange={field.onChange} placeholder="选择记录人" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="occurred_at" rules={{ validate: (value) => (value.trim() ? true : "请选择发生时间") }} render={({ field }) => (
          <FormItem className="grid gap-2">
            <FormLabel>发生时间</FormLabel>
            <FormControl>
              <DateTimePicker value={field.value} onChange={field.onChange} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="note" render={({ field }) => (
          <FormItem className="grid gap-2 md:col-span-2">
            <FormLabel>备注</FormLabel>
            <FormControl>
              <Textarea placeholder="补充说明" {...field} />
            </FormControl>
          </FormItem>
        )} />
        <ImagePicker label="图片" selectedPaths={selectedPaths} previewUrls={previewUrls} onPick={pickPhotos} onRemove={removePhoto} />
        <div className="grid gap-1 sm:grid-cols-1">
          <ConfirmButton className="w-full" label="提交" confirmText="确认提交？" onConfirm={async () => { await submitLocal(); }} />
        </div>
      </div>
    </Form>
  );
}
