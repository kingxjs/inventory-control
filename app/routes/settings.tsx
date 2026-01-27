import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { PageHeader } from "~/components/common/page-header";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "~/components/ui/input-group";
import { Label } from "~/components/ui/label";
import { tauriInvoke, openFolder } from "~/lib/tauri";
import { toast } from "sonner";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "~/components/ui/alert-dialog";
import { copyToClipboard } from "~/lib/utils";

export default function SettingsPage() {
  const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent || "");
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    rbac_enabled: false,
    storage_root: "",
    exports_dir: "",
    backups_dir: "",
    slot_no_pad: 2,
    low_stock_threshold: 0,
  });

  const copyText = async (text: string, label: string) => {
    if (!text || text === "-") return;
    const ok = await copyToClipboard(text);
    if (ok) {
      toast.success(`${label}已复制`);
    } else {
      toast.error("复制失败");
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const result = await tauriInvoke<typeof settings>("get_settings");
      setSettings(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载失败";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const toggleRbac = async () => {
    try {
      await tauriInvoke("set_settings", {
        input: {
          rbac_enabled: !settings.rbac_enabled,
        },
      });
      toast.success("设置已更新");
      await fetchSettings();
    } catch (err) {
      const message = err instanceof Error ? err.message : "更新失败";
      toast.error(message);
    }
  };

  const changeStorageRoot = async () => {
    if (isAndroid) {
      setPendingAction("storage");
      setPendingManualEdit(true);
      setManualPathInput(settings.storage_root || "");
      setDialogOpen(true);
      return;
    }
    const selected = await open({ directory: true });
    if (!selected || Array.isArray(selected)) return;
    setPendingPath(selected);
    setPendingManualEdit(false);
    setPendingAction("storage");
    setDialogOpen(true);
  };

  const changeExportsDir = async () => {
    if (isAndroid) {
      setPendingAction("exports");
      setPendingManualEdit(true);
      setManualPathInput(settings.exports_dir || "");
      setDialogOpen(true);
      return;
    }
    const selected = await open({ directory: true });
    if (!selected || Array.isArray(selected)) return;
    setPendingPath(selected);
    setPendingManualEdit(false);
    setPendingAction("exports");
    setDialogOpen(true);
  };

  const changeBackupsDir = async () => {
    if (isAndroid) {
      setPendingAction("backups");
      setPendingManualEdit(true);
      setManualPathInput(settings.backups_dir || "");
      setDialogOpen(true);
      return;
    }
    const selected = await open({ directory: true });
    if (!selected || Array.isArray(selected)) return;
    setPendingPath(selected);
    setPendingManualEdit(false);
    setPendingAction("backups");
    setDialogOpen(true);
  };

  // 确认弹窗相关状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"storage" | "exports" | "backups" | null>(null);
  const [pendingManualEdit, setPendingManualEdit] = useState(false);
  const [manualPathInput, setManualPathInput] = useState("");

  const performPendingChange = async () => {
    const nextPath = pendingManualEdit ? manualPathInput.trim() : pendingPath;
    if (!nextPath || !pendingAction) return;
    setDialogOpen(false);
    try {
      if (pendingAction === "storage") {
        await tauriInvoke("set_storage_root", { input: { new_path: nextPath } });
        toast.success("迁移完成");
      } else if (pendingAction === "exports") {
        await tauriInvoke("set_exports_dir", { input: { new_path: nextPath } });
        toast.success("导出目录已更新");
      } else if (pendingAction === "backups") {
        await tauriInvoke("set_backups_dir", { input: { new_path: nextPath } });
        toast.success("备份目录已更新");
      }
      await fetchSettings();
    } catch (err) {
      const message = err instanceof Error ? err.message : "更新失败";
      toast.error(message);
    } finally {
      setPendingPath(null);
      setPendingAction(null);
      setPendingManualEdit(false);
      setManualPathInput("");
    }
  };
  const handleOpenBackupsDir = async () => {
    try {
      if (isAndroid) {
        toast.message(`备份目录：\n${settings.backups_dir || "-"}`);
        return;
      }
      await openFolder(settings.backups_dir);
    } catch (err) {
      const message = err instanceof Error ? err.message : "打开失败";
      toast.error(message);
    }
  };
  const handleExportItems = async () => {
    try {
      const result = await tauriInvoke<{ file_path: string }>("export_items", {
        input: {},
      });
      toast.success(`导出成功：${result.file_path}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "导出失败";
      toast.error(message);
    }
  };

  const handleExportTxns = async () => {
    try {
      const result = await tauriInvoke<{ file_path: string }>("export_txns", {
        input: {},
      });
      toast.success(`导出成功：${result.file_path}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "导出失败";
      toast.error(message);
    }
  };

  const handleImportItems = async () => {
    const selected = await open({ multiple: false });
    if (!selected || Array.isArray(selected)) return;
    try {
      await tauriInvoke("import_items", {
        input: { file_path: selected },
      });
      toast.success("导入完成");
    } catch (err) {
      const message = err instanceof Error ? err.message : "导入失败";
      toast.error(message);
    }
  };

  const handleImportTxns = async () => {
    const selected = await open({ multiple: false });
    if (!selected || Array.isArray(selected)) return;
    try {
      await tauriInvoke("import_txns", {
        input: { file_path: selected },
      });
      toast.success("导入完成");
    } catch (err) {
      const message = err instanceof Error ? err.message : "导入失败";
      toast.error(message);
    }
  };

  const handleBackup = async () => {
    try {
      const result = await tauriInvoke<string>("backup_db", {
        input: {},
      });
      toast.success(`备份完成：${result}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "备份失败";
      toast.error(message);
    }
  };

  const handleRestore = async () => {
    const selected = await open({ multiple: false });
    if (!selected || Array.isArray(selected)) return;
    try {
      await tauriInvoke("restore_db", {
        input: { file_path: selected },
      });
      toast.success("恢复完成");
    } catch (err) {
      const message = err instanceof Error ? err.message : "恢复失败";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="系统设置" description="RBAC 配置、存储目录迁移、导入导出与备份恢复。" />

      <div className="grid gap-6">
        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>权限与角色</CardTitle>
            <CardDescription>RBAC 开关与角色策略</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>RBAC 状态</Label>
              <Input value={settings.rbac_enabled ? "当前：开启" : "当前：关闭"} readOnly />
            </div>
            <Button variant="outline" onClick={toggleRbac} disabled={loading}>
              切换 RBAC 状态
            </Button>
          </CardContent>
        </Card>
        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>存储目录</CardTitle>
            <CardDescription>修改存储根目录并自动迁移数据</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>当前目录</Label>
              <InputGroup>
                <InputGroupInput value={settings.storage_root || "-"} readOnly onClick={() => void copyText(settings.storage_root || "", "存储目录")} />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton onClick={changeStorageRoot}>选择</InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </div>
            <div className="grid gap-2">
              <Label>导出目录</Label>
              <InputGroup>
                <InputGroupInput value={settings.exports_dir || "-"} readOnly onClick={() => void copyText(settings.exports_dir || "", "导出目录")} />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton onClick={changeExportsDir}>选择</InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </div>
            <div className="grid gap-2">
              <Label>备份目录</Label>
              <InputGroup>
                <InputGroupInput value={settings.backups_dir || "-"} readOnly onClick={() => void copyText(settings.backups_dir || "", "备份目录")} />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton onClick={changeBackupsDir}>选择</InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </div>
          </CardContent>
        </Card>
        {/* <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>导入导出</CardTitle>
            <CardDescription>物品、货架、库存、人员数据</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" onClick={handleImportItems}>
              导入物品
            </Button>
            <Button variant="outline" onClick={handleImportTxns}>
              导入流水
            </Button>
            <Button variant="outline" onClick={handleExportItems}>
              导出物品
            </Button>
            <Button variant="outline" onClick={handleExportTxns}>
              导出流水
            </Button>
          </CardContent>
        </Card> */}
        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>备份恢复</CardTitle>
            <CardDescription>数据库与文件索引备份</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Button onClick={handleBackup}>立即备份</Button>
            <Button variant="destructive" onClick={handleRestore}>
              恢复备份
            </Button>
            <Button variant="secondary" onClick={handleOpenBackupsDir}>
              打开备份目录
            </Button>
          </CardContent>
        </Card>
      </div>
      {/* 确认对话框：在选择目录后二次确认 */}
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction === "storage" ? "确认迁移存储根目录" : pendingAction === "exports" ? "确认更新导出目录" : "确认更新备份目录"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingManualEdit ? (
                <div className="grid gap-2">
                  <span>请输入目录绝对路径：</span>
                  <Input value={manualPathInput} onChange={(e) => setManualPathInput(e.target.value)} />
                </div>
              ) : pendingAction === "storage" ? (
                <>
                  你选择的目录：
                  <br />
                  <strong>{pendingPath}</strong>
                  <br />
                  迁移将把现有数据从旧目录移动到新目录，操作不可逆，请确认是否保存并开始迁移。
                </>
              ) : (
                <>
                  你选择的目录：
                  <br />
                  <strong>{pendingPath}</strong>
                  <br />
                  是否将该目录保存为新的配置？
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
              <AlertDialogCancel
              onClick={() => {
                setDialogOpen(false);
                setPendingPath(null);
                setPendingAction(null);
                setPendingManualEdit(false);
                setManualPathInput("");
              }}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction onClick={performPendingChange}>确认</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
