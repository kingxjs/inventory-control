import { useEffect, useState } from "react"
import { open } from "@tauri-apps/plugin-dialog"
import { PageHeader } from "~/components/common/page-header"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { getSession } from "~/lib/auth"
import { tauriInvoke } from "~/lib/tauri"
import { toast } from "sonner"

export default function SettingsPage() {
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState({
    rbac_enabled: false,
    storage_root: "",
    slot_no_pad: 2,
    low_stock_threshold: 0,
  })


  const fetchSettings = async () => {
    setLoading(true)
    try {
      const result = await tauriInvoke<typeof settings>("get_settings")
      setSettings(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载失败"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const toggleRbac = async () => {
      try {
      await tauriInvoke("set_settings", {
        input: {
          rbac_enabled: !settings.rbac_enabled,
        },
      })
      toast.success("设置已更新")
      await fetchSettings()
    } catch (err) {
      const message = err instanceof Error ? err.message : "更新失败"
      toast.error(message)
    }
  }

  const changeStorageRoot = async () => {
    const selected = await open({ directory: true })
    if (!selected || Array.isArray(selected)) return
      try {
      await tauriInvoke("set_storage_root", {
        input: {
          new_path: selected,
        },
      })
      toast.success("迁移完成")
      await fetchSettings()
    } catch (err) {
      const message = err instanceof Error ? err.message : "迁移失败"
      toast.error(message)
    }
  }

  const handleExportItems = async () => {
      try {
      const result = await tauriInvoke<{ file_path: string }>("export_items", {
        input: {  },
      })
      toast.success(`导出成功：${result.file_path}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "导出失败"
      toast.error(message)
    }
  }

  const handleExportTxns = async () => {
      try {
      const result = await tauriInvoke<{ file_path: string }>("export_txns", {
        input: {  },
      })
      toast.success(`导出成功：${result.file_path}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "导出失败"
      toast.error(message)
    }
  }

  const handleImportItems = async () => {
    const selected = await open({ multiple: false })
    if (!selected || Array.isArray(selected)) return
      try {
      await tauriInvoke("import_items", {
        input: { file_path: selected },
      })
      toast.success("导入完成")
    } catch (err) {
      const message = err instanceof Error ? err.message : "导入失败"
      toast.error(message)
    }
  }

  const handleImportTxns = async () => {
    const selected = await open({ multiple: false })
    if (!selected || Array.isArray(selected)) return
      try {
      await tauriInvoke("import_txns", {
        input: { file_path: selected },
      })
      toast.success("导入完成")
    } catch (err) { 
      const message = err instanceof Error ? err.message : "导入失败"
      toast.error(message)
    }
  }

  const handleBackup = async () => {
      try {
      const result = await tauriInvoke<string>("backup_db", {
        input: {  },
      })
      toast.success(`备份完成：${result}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "备份失败"
      toast.error(message)
    }
  }

  const handleRestore = async () => {
    const selected = await open({ multiple: false })
    if (!selected || Array.isArray(selected)) return
      try {
      await tauriInvoke("restore_db", {
        input: { file_path: selected },
      })
      toast.success("恢复完成")
    } catch (err) {
      const message = err instanceof Error ? err.message : "恢复失败"
      toast.error(message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="系统设置"
        description="RBAC 配置、存储目录迁移、导入导出与备份恢复。"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>权限与角色</CardTitle>
            <CardDescription>RBAC 开关与角色策略</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>RBAC 状态</Label>
              <Input
                value={settings.rbac_enabled ? "当前：开启" : "当前：关闭"}
                readOnly
              />
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
              <Input value={settings.storage_root || "-"} readOnly />
            </div>
            <Button onClick={changeStorageRoot} disabled={loading}>
              选择新目录并迁移
            </Button>
          </CardContent>
        </Card>
        <Card className="border-slate-200/70">
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
        </Card>
        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>备份恢复</CardTitle>
            <CardDescription>数据库与文件索引备份</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleBackup}>立即备份</Button>
            <Button variant="destructive" onClick={handleRestore}>
              恢复备份
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
