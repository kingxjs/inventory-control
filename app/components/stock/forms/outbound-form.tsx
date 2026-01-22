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
import type { OutboundFormValues, SlotPickerValue } from "../types";

import { ConfirmButton } from "~/components/common/confirm-button";

import {  getSession } from "~/lib/auth";
type Props = {
  onClose?: () => void;
  form?: UseFormReturn<OutboundFormValues>;
};

export default function OutboundForm({ onClose, form: externalForm }: Props) {
  const form = externalForm ?? useForm<OutboundFormValues>({ defaultValues: { item_id: "", from_slot_id: "", qty: "", occurred_at: "", operator_id: getSession()?.actor_operator_id || "", note: "" } });
  const [localSource, setLocalSource] = useState<SlotPickerValue>({ warehouseId: "", rackId: "", levelNo: "", slotId: form.getValues("from_slot_id") || "" });
  const source = localSource;
  const setSource = setLocalSource;

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

  const submitLocal = async () => {
    try {
      const ok = await form.trigger();
      if (!ok) return false;
      const values = form.getValues();
      // implement outbound submit if needed; placeholder calls
      // TODO: call tauriInvoke("create_outbound", ...)
      toast.success("出库提交（本地实现）");
      if (onClose) onClose();
      form.reset({ item_id: "", from_slot_id: "", qty: "", occurred_at: "", operator_id: "", note: "" });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "出库失败";
      toast.error(message);
      return false;
    }
  };


  return (
    <Form {...form}>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField control={form.control} name="item_id" rules={{ validate: (value) => (value ? true : "请选择物品") }} render={({ field }) => (
          <FormItem className="grid gap-2">
            <FormLabel>物品</FormLabel>
            <FormControl>
              <ItemPicker value={field.value} onChange={field.onChange} placeholder="选择库存后自动带出" disabled />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="from_slot_id" rules={{ validate: (value) => (value ? true : "请选择来源位置") }} render={({ field }) => (
          <FormItem className="grid gap-2 md:col-span-2">
            <FormControl>
              <SlotCascaderPicker label="来源位置" value={source} onChange={(next) => { setSource(next); field.onChange(next.slotId || ""); }} disabled />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
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
