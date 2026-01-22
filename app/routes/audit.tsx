import { useEffect, useState } from "react";
import { PageHeader } from "~/components/common/page-header";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { DatePicker } from "~/components/ui/date";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "~/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { getSession } from "~/lib/auth";
import { tauriInvoke } from "~/lib/tauri";
import { toast } from "sonner";

type AuditRow = {
  id: string;
  created_at: number;
  actor_operator_id?: string | null;
  actor_operator_name?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  request_json?: string | null;
  result: string;
  error_code?: string | null;
  error_detail?: string | null;
};

type AuditListResult = {
  items: AuditRow[];
  total: number;
};

type AuditExportResult = {
  file_path: string;
};

const actionLabels: Record<string, string> = {
  AUTH_LOGIN: "登录",
  AUTH_LOGOUT: "退出登录",
  AUTH_CHANGE_PASSWORD: "修改密码",
  AUTH_RESET_PASSWORD: "重置密码",
  OPERATOR_LIST: "查询人员",
  OPERATOR_CREATE: "新增人员",
  OPERATOR_UPDATE: "更新人员",
  OPERATOR_STATUS: "人员状态变更",
  WAREHOUSE_LIST: "查询仓库",
  WAREHOUSE_CREATE: "新增仓库",
  WAREHOUSE_UPDATE: "更新仓库",
  WAREHOUSE_STATUS: "仓库状态变更",
  RACK_LIST: "查询货架",
  RACK_CREATE: "新增货架",
  RACK_UPDATE: "更新货架",
  RACK_STATUS: "货架状态变更",
  SLOT_LIST: "查询库位",
  SLOT_REGEN: "重建库位",
  SLOT_STATUS: "库位状态变更",
  ITEM_LIST: "查询物品",
  ITEM_CREATE: "新增物品",
  ITEM_UPDATE: "更新物品",
  ITEM_STATUS: "物品状态变更",
  MEDIA_ATTACHMENT_ITEM_ADD: "上传媒体附件（物品图片）",
  MEDIA_ATTACHMENT_ITEM_LIST: "查询媒体附件（物品图片）",
  MEDIA_ATTACHMENT_ITEM_REMOVE: "删除媒体附件（物品图片）",
  MEDIA_ATTACHMENT_ITEM_REORDER: "排序媒体附件（物品图片）",
  MEDIA_ATTACHMENT_ITEM_PATH_REWRITE: "重写媒体附件路径",
  MEDIA_ATTACHMENT_TXN_ADD: "上传媒体附件（流水图片）",
  MEDIA_ATTACHMENT_TXN_LIST: "查询媒体附件（流水图片）",
  MEDIA_ATTACHMENT_TXN_REMOVE: "删除媒体附件（流水图片）",
  MEDIA_ATTACHMENT_TXN_PATH_REWRITE: "重写媒体附件路径（流水）",

  TXN_INBOUND: "入库",
  TXN_OUTBOUND: "出库",
  TXN_MOVE: "移库",
  TXN_COUNT: "盘点",
  TXN_REVERSAL: "冲正",
  TXN_LIST: "查询流水",
  SYSTEM_SETTINGS_UPDATE: "系统设置更新",
  SYSTEM_SETTINGS_READ: "读取系统设置",
  SYSTEM_STORAGE_ROOT_CHANGE: "存储目录迁移",
  AUDIT_LIST: "查询审计日志",
  AUDIT_EXPORT: "导出审计日志",
  STOCK_LIST_BY_SLOT: "按库位查询库存",
  STOCK_LIST_BY_ITEM: "按物品查询库存",
  STOCK_EXPORT: "导出库存",
  DB_BACKUP: "数据库备份",
  DB_RESTORE: "数据库恢复",
  ITEM_EXPORT: "导出物品",
  ITEM_IMPORT: "导入物品",
  TXN_EXPORT: "导出流水",
  TXN_IMPORT: "导入流水",
  DASHBOARD_OVERVIEW: "仪表盘概览",
};

