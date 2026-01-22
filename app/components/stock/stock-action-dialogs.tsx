import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Await } from "react-router";
import InboundForm from "./forms/inbound-form";
import OutboundForm from "./forms/outbound-form";
import MoveForm from "./forms/move-form";
import CountForm from "./forms/count-form";
import ReversalForm from "./forms/reversal-form";
import { Button, buttonVariants } from "~/components/ui/button";
import type { InboundFormValues, OutboundFormValues, MoveFormValues, CountFormValues, ReversalFormValues, SlotPickerValue, StockSlotItem } from "./types";

// re-export form types for routes
export type { InboundFormValues, OutboundFormValues, MoveFormValues, CountFormValues, ReversalFormValues, SlotPickerValue } from "./types";

type StockDialogProps = {
  title: string;
  description: string;
  fields: ReactNode;
  submitLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
};

function StockDialog({ title, description, fields, submitLabel = "提交", open, onOpenChange, trigger }: StockDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const currentOpen = isControlled ? open : internalOpen;
  const setOpen = isControlled ? onOpenChange : setInternalOpen;
  return (
    <Dialog open={currentOpen} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="!w-[90vw] !max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">{fields}</div>
      </DialogContent>
    </Dialog>
  );
}

type BaseActionDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type InboundDialogProps = BaseActionDialogProps & {
  form?: UseFormReturn<InboundFormValues>;
};

// getItemListBySlotId moved to app/components/stock/helpers.ts

export function InboundDialog({ form, open, onOpenChange }: InboundDialogProps) {
  return <StockDialog title="入库" description="新增入库记录" trigger={<Button>入库</Button>} open={open} onOpenChange={onOpenChange} fields={<InboundForm form={form} onClose={() => onOpenChange?.(false)} />} />;
}

type OutboundDialogProps = BaseActionDialogProps & {
  form?: UseFormReturn<OutboundFormValues>;
};

export function OutboundDialog({ form, open, onOpenChange }: OutboundDialogProps) {
  return <StockDialog title="出库" description="新增出库记录" trigger={<Button>出库</Button>} open={open} onOpenChange={onOpenChange} fields={<OutboundForm form={form} onClose={() => onOpenChange?.(false)} />} />;
}

type MoveDialogProps = BaseActionDialogProps & {
  form?: UseFormReturn<MoveFormValues>;
};

export function MoveDialog({ form, open, onOpenChange }: MoveDialogProps) {
  return <StockDialog title="移库" trigger={<Button>移库</Button>} description="新增移库记录" open={open} onOpenChange={onOpenChange} fields={<MoveForm form={form} onClose={() => onOpenChange?.(false)} />} />;
}

type CountDialogProps = BaseActionDialogProps & {
  form?: UseFormReturn<CountFormValues>;
};

export function CountDialog({ form, open, onOpenChange }: CountDialogProps) {
  return <StockDialog title="盘点" trigger={<Button>盘点</Button>} description="登记盘点数量" open={open} onOpenChange={onOpenChange} fields={<CountForm form={form} onClose={() => onOpenChange?.(false)} />} />;
}

type ReversalDialogProps = BaseActionDialogProps & {
  form?: UseFormReturn<ReversalFormValues>;
};

export function ReversalDialog({ form, open, onOpenChange }: ReversalDialogProps) {
  return <StockDialog title="冲正" trigger={<Button>冲正</Button>} description="冲正历史流水" open={open} onOpenChange={onOpenChange} fields={<ReversalForm form={form} onClose={() => onOpenChange?.(false)} />} />;
}
