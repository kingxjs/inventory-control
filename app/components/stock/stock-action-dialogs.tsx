import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import type { UseFormReturn } from "react-hook-form"

import { Badge } from "~/components/ui/badge"
import { ConfirmButton } from "~/components/common/confirm-button"
import { Combobox } from "~/components/common/combobox"
import { DateTimePicker } from "~/components/ui/date-time-picker"
import { ImagePicker } from "~/components/common/image-picker"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { tauriInvoke } from "~/lib/tauri"

type WarehouseRow = {
  id: string
  code: string
  name: string
  status: string
}

type RackRow = {
  id: string
  code: string
  name: string
  status: string
  warehouse_id?: string | null
  level_count: number
}

type SlotRow = {
  id: string
  slot_no: number
  code: string
  status: string
}

type ItemRow = {
  item_code: string
  name: string
  status: string
}

type OperatorRow = {
  id: string
  username: string
  display_name: string
  status: string
  role: string
}

type StockSlotItem = {
  slot_code: string
  item_code: string
  item_name: string
  qty: number
}

type SlotListResult = {
  items: SlotRow[]
}

type WarehouseListResult = {
  items: WarehouseRow[]
}

type RackListResult = {
  items: RackRow[]
}

export type SlotPickerValue = {
  warehouseId: string
  rackId: string
  levelNo: string
  slotCode: string
}

export type InboundFormValues = {
  item_code: string
  to_slot_code: string
  qty: string
  occurred_at: string
  operator_id: string
  note: string
}

export type OutboundFormValues = {
  item_code: string
  from_slot_code: string
  qty: string
  occurred_at: string
  operator_id: string
  note: string
}

export type MoveFormValues = {
  item_code: string
  from_slot_code: string
  to_slot_code: string
  qty: string
  occurred_at: string
  operator_id: string
  note: string
}

export type CountFormValues = {
  item_code: string
  slot_code: string
  actual_qty: string
  occurred_at: string
  operator_id: string
  note: string
}

export type ReversalFormValues = {
  txn_no: string
  occurred_at: string
  operator_id: string
  note: string
}

type SlotPickerProps = {
  label: string
  warehouses: WarehouseRow[]
  racks: RackRow[]
  actorOperatorId: string
  value: SlotPickerValue
  onChange: (next: SlotPickerValue) => void
  disabled?: boolean
}