const getActionLabel = (action: string) => actionLabels[action] ?? action;

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState("all");
  const [keyword, setKeyword] = useState("");

  const formatDate = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  const defaultEndDate = formatDate(today);
  const defaultStartDate = formatDate(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000));
  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(defaultEndDate);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeRow, setActiveRow] = useState<AuditRow | null>(null);
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const fetchLogs = async (action?: string, page = pageIndex) => {
    const trimmedKeyword = keyword.trim();
    const startAt = startDate ? Math.floor(new Date(`${startDate}T00:00:00`).getTime() / 1000) : undefined;
    const endAt = endDate ? Math.floor(new Date(`${endDate}T23:59:59`).getTime() / 1000) : undefined;
    setLoading(true);
    try {
      const result = await tauriInvoke<AuditListResult>("list_audit_logs", {
        input: {
          action,
          keyword: trimmedKeyword || undefined,
          start_at: startAt,
          end_at: endAt,
          page_index: page,
          page_size: pageSize,
        },
      });
      setRows(result.items);
      setTotal(result.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载失败";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(actionFilter === "all" ? undefined : actionFilter, pageIndex);
  }, [pageIndex]);

  const openDetail = (row: AuditRow) => {
    setActiveRow(row);
    setDetailOpen(true);
  };

  const handleExport = async () => {
    try {
      const result = await tauriInvoke<AuditExportResult>("export_audit_logs");
      toast.success(`导出成功：${result.file_path}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "导出失败";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="操作日志"
        description="审计所有关键操作，支持导出与详情查看。"
        actions={
          <Button variant="outline" onClick={handleExport}>
            导出日志
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
        <div className="min-w-[140px] w-[140px] max-w-[140px] flex-1 space-y-2">
          <Label>搜索</Label>
          <Input placeholder="动作/对象/用户" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        </div>
        <div className="min-w-[180px] space-y-2">
          <Label>开始日期</Label>
          <DatePicker value={startDate} onChange={setStartDate} />
        </div>
        <div className="min-w-[180px] space-y-2">
          <Label>结束日期</Label>
          <DatePicker value={endDate} onChange={setEndDate} />
        </div>
        <div className="flex-1 space-y-2">
          <Label>动作</Label>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="请选择" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {Object.entries(actionLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setPageIndex(1);
            fetchLogs(actionFilter === "all" ? undefined : actionFilter, 1);
          }}
        >
          筛选
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setActionFilter("all");
            setKeyword("");
            setStartDate("");
            setEndDate("");
            setPageIndex(1);
            fetchLogs(undefined, 1);
          }}
        >
          重置
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>时间</TableHead>
              <TableHead>操作人</TableHead>
              <TableHead>动作</TableHead>
              <TableHead>对象</TableHead>
              <TableHead>结果</TableHead>
              <TableHead className="text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{new Date(row.created_at * 1000).toLocaleString()}</TableCell>
                <TableCell>{row.actor_operator_name || row.actor_operator_id || "-"}</TableCell>
                <TableCell>{getActionLabel(row.action)}</TableCell>
                <TableCell>{row.target_id || "-"}</TableCell>
                <TableCell>
                  <Badge variant={row.result === "success" ? "secondary" : "destructive"}>{row.result === "success" ? "成功" : "失败"}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Button variant="ghost" size="sm" onClick={() => openDetail(row)}>
                    详情
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500">
                  暂无审计记录
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {total > 0 ? (
        <Pagination className="justify-between">
          <p className="text-xs text-slate-500">
            共 {total} 条，当前第 {pageIndex}/{Math.max(1, Math.ceil(total / pageSize))} 页
          </p>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  setPageIndex((prev) => Math.max(1, prev - 1));
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  const totalPages = Math.max(1, Math.ceil(total / pageSize));
                  setPageIndex((prev) => Math.min(totalPages, prev + 1));
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>审计详情</DialogTitle>
            <DialogDescription>{activeRow ? getActionLabel(activeRow.action) : "-"}</DialogDescription>
          </DialogHeader>
          {activeRow ? (
            <div className="grid gap-3 text-sm text-slate-600">
              <div className="flex flex-wrap gap-6">
                <span>时间：{new Date(activeRow.created_at * 1000).toLocaleString()}</span>
                <span>操作人：{activeRow.actor_operator_name || activeRow.actor_operator_id || "-"}</span>
                <span>结果：{activeRow.result}</span>
              </div>
              <div className="flex flex-wrap gap-6">
                <span>对象类型：{activeRow.target_type || "-"}</span>
                <span>对象ID：{activeRow.target_id || "-"}</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">请求参数：{activeRow.request_json || "-"}</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                错误码：{activeRow.error_code || "-"}
                <br />
                错误详情：{activeRow.error_detail || "-"}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
