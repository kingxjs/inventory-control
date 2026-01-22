-- 迁移说明：初始化数据库模式（0001_init.sql）
-- 本文件创建应用所需的核心表和索引：
-- 1) 应用元数据（app_meta）用于存储键值对配置
-- 2) operator/warehouse/rack/slot/item/media_attachment 等表用于仓库、货位、物料及附件管理
-- 3) txn/stock 表用于事务与库存跟踪
-- 4) audit_log 用于审计日志
PRAGMA foreign_keys = ON;

-- 应用元数据表：用于存储简单的键值对配置（例如版本号、迁移状态）
CREATE TABLE IF NOT EXISTS app_meta (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);

-- 操作员表：存储系统用户/操作员信息，包括角色与状态
-- 重要字段：`username`（唯一），`password_hash`（认证用），`must_change_pwd`（强制修改密码标志）
CREATE TABLE IF NOT EXISTS operator (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','keeper','viewer','member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  password_hash TEXT NOT NULL,
  must_change_pwd INTEGER NOT NULL DEFAULT 1 CHECK(must_change_pwd IN (0,1)),
  pwd_changed_at INTEGER,
  created_at INTEGER NOT NULL
);

-- 仓库表：表示物理或逻辑仓库位置
-- `code` 为仓库简短标识符（唯一），`name` 为显示名称
CREATE TABLE IF NOT EXISTS warehouse (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_at INTEGER NOT NULL
);

-- 货架表：仓库内的货架结构描述
-- 包含层数 (`level_count`) 与每层槽位数 (`slots_per_level`)，可选的 `location` 信息
-- `code` 为货架在所属仓库内的标识符，在同一 `warehouse_id` 下应当唯一（不同仓库可重复）
CREATE TABLE IF NOT EXISTS rack (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  level_count INTEGER NOT NULL,
  slots_per_level INTEGER NOT NULL,
  location TEXT,
  warehouse_id TEXT REFERENCES warehouse(id),
  created_at INTEGER NOT NULL,
  UNIQUE(warehouse_id, code)
);

-- 索引用于根据仓库快速查找货架
CREATE INDEX IF NOT EXISTS idx_rack_warehouse ON rack(warehouse_id);

-- 货位（slot）表：代表货架上具体的存放单元（由货架、层号、槽位号唯一确定）
-- `code` 为可读的货位编码（唯一），并保证在同一货架上 (rack_id, level_no, slot_no) 唯一
CREATE TABLE IF NOT EXISTS slot (
  id TEXT PRIMARY KEY,
  rack_id TEXT NOT NULL REFERENCES rack(id),
  warehouse_id TEXT REFERENCES warehouse(id),
  level_no INTEGER NOT NULL,
  slot_no INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_at INTEGER NOT NULL,
  UNIQUE(rack_id, level_no, slot_no)
);

-- 索引：按货架、层、槽位加速定位
CREATE INDEX IF NOT EXISTS idx_slot_rack_level ON slot(rack_id, level_no, slot_no);
-- 索引：按仓库加速查询
CREATE INDEX IF NOT EXISTS idx_slot_warehouse ON slot(warehouse_id);

-- 物料（item）表：定义库存中的物品基础信息
-- `item_code` 为物料编码（唯一），可包含 `model`、`spec`、`uom` 等属性
CREATE TABLE IF NOT EXISTS item (
  id TEXT PRIMARY KEY,
  item_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  model TEXT,
  spec TEXT,
  uom TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  remark TEXT,
  created_at INTEGER NOT NULL
);

-- 索引：按名称或型号加速查询
CREATE INDEX IF NOT EXISTS idx_item_name ON item(name);
CREATE INDEX IF NOT EXISTS idx_item_model ON item(model);

-- 物料图片表：存储物料相关图片元数据（实际二进制可由文件系统或 BLOB 存储）
-- `data_id` 通常关联物料或其他资源，`type` 可标注图片用途，`sort_no` 控制排序
-- 媒体/附件表：通用的媒体附件存储元数据（替代旧的 item_photo 表名）
-- 字段说明：`type` 标识附件用途（如 item/txn/...），`data_id` 关联具体资源的 id，`file_path` 为相对路径
CREATE TABLE IF NOT EXISTS media_attachment (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  data_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime TEXT,
  sort_no INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_attachment_data_sort ON media_attachment(type, data_id, sort_no);

-- 流水（txn）表：记录入库/出库/移位/盘点/调整/冲销等操作
-- 关键字段：`txn_no`（事务号），`type`（事务类型），`occurred_at`（发生时间），`operator_id`、`item_id`、`from_slot_id`/`to_slot_id` 和数量字段
CREATE TABLE IF NOT EXISTS txn (
  id TEXT PRIMARY KEY,
  txn_no TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('IN','OUT','MOVE','COUNT','ADJUST','REVERSAL')),
  occurred_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  operator_id TEXT NOT NULL REFERENCES operator(id),
  item_id TEXT NOT NULL REFERENCES item(id),
  from_slot_id TEXT REFERENCES slot(id),
  to_slot_id TEXT REFERENCES slot(id),
  qty INTEGER NOT NULL,
  actual_qty INTEGER,
  ref_txn_id TEXT REFERENCES txn(id),
  note TEXT
);

-- 对于冲销类型（REVERSAL），确保被引用的事务只能被唯一冲销
CREATE UNIQUE INDEX IF NOT EXISTS uq_reversal_ref
ON txn(ref_txn_id) WHERE type='REVERSAL';

-- 常用索引：按物料与时间、按类型与时间、按来源/目标货位加速查询
CREATE INDEX IF NOT EXISTS idx_txn_item_time ON txn(item_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_txn_type_time ON txn(type, occurred_at);
CREATE INDEX IF NOT EXISTS idx_txn_from_slot ON txn(from_slot_id);
CREATE INDEX IF NOT EXISTS idx_txn_to_slot ON txn(to_slot_id);

-- 库存（stock）表：跟踪每个物料在每个货位的数量（item_id, slot_id 唯一）
CREATE TABLE IF NOT EXISTS stock (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES item(id),
  slot_id TEXT NOT NULL REFERENCES slot(id),
  qty INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(item_id, slot_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_slot ON stock(slot_id);
CREATE INDEX IF NOT EXISTS idx_stock_item ON stock(item_id);

-- 审计日志（audit_log）：记录系统操作、接口或后台任务的执行结果，便于事后追踪与分析
-- `request_json` 可存放请求参数快照，`result` 标识执行是否成功
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  actor_operator_id TEXT REFERENCES operator(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  request_json TEXT,
  result TEXT NOT NULL CHECK(result IN ('success','fail')),
  error_code TEXT,
  error_detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_actor_time ON audit_log(actor_operator_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action_time ON audit_log(action, created_at);
