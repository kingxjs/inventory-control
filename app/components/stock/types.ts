export type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  status: string;
};

export type RackRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  warehouse_id?: string | null;
  level_count: number;
};

export type SlotRow = {
  id: string;
  slot_no: number;
  code: string;
  status: string;
};

export type ItemRow = {
  item_code: string;
  name: string;
  status: string;
};

export type OperatorRow = {
  id: string;
  username: string;
  display_name: string;
  status: string;
  role: string;
};

export type StockSlotItem = {
  slot_id: string;
  item_code: string;
  item_name: string;
  qty: number;
};

export type SlotListResult = {
  items: SlotRow[];
};

export type WarehouseListResult = {
  items: WarehouseRow[];
};

export type RackListResult = {
  items: RackRow[];
};

export type SlotPickerValue = {
  warehouseId: string;
  rackId: string;
  levelNo: string;
  slotId: string;
};

export type InboundFormValues = {
  item_id: string;
  to_slot_id: string;
  qty: string;
  occurred_at: string;
  operator_id: string;
  note: string;
};

export type OutboundFormValues = {
  item_id: string;
  from_slot_id: string;
  qty: number;
  occurred_at: string;
  operator_id: string;
  note: string;
};

export type MoveFormValues = {
  item_id: string;
  from_slot_id: string;
  to_slot_id: string;
  qty: string;
  occurred_at: string;
  operator_id: string;
  note: string;
};

export type CountFormValues = {
  item_id: string;
  slot_id: string;
  actual_qty: string;
  occurred_at: string;
  operator_id: string;
  note: string;
};

export type ReversalFormValues = {
  txn_no: string;
  occurred_at: string;
  operator_id: string;
  note: string;
};