function SlotPicker({
  label,
  warehouses,
  racks,
  actorOperatorId,
  value,
  onChange,
  disabled = false,
}: SlotPickerProps) {
  const [slots, setSlots] = useState<SlotRow[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const filteredRacks = value.warehouseId
    ? racks.filter((rack) => rack.warehouse_id === value.warehouseId)
    : []
  const selectedRack = filteredRacks.find((rack) => rack.id === value.rackId) || null

  useEffect(() => {
    if (!value.rackId || !value.levelNo) {
      setSlots([])
      return
    }
    const levelNo = Number(value.levelNo)
    if (!levelNo) return
    setLoadingSlots(true)
    tauriInvoke<SlotListResult>("list_slots", {
      query: {
        rack_id: value.rackId,
        level_no: levelNo,
        // rely on wrapper or top-level actor injection where needed
      },
    })
      .then((result) => {
        setSlots(result.items.filter((slot) => slot.status === "active"))
      })
      .catch(() => {
        setSlots([])
      })
      .finally(() => {
        setLoadingSlots(false)
      })
  }, [value.levelNo, value.rackId])

  const levelOptions = selectedRack
    ? Array.from({ length: selectedRack.level_count }, (_, index) => String(index + 1))
    : []

  return (
    <div className="grid gap-2 md:col-span-2">
      <Label>{label}</Label>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Combobox
          options={warehouses.map((warehouse) => ({
            value: warehouse.id,
            label: (
              <span className="flex items-center gap-2">
                <Badge variant="secondary" className="shrink-0">
                  {warehouse.code}
                </Badge>
                <span className="truncate">{warehouse.name}</span>
              </span>
            ),
            searchLabel: `${warehouse.code} ${warehouse.name}`,
          }))}
          value={value.warehouseId}
          onChange={(next) =>
            onChange({ warehouseId: next, rackId: "", levelNo: "", slotCode: "" })
          }
          placeholder="仓库"
          searchPlaceholder="搜索仓库..."
          emptyText="未找到仓库"
          onSearch={async (keyword) => {
            const result = await tauriInvoke<WarehouseListResult>("list_warehouses", {
              query: {
                keyword: keyword || undefined,
                status: "active",
                page_index: 1,
                page_size: 50,
              },
            })
            return result.items.map((warehouse) => ({
              value: warehouse.id,
              label: (
                <span className="flex items-center gap-2">
                  <Badge variant="secondary" className="shrink-0">
                    {warehouse.code}
                  </Badge>
                  <span className="truncate">{warehouse.name}</span>
                </span>
              ),
              searchLabel: `${warehouse.code} ${warehouse.name}`,
            }))
          }}
          disabled={disabled}
        />
        <Combobox
          options={filteredRacks.map((rack) => ({
            value: rack.id,
            label: (
              <span className="flex items-center gap-2">
                <Badge variant="secondary" className="shrink-0">
                  {rack.code}
                </Badge>
                <span className="truncate">{rack.name}</span>
              </span>
            ),
            searchLabel: `${rack.code} ${rack.name}`,
          }))}
          value={value.rackId}
          onChange={(next) =>
            onChange({ warehouseId: value.warehouseId, rackId: next, levelNo: "", slotCode: "" })
          }
          placeholder="货架"
          searchPlaceholder="搜索货架..."
          emptyText="未找到货架"
          onSearch={async (keyword) => {
            if (!value.warehouseId) {
              return []
            }
            const result = await tauriInvoke<RackListResult>("list_racks", {
              input: {
                page_index: 1,
                page_size: 200,
              },
            })
            const list = result.items.filter(
              (rack) => rack.status === "active" && rack.warehouse_id === value.warehouseId,
            )
            const filtered = keyword
              ? list.filter(
                  (rack) => rack.code.includes(keyword) || rack.name.includes(keyword),
                )
              : list
            return filtered.map((rack) => ({
              value: rack.id,
              label: (
                <span className="flex items-center gap-2">
                  <Badge variant="secondary" className="shrink-0">
                    {rack.code}
                  </Badge>
                  <span className="truncate">{rack.name}</span>
                </span>
              ),
              searchLabel: `${rack.code} ${rack.name}`,
            }))
          }}
          disabled={disabled || !value.warehouseId}
        />
        <Select
          value={value.levelNo}
          onValueChange={(next) =>
            onChange({
              warehouseId: value.warehouseId,
              rackId: value.rackId,
              levelNo: next,
              slotCode: "",
            })
          }
          disabled={disabled || !value.rackId}
        >
          <SelectTrigger className="w-full min-w-0">
            <SelectValue placeholder="层数" />
          </SelectTrigger>
          <SelectContent>
            {levelOptions.map((level) => (
              <SelectItem key={level} value={level}>
                第 {level} 层
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={value.slotCode}
          onValueChange={(next) =>
            onChange({
              warehouseId: value.warehouseId,
              rackId: value.rackId,
              levelNo: value.levelNo,
              slotCode: next,
            })
          }
          disabled={disabled || !value.levelNo || loadingSlots}
        >
          <SelectTrigger className="w-full min-w-0">
            <SelectValue placeholder={loadingSlots ? "加载格位..." : "格数"} />
          </SelectTrigger>
          <SelectContent>
            {slots.map((slot) => (
              <SelectItem key={slot.id} value={slot.code}>
                第 {slot.slot_no} 格 · {slot.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

type StockDialogProps = {
  title: string
  description: string
  fields: ReactNode
  onSubmit: () => Promise<boolean> | boolean
  onSubmitAndClose?: () => Promise<boolean> | boolean
  onBeforeSubmit?: () => boolean | Promise<boolean>
  onBeforeSubmitAndClose?: () => boolean | Promise<boolean>
  submitLabel?: string
  submitAndCloseLabel?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: ReactNode
}

function StockDialog({
  title,
  description,
  fields,
  onSubmit,
  onSubmitAndClose,
  onBeforeSubmit,
  onBeforeSubmitAndClose,
  submitLabel = "提交",
  submitAndCloseLabel = "提交并关闭",
  open,
  onOpenChange,
  trigger,
}: StockDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = open !== undefined
  const currentOpen = isControlled ? open : internalOpen
  const setOpen = isControlled ? onOpenChange : setInternalOpen
  const handleSubmit = async () => {
    const ok = await onSubmit()
    if (ok && setOpen) {
      setOpen(false)
    }
  }
  const handleSubmitAndClose = async () => {
    const submit = onSubmitAndClose ?? onSubmit
    const ok = await submit()
    if (ok && setOpen) {
      setOpen(false)
    }
  }
  return (
    <Dialog open={currentOpen} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="!w-[90vw] !max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">{fields}</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <ConfirmButton
            className="w-full"
            label={submitLabel}
            confirmText="确认提交？"
            onBeforeConfirmOpen={onBeforeSubmit}
            onConfirm={handleSubmit}
          />
          <ConfirmButton
            className="w-full"
            label={submitAndCloseLabel}
            confirmText="确认提交并关闭？"
            variant="secondary"
            onBeforeConfirmOpen={onBeforeSubmitAndClose ?? onBeforeSubmit}
            onConfirm={handleSubmitAndClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

type BaseActionDialogProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: ReactNode
  onSubmit: () => Promise<boolean> | boolean
  onBeforeSubmit?: () => boolean | Promise<boolean>
  onSubmitAndClose?: () => Promise<boolean> | boolean
}

type InboundDialogProps = BaseActionDialogProps & {
  items: ItemRow[]
  warehouses: WarehouseRow[]
  racks: RackRow[]
  operators: OperatorRow[]
  actorOperatorId: string
  resourceLoading: boolean
  inboundForm: UseFormReturn<InboundFormValues>
  inboundTarget: SlotPickerValue
  setInboundTarget: (next: SlotPickerValue) => void
  inboundSlotItems: StockSlotItem[]
  searchItemOptions: (keyword: string) => Promise<
    { value: string; label: ReactNode; searchLabel?: string }[]
  >
  photoPaths: string[]
  photoPreviewUrls: Record<string, string>
  onPickPhotos: () => void
  onRemovePhoto: (path: string) => void
}

export function InboundDialog({
  items,
  warehouses,
  racks,
  operators,
  actorOperatorId,
  resourceLoading,
  inboundForm,
  inboundTarget,
  setInboundTarget,
  inboundSlotItems,
  searchItemOptions,
  photoPaths,
  photoPreviewUrls,
  onPickPhotos,
  onRemovePhoto,
  open,
  onOpenChange,
  trigger,
  onSubmit,
  onBeforeSubmit,
  onSubmitAndClose,
}: InboundDialogProps) {
  const inbound = inboundForm.watch()
  const operatorOptions = operators.map((operator) => ({
    value: operator.id,
    label: (
      <span className="flex items-center gap-2">
        <Badge variant="secondary" className="shrink-0">
          {operator.username}
        </Badge>
        <span className="truncate">{operator.display_name}</span>
      </span>
    ),
    searchLabel: `${operator.username} ${operator.display_name}`,
  }))
  return (
    <StockDialog
      title="入库"
      description="新增入库记录"
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      onSubmit={onSubmit}
      onSubmitAndClose={onSubmitAndClose}
      onBeforeSubmit={onBeforeSubmit}
      fields={
        <Form {...inboundForm}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={inboundForm.control}
              name="item_code"
              rules={{
                validate: (value) => (value.trim() ? true : "请选择物品"),
              }}
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>物品</FormLabel>
                  <FormControl>
                    <Combobox
                      options={items.map((item) => ({
                        value: item.item_code,
                        label: (
                          <span className="flex items-center gap-2">
                            <Badge variant="secondary" className="shrink-0">
                              {item.item_code}
                            </Badge>
                            <span className="truncate">{item.name}</span>
                          </span>
                        ),
                        searchLabel: `${item.item_code} ${item.name}`,
                      }))}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={resourceLoading ? "加载中..." : "选择物品"}
                      searchPlaceholder="搜索物品..."
                      emptyText="未找到物品"
                      onSearch={searchItemOptions}
                      disabled={resourceLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={inboundForm.control}
              name="to_slot_code"
              rules={{
                validate: (value) => (value.trim() ? true : "请选择目标位置"),
              }}
              render={({ field }) => (
                <FormItem className="grid gap-2 md:col-span-2">
                  <FormControl>
                    <SlotPicker
                      label="位置"
                      warehouses={warehouses}
                      racks={racks}
                      actorOperatorId={actorOperatorId}
                      value={inboundTarget}
                      onChange={(next) => {
                        setInboundTarget(next)
                        field.onChange(next.slotCode)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {inbound.to_slot_code ? (
              <div className="grid gap-2 md:col-span-2">
                <Label>当前库位物品</Label>
                {inboundSlotItems.length > 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    {inboundSlotItems.map((row) => (
                      <div key={`${row.slot_code}-${row.item_code}`}>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="shrink-0">
                            {row.item_code}
                          </Badge>
                          <span className="truncate">{row.item_name}</span>
                          <span>× {row.qty}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">当前库位暂无库存</div>
                )}
              </div>
            ) : null}
            <FormField
              control={inboundForm.control}
              name="qty"
              rules={{
                validate: (value) =>
                  Number(value) > 0 ? true : "请输入有效数量",
              }}
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>数量</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入数量" type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={inboundForm.control}
              name="operator_id"
              rules={{
                validate: (value) => (value.trim() ? true : "请输入记录人"),
              }}
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>记录人</FormLabel>
                  <FormControl>
                    <Combobox
                      options={operatorOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="选择记录人"
                      searchPlaceholder="搜索人员..."
                      emptyText="未找到人员"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={inboundForm.control}
              name="occurred_at"
              rules={{
                validate: (value) => (value.trim() ? true : "请选择发生时间"),
              }}
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
              control={inboundForm.control}
              name="note"
              render={({ field }) => (
                <FormItem className="grid gap-2 md:col-span-2">
                  <FormLabel>备注</FormLabel>
                  <FormControl>
                    <Textarea placeholder="补充说明" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <ImagePicker
              label="图片"
              selectedPaths={photoPaths}
              previewUrls={photoPreviewUrls}
              onPick={onPickPhotos}
              onRemove={onRemovePhoto}
            />
          </div>
        </Form>
      }
    />
  )
}

type OutboundDialogProps = BaseActionDialogProps & {
  items: ItemRow[]
  warehouses: WarehouseRow[]
  racks: RackRow[]
  operators: OperatorRow[]
  actorOperatorId: string
  outboundForm: UseFormReturn<OutboundFormValues>
  outboundSource: SlotPickerValue
  setOutboundSource: (next: SlotPickerValue) => void
  photoPaths: string[]
  photoPreviewUrls: Record<string, string>
  onPickPhotos: () => void
  onRemovePhoto: (path: string) => void
}

export function OutboundDialog({
  items,
  warehouses,
  racks,
  operators,
  actorOperatorId,
  outboundForm,
  outboundSource,
  setOutboundSource,
  photoPaths,
  photoPreviewUrls,
  onPickPhotos,
  onRemovePhoto,
  open,
  onOpenChange,
  trigger,
  onSubmit,
  onBeforeSubmit,
  onSubmitAndClose,
}: OutboundDialogProps) {
  const operatorOptions = operators.map((operator) => ({
    value: operator.id,
    label: (
      <span className="flex items-center gap-2">
        <Badge variant="secondary" className="shrink-0">
          {operator.username}
        </Badge>
        <span className="truncate">{operator.display_name}</span>
      </span>
    ),
    searchLabel: `${operator.username} ${operator.display_name}`,
  }))
  return (
    <StockDialog
      title="出库"
      description="新增出库记录"
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      onSubmit={onSubmit}
      onSubmitAndClose={onSubmitAndClose}
      onBeforeSubmit={onBeforeSubmit}
      fields={
        <Form {...outboundForm}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={outboundForm.control}
              name="item_code"
              rules={{
                validate: (value) => (value.trim() ? true : "请选择物品"),
              }}
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>物品</FormLabel>
                  <FormControl>
                    <Combobox
                      options={items.map((item) => ({
                        value: item.item_code,
                        label: (
                          <span className="flex items-center gap-2">
                            <Badge variant="secondary" className="shrink-0">
                              {item.item_code}
                            </Badge>
                            <span className="truncate">{item.name}</span>
                          </span>
                        ),
                        searchLabel: `${item.item_code} ${item.name}`,
                      }))}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="选择库存后自动带出"
                      searchPlaceholder="搜索物品..."
                      emptyText="未找到物品"
                      disabled
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={outboundForm.control}
              name="from_slot_code"
              rules={{
                validate: (value) => (value.trim() ? true : "请选择来源位置"),
              }}
              render={({ field }) => (
                <FormItem className="grid gap-2 md:col-span-2">
                  <FormControl>
                    <SlotPicker
                      label="来源位置"
                      warehouses={warehouses}
                      racks={racks}
                      actorOperatorId={actorOperatorId}
                      value={outboundSource}
                      disabled
                      onChange={(next) => {
                        setOutboundSource(next)
                        field.onChange(next.slotCode)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={outboundForm.control}
              name="qty"
              rules={{
                validate: (value) =>
                  Number(value) > 0 ? true : "请输入有效数量",
              }}
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>数量</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入数量" type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={outboundForm.control}
              name="operator_id"
              rules={{
                validate: (value) => (value.trim() ? true : "请输入记录人"),
              }}
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>记录人</FormLabel>
                  <FormControl>
                    <Combobox
                      options={operatorOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="选择记录人"
                      searchPlaceholder="搜索人员..."
                      emptyText="未找到人员"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={outboundForm.control}
              name="occurred_at"
              rules={{
                validate: (value) => (value.trim() ? true : "请选择发生时间"),
              }}
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
              control={outboundForm.control}
              name="note"
              render={({ field }) => (
                <FormItem className="grid gap-2 md:col-span-2">
                  <FormLabel>备注</FormLabel>
                  <FormControl>
                    <Textarea placeholder="补充说明" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <ImagePicker
              label="图片"
              selectedPaths={photoPaths}
              previewUrls={photoPreviewUrls}
              onPick={onPickPhotos}
              onRemove={onRemovePhoto}
            />
          </div>
        </Form>
      }
    />
  )
}

type MoveDialogProps = BaseActionDialogProps & {
  items: ItemRow[]
  warehouses: WarehouseRow[]
  racks: RackRow[]
  operators: OperatorRow[]
  actorOperatorId: string
  moveForm: UseFormReturn<MoveFormValues>
  moveSource: SlotPickerValue
  setMoveSource: (next: SlotPickerValue) => void
  moveTarget: SlotPickerValue
  setMoveTarget: (next: SlotPickerValue) => void
  moveTargetItems: StockSlotItem[]
  photoPaths: string[]
  photoPreviewUrls: Record<string, string>
  onPickPhotos: () => void
  onRemovePhoto: (path: string) => void
}

export function MoveDialog({
  items,
  warehouses,
  racks,
  operators,
  actorOperatorId,
  moveForm,
  moveSource,
  setMoveSource,
  moveTarget,
  setMoveTarget,
  moveTargetItems,
  photoPaths,
  photoPreviewUrls,
  onPickPhotos,
  onRemovePhoto,
  open,
  onOpenChange,
  trigger,
  onSubmit,
  onBeforeSubmit,
  onSubmitAndClose,
}: MoveDialogProps) {
  const move = moveForm.watch()
  const operatorOptions = operators.map((operator) => ({
    value: operator.id,
    label: (
      <span className="flex items-center gap-2">
        <Badge variant="secondary" className="shrink-0">
          {operator.username}
        </Badge>
        <span className="truncate">{operator.display_name}</span>
      </span>
    ),
    searchLabel: `${operator.username} ${operator.display_name}`,
  }))
  return (
    <StockDialog
      title="移库"
      description="新增移库记录"
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      onSubmit={onSubmit}
      onSubmitAndClose={onSubmitAndClose}
      onBeforeSubmit={onBeforeSubmit}
      fields={
        <Form {...moveForm}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={moveForm.control}
              name="item_code"
              rules={{
                validate: (value) => (value.trim() ? true : "请选择物品"),
              }}
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>物品</FormLabel>
                  <FormControl>
                    <Combobox
                      options={items.map((item) => ({
                        value: item.item_code,
                        label: (
                          <span className="flex items-center gap-2">
                            <Badge variant="secondary" className="shrink-0">
                              {item.item_code}
                            </Badge>
                            <span className="truncate">{item.name}</span>
                          </span>
                        ),
                        searchLabel: `${item.item_code} ${item.name}`,
                      }))}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="选择库存后自动带出"
                      searchPlaceholder="搜索物品..."
                      emptyText="未找到物品"
                      disabled
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={moveForm.control}
              name="from_slot_code"
              rules={{
                validate: (value) => (value.trim() ? true : "请选择来源位置"),
              }}
              render={({ field }) => (
                <FormItem className="grid gap-2 md:col-span-2">
                  <FormControl>
                    <SlotPicker
                      label="来源位置"
                      warehouses={warehouses}
                      racks={racks}
                      actorOperatorId={actorOperatorId}
                      value={moveSource}
                      disabled
                      onChange={(next) => {
                        setMoveSource(next)
                        field.onChange(next.slotCode)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={moveForm.control}
              name="to_slot_code"
              rules={{
                validate: (value) => {
                  if (!value.trim()) {
                    return "请选择目标位置"
                  }
                  const fromSlot = moveForm.getValues("from_slot_code")
                  return value === fromSlot ? "来源位置与目标位置不能相同" : true
                },
              }}
              render={({ field }) => (
                <FormItem className="grid gap-2 md:col-span-2">
                  <FormControl>
                    <SlotPicker
                      label="目标位置"
                      warehouses={warehouses}
                      racks={racks}
                      actorOperatorId={actorOperatorId}
                      value={moveTarget}
                      onChange={(next) => {
                        setMoveTarget(next)
                        field.onChange(next.slotCode)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {move.to_slot_code ? (
              <div className="grid gap-2 md:col-span-2">
                <Label>目标库位物品</Label>
                {moveTargetItems.length > 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    {moveTargetItems.map((row) => (
                      <div key={`${row.slot_code}-${row.item_code}`}>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="shrink-0">
                            {row.item_code}
                          </Badge>
                          <span className="truncate">{row.item_name}</span>
                          <span>× {row.qty}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">目标库位暂无库存</div>
                )}
              </div>
            ) : null}
            <FormField
              control={moveForm.control}
              name="qty"
              rules={{
                validate: (value) =>
                  Number(value) > 0 ? true : "请输入有效数量",
              }}
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>数量</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入数量" type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={moveForm.control}
              name="operator_id"
              rules={{
                validate: (value) => (value.trim() ? true : "请输入记录人"),
              }}
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>记录人</FormLabel>
                  <FormControl>
                    <Combobox
                      options={operatorOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="选择记录人"
                      searchPlaceholder="搜索人员..."
                      emptyText="未找到人员"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={moveForm.control}
              name="occurred_at"
              rules={{
                validate: (value) => (value.trim() ? true : "请选择发生时间"),
              }}
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
              control={moveForm.control}
              name="note"
              render={({ field }) => (
                <FormItem className="grid gap-2 md:col-span-2">
                  <FormLabel>备注</FormLabel>
                  <FormControl>
                    <Textarea placeholder="补充说明" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <ImagePicker
              label="图片"
              selectedPaths={photoPaths}
              previewUrls={photoPreviewUrls}
              onPick={onPickPhotos}
              onRemove={onRemovePhoto}
            />
          </div>
        </Form>
      }
    />
  )
}

type CountDialogProps = BaseActionDialogProps & {
  items: ItemRow[]
  warehouses: WarehouseRow[]
  racks: RackRow[]
  operators: OperatorRow[]
  actorOperatorId: string
  countForm: UseFormReturn<CountFormValues>
  countTarget: SlotPickerValue
  setCountTarget: (next: SlotPickerValue) => void
  photoPaths: string[]
  photoPreviewUrls: Record<string, string>
  onPickPhotos: () => void
  onRemovePhoto: (path: string) => void
}

export function CountDialog({
  items,
  warehouses,
  racks,
  operators,
  actorOperatorId,
  countForm,
  countTarget,
  setCountTarget,
  photoPaths,
  photoPreviewUrls,
  onPickPhotos,
  onRemovePhoto,
  open,
  onOpenChange,
  trigger,
  onSubmit,
  onBeforeSubmit,
  onSubmitAndClose,
}: CountDialogProps) {
  const operatorOptions = operators.map((operator) => ({
    value: operator.id,
    label: (
      <span className="flex items-center gap-2">
        <Badge variant="secondary" className="shrink-0">
          {operator.username}
        </Badge>
        <span className="truncate">{operator.display_name}</span>
      </span>
    ),
    searchLabel: `${operator.username} ${operator.display_name}`,
  }))
  return (
    <StockDialog
      title="盘点"
      description="登记盘点数量"
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      onSubmit={onSubmit}
      onSubmitAndClose={onSubmitAndClose}
      onBeforeSubmit={onBeforeSubmit}
      fields={
        <Form {...countForm}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={countForm.control}
              name="item_code"
              rules={{
                validate: (value) => (value.trim() ? true : "请选择物品"),
              }}
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>物品</FormLabel>
                  <FormControl>
                    <Combobox
                      options={items.map((item) => ({
                        value: item.item_code,
                        label: (
                          <span className="flex items-center gap-2">
                            <Badge variant="secondary" className="shrink-0">
                              {item.item_code}
                            </Badge>
                            <span className="truncate">{item.name}</span>
                          </span>
                        ),
                        searchLabel: `${item.item_code} ${item.name}`,
                      }))}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="选择库存后自动带出"
                      searchPlaceholder="搜索物品..."
                      emptyText="未找到物品"
                      disabled
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={countForm.control}
              name="slot_code"
              rules={{
                validate: (value) => (value.trim() ? true : "请选择盘点位置"),
              }}
              render={({ field }) => (
                <FormItem className="grid gap-2 md:col-span-2">
                  <FormControl>
                    <SlotPicker
                      label="盘点位置"
                      warehouses={warehouses}
                      racks={racks}
                      actorOperatorId={actorOperatorId}
                      value={countTarget}
                      disabled
                      onChange={(next) => {
                        setCountTarget(next)
                        field.onChange(next.slotCode)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={countForm.control}
              name="actual_qty"
              rules={{
                validate: (value) =>
                  Number(value) >= 0 ? true : "请输入有效实盘数量",
              }}
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>实盘数量</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入实际数量" type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={countForm.control}
              name="operator_id"
              rules={{
                validate: (value) => (value.trim() ? true : "请输入记录人"),
              }}
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>记录人</FormLabel>
                  <FormControl>
                    <Combobox
                      options={operatorOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="选择记录人"
                      searchPlaceholder="搜索人员..."
                      emptyText="未找到人员"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={countForm.control}
              name="occurred_at"
              rules={{
                validate: (value) => (value.trim() ? true : "请选择发生时间"),
              }}
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
              control={countForm.control}
              name="note"
              render={({ field }) => (
                <FormItem className="grid gap-2 md:col-span-2">
                  <FormLabel>备注</FormLabel>
                  <FormControl>
                    <Textarea placeholder="补充说明" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <ImagePicker
              label="图片"
              selectedPaths={photoPaths}
              previewUrls={photoPreviewUrls}
              onPick={onPickPhotos}
              onRemove={onRemovePhoto}
            />
          </div>
        </Form>
      }
    />
  )
}

type ReversalDialogProps = BaseActionDialogProps & {
  reversalForm: UseFormReturn<ReversalFormValues>
  operators: OperatorRow[]
  photoPaths: string[]
  photoPreviewUrls: Record<string, string>
  onPickPhotos: () => void
  onRemovePhoto: (path: string) => void
}

export function ReversalDialog({
  reversalForm,
  operators,
  photoPaths,
  photoPreviewUrls,
  onPickPhotos,
  onRemovePhoto,
  open,
  onOpenChange,
  trigger,
  onSubmit,
  onBeforeSubmit,
  onSubmitAndClose,
}: ReversalDialogProps) {
  const operatorOptions = operators.map((operator) => ({
    value: operator.id,
    label: (
      <span className="flex items-center gap-2">
        <Badge variant="secondary" className="shrink-0">
          {operator.username}
        </Badge>
        <span className="truncate">{operator.display_name}</span>
      </span>
    ),
    searchLabel: `${operator.username} ${operator.display_name}`,
  }))
  return (
    <StockDialog
      title="冲正"
      description="冲正历史流水"
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      onSubmit={onSubmit}
      onSubmitAndClose={onSubmitAndClose}
      onBeforeSubmit={onBeforeSubmit}
      fields={
        <Form {...reversalForm}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={reversalForm.control}
              name="txn_no"
              rules={{
                validate: (value) => (value.trim() ? true : "请输入原流水号"),
              }}
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
              control={reversalForm.control}
              name="operator_id"
              rules={{
                validate: (value) => (value.trim() ? true : "请输入记录人"),
              }}
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>记录人</FormLabel>
                  <FormControl>
                    <Combobox
                      options={operatorOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="选择记录人"
                      searchPlaceholder="搜索人员..."
                      emptyText="未找到人员"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={reversalForm.control}
              name="occurred_at"
              rules={{
                validate: (value) => (value.trim() ? true : "请选择发生时间"),
              }}
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
              control={reversalForm.control}
              name="note"
              rules={{
                validate: (value) => (value.trim() ? true : "请填写冲正原因"),
              }}
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
            <ImagePicker
              label="图片"
              selectedPaths={photoPaths}
              previewUrls={photoPreviewUrls}
              onPick={onPickPhotos}
              onRemove={onRemovePhoto}
            />
          </div>
        </Form>
      }
    />
  )
}
