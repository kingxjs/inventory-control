import React, { useState } from "react";
import { useForm } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { DateTimePicker } from "~/components/ui/date-time-picker";
import { OperatorPicker } from "~/components/common/pickers/operator-picker";
import { ImagePicker } from "~/components/common/image-picker";
import { usePhotoList } from "~/lib/use-photo-list";
import { useSession } from "~/lib/auth";
import type { ReversalFormValues } from "../types";

import { ConfirmButton } from "~/components/common/confirm-button";

type Props = { onClose?: () => void; form?: UseFormReturn<ReversalFormValues> };

export default function ReversalForm({ onClose, form: externalForm }: Props) {
  const actorOperatorId = useSession()?.actor_operator_id || "";
  const form = externalForm ?? useForm<ReversalFormValues>({ defaultValues: { txn_no: "", occurred_at: "", operator_id: actorOperatorId, note: "" } });
  const { paths: selectedPaths, setPaths: setSelectedPaths, reset: resetSelectedPaths } = usePhotoList();

  const submitLocal = async () => {
    try {
      const ok = await form.trigger();
      if (!ok) return false;
      const values = form.getValues();
      // placeholder: implement reversal invocation
      toast.success("冲正提交（本地实现）");
      if (onClose) onClose();
      form.reset({ txn_no: "", occurred_at: "", operator_id: "", note: "" });
      resetSelectedPaths();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "冲正失败";
      toast.error(message);
      return false;
    }
  };

  return (
    <Form {...form}>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="txn_no"
          rules={{ validate: (value) => (value.trim() ? true : "请输入原流水号") }}
          render={({ field }) => (
            <FormItem className="grid gap-2">
              <FormLabel>原流水号</FormLabel>
              <FormControl>
                <Input placeholder="例如 TXN-240312-0012" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="operator_id"
          rules={{ validate: (value) => (value.trim() ? true : "请输入记录人") }}
          render={({ field }) => (
            <FormItem className="grid gap-2">
              <FormLabel>记录人</FormLabel>
              <FormControl>
                <OperatorPicker value={field.value} onChange={field.onChange} placeholder="选择记录人" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="occurred_at"
          rules={{ validate: (value) => (value.trim() ? true : "请选择发生时间") }}
          render={({ field }) => (
            <FormItem className="grid gap-2">
              <FormLabel>发生时间</FormLabel>
              <FormControl>
                <DateTimePicker value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="note"
          rules={{ validate: (value) => (value.trim() ? true : "请填写冲正原因") }}
          render={({ field }) => (
            <FormItem className="grid gap-2 md:col-span-2">
              <FormLabel>冲正原因</FormLabel>
              <FormControl>
                <Textarea placeholder="填写冲正原因" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <ImagePicker label="图片" photoType="txn" value={selectedPaths} onChange={setSelectedPaths} />
        <div className="grid gap-1 sm:grid-cols-1 md:col-span-2">
          <ConfirmButton
            className="w-full"
            label="提交"
            confirmText="确认提交？"
            onConfirm={async () => {
              await submitLocal();
            }}
          />
        </div>
      </div>
    </Form>
  );
}
