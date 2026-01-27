import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { DateTimePicker } from "~/components/ui/date-time-picker";
import { ItemPicker } from "~/components/common/pickers/item-picker";
import { SlotCascaderPicker } from "~/components/common/pickers/slot-cascader-picker";
import { OperatorPicker } from "~/components/common/pickers/operator-picker";
import { ImagePicker } from "~/components/common/image-picker";
import { usePhotoList } from "~/lib/use-photo-list";
import type { OutboundFormValues, SlotPickerValue } from "../types";

import { ConfirmButton } from "~/components/common/confirm-button";

import { useSession } from "~/lib/auth";
type Props = {
  onClose?: () => void;
  form?: UseFormReturn<OutboundFormValues>;
};

export default function OutboundForm({ onClose, form: externalForm }: Props) {
  const actorOperatorId = useSession()?.actor_operator_id || "";
  const form = externalForm ?? useForm<OutboundFormValues>({ defaultValues: { item_id: "", from_slot_id: "", qty: 0, occurred_at: "", operator_id: actorOperatorId, note: "" } });
  const [localSource, setLocalSource] = useState<SlotPickerValue>({ warehouseId: "", rackId: "", levelNo: "", slotId: form.getValues("from_slot_id") || "" });
  const source = localSource;
  const setSource = setLocalSource;
  const stockQty = Math.max(0, Number(form.getValues("qty") ?? 0));
  const [outboundQty, setOutboundQty] = useState<number>(0);

  useEffect(() => {
    // 当库存数量变化时，重置出库数量，避免沿用旧值
    setOutboundQty(0);
    // 仅依赖库存数量即可
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockQty]);

  const { paths: selectedPaths, setPaths: setSelectedPaths, reset: resetSelectedPaths } = usePhotoList();

  const submitLocal = async () => {
    try {
      const ok = await form.trigger();
      if (!ok) return false;
      // const values = form.getValues();
      // 出库数量使用本地 outboundQty，库存上限来自 form.qty
      // implement outbound submit if needed; placeholder calls
      // TODO: call tauriInvoke("create_outbound", ...)
      toast.success("出库提交（本地实现）");
      if (onClose) onClose();
      form.reset({ item_id: "", from_slot_id: "", qty: 0, occurred_at: "", operator_id: "", note: "" });
      setOutboundQty(0);
      resetSelectedPaths();
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
        <FormField control={form.control} name="qty" rules={{ validate: () => {
          if (stockQty <= 0) return "当前库存不足";
          if (!(outboundQty > 0)) return "请输入有效数量";
          return outboundQty <= stockQty ? true : `数量不能超过库存（${stockQty}）`;
        } }} render={() => (
          <FormItem className="grid gap-2">
            <FormLabel>数量</FormLabel>
            <FormControl>
              <Input
                placeholder={`最多 ${stockQty}`}
                type="number"
                min={1}
                max={stockQty}
                value={outboundQty}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  if (!Number.isFinite(nextValue)) {
                    setOutboundQty(0);
                    return;
                  }
                  const clamped = Math.min(Math.max(nextValue, 0), stockQty);
                  setOutboundQty(clamped);
                }}
              />
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
        <ImagePicker label="图片" photoType="txn" value={selectedPaths} onChange={setSelectedPaths} />
        <div className="grid gap-1 sm:grid-cols-1 md:col-span-2">
          <ConfirmButton className="w-full" label="提交" confirmText="确认提交？" onConfirm={async () => { await submitLocal(); }} />
        </div>
      </div>
    </Form>
  );
}
