import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { PageHeader } from "~/components/common/page-header"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { ConfirmButton } from "~/components/common/confirm-button"
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "~/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { getSession } from "~/lib/auth"
import { tauriInvoke } from "~/lib/tauri"
import { toast } from "sonner"

type OperatorRow = {
  id: string
  username: string
  display_name: string
  role: string
  status: string
  must_change_pwd: boolean
  created_at: number
}

type OperatorListResult = {
  items: OperatorRow[]
  total: number
}

type OperatorFormValues = {
  username: string
  displayName: string
  role: string
  password: string
}

type ResetPasswordValues = {
  password: string
}

export default function OperatorsPage() {
  const [rows, setRows] = useState<OperatorRow[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState("")
  const [status, setStatus] = useState("all")
  const [formOpen, setFormOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [editRow, setEditRow] = useState<OperatorRow | null>(null)
  const [resetTarget, setResetTarget] = useState<OperatorRow | null>(null)
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const form = useForm<OperatorFormValues>({
    defaultValues: {
      username: "",
      displayName: "",
      role: "admin",
      password: "",
    },
  })
  const roleValue = form.watch("role")
  const isMemberRole = roleValue === "member"
  const resetForm = useForm<ResetPasswordValues>({
    defaultValues: {
      password: "",
    },
  })

  const fetchOperators = async (keywordValue?: string, statusValue?: string, page = pageIndex) => {
    setLoading(true)
    try {
      const trimmed = keywordValue?.trim()
      const result = await tauriInvoke<OperatorListResult>("list_operators", {
        query: {
          keyword: trimmed || undefined,
          status: statusValue,
          page_index: page,
          page_size: pageSize,
        },
      })
      setRows(result.items)
      setTotal(result.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载失败"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchOperators(keyword, status === "all" ? undefined : status, pageIndex)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [pageIndex, keyword, status])

  const resetEditForm = () => {
    form.reset({
      username: "",
      displayName: "",
      role: "admin",
      password: "",
    })
  }

  const openCreate = () => {
    setEditRow(null)
    resetEditForm()
    setFormOpen(true)
  }

  const openEdit = (row: OperatorRow) => {
    setEditRow(row)
    form.reset({
      username: row.username,
      displayName: row.display_name,
      role: row.role,
      password: "",
    })
    setFormOpen(true)
  }

  const handleSubmit = async (values: OperatorFormValues) => {
    try {
      if (editRow) {
        await tauriInvoke("update_operator", {
          input: {
            id: editRow.id,
            display_name: values.displayName.trim(),
            role: values.role,
          },
        })
        toast.success("人员更新成功")
      } else {
        await tauriInvoke("create_operator", {
          input: {
            username: values.username.trim(),
            display_name: values.displayName.trim(),
            role: values.role,
            password: values.password,
            status: "active",
          },
        })
        toast.success("人员创建成功")
      }
      setFormOpen(false)
      resetEditForm()
      await fetchOperators(keyword, status === "all" ? undefined : status, pageIndex)
    } catch (err) {
      const message = err instanceof Error ? err.message : "保存失败"
      toast.error(message)
    }
  }

  const handleToggleStatus = async (row: OperatorRow) => {
    const nextStatus = row.status === "active" ? "inactive" : "active"
    try {
      await tauriInvoke("set_operator_status", {
        input: {
          id: row.id,
          status: nextStatus,
        },
      })
      toast.success("状态更新成功")
      await fetchOperators(keyword, status === "all" ? undefined : status, pageIndex)
    } catch (err) {
      const message = err instanceof Error ? err.message : "更新失败"
      toast.error(message)
    }
  }

  const openReset = (row: OperatorRow) => {
    setResetTarget(row)
    resetForm.reset({ password: "" })
    setResetOpen(true)
  }

  const handleReset = async (values: ResetPasswordValues) => {
    if (!resetTarget) return
    try {
      await tauriInvoke("reset_operator_password", {
        input: {
          id: resetTarget.id,
          new_password: values.password,
        },
      })
      toast.success("密码重置成功")
      setResetOpen(false)
      setResetTarget(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "重置失败"
      toast.error(message)
    }
  }

  const filteredRows = rows

  return (
    <div className="space-y-6">
      <PageHeader
        title="人员管理"
        description="管理账号、角色与状态。"
        actions={
          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>新增人员</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editRow ? "编辑人员" : "新增人员"}</DialogTitle>
                <DialogDescription>创建新账号并设置角色</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void form.handleSubmit(handleSubmit)()
                  }}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="username"
                    rules={{
                      validate: (value) =>
                        editRow || value.trim() ? true : "请输入账号",
                    }}
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                        <FormLabel htmlFor="operator-username">账号</FormLabel>
                        <FormControl>
                          <Input
                            id="operator-username"
                            placeholder="username"
                            disabled={Boolean(editRow)}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="displayName"
                    rules={{
                      validate: (value) =>
                        value.trim() ? true : "请输入人员姓名",
                    }}
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                        <FormLabel htmlFor="operator-name">姓名</FormLabel>
                        <FormControl>
                          <Input id="operator-name" placeholder="姓名" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    rules={{
                      validate: (value) => (value ? true : "请选择角色"),
                    }}
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                        <FormLabel htmlFor="operator-role">角色</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="请选择" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">管理员</SelectItem>
                              <SelectItem value="keeper">保管员</SelectItem>
                              <SelectItem value="member">成员</SelectItem>
                              <SelectItem value="viewer">只读</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {!editRow ? (
                    <FormField
                      control={form.control}
                      name="password"
                      rules={{
                        validate: (value) => {
                          if (editRow || isMemberRole) return true
                          return value.trim() ? true : "请输入初始密码"
                        },
                      }}
                      render={({ field }) => (
                        <FormItem className="grid gap-2">
                          <FormLabel htmlFor="operator-password">初始密码</FormLabel>
                          <FormControl>
                            <Input
                              id="operator-password"
                              type="password"
                              placeholder="请输入密码"
                              {...field}
                            />
                          </FormControl>
                          {isMemberRole ? (
                            <p className="text-xs text-slate-500">
                              成员账号可不设置初始密码
                            </p>
                          ) : null}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}
                  <ConfirmButton
                    className="w-full"
                    label="保存"
                    confirmText={editRow ? "确认保存人员变更？" : "确认创建人员？"}
                    onBeforeConfirmOpen={() => form.trigger()}
                    onConfirm={() => form.handleSubmit(handleSubmit)()}
                  />
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
        <div className="min-w-[140px] w-[140px] max-w-[140px] flex-1 space-y-2">
          <Label>搜索</Label>
          <Input
            placeholder="账号/姓名"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        <div className="flex-1 space-y-2">
          <Label>状态</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="请选择" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="active">启用</SelectItem>
              <SelectItem value="inactive">停用</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setPageIndex(1)
            fetchOperators(keyword,status === "all" ? undefined : status, 1)
          }}
        >
          筛选
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setKeyword("")
            setStatus("all")
            setPageIndex(1)
            fetchOperators("",undefined, 1)
          }}
        >
          重置
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>账号</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>需改密</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.username}</TableCell>
                <TableCell>{row.display_name}</TableCell>
                <TableCell>
                  {row.role === "admin"
                    ? "管理员"
                    : row.role === "keeper"
                    ? "保管员"
                    : row.role === "member"
                    ? "成员"
                    : "只读"}
                </TableCell>
                <TableCell>
                  <Badge variant={row.status === "active" ? "secondary" : "outline"}>
                    {row.status === "active" ? "启用" : "停用"}
                  </Badge>
                </TableCell>
                <TableCell>{row.must_change_pwd ? "是" : "否"}</TableCell>
                <TableCell>
                  {new Date(row.created_at * 1000).toLocaleString()}
                </TableCell>
                <TableCell className="text-center">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                    编辑
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openReset(row)}>
                    重置密码
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleStatus(row)}
                  >
                    {row.status === "active" ? "停用" : "启用"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-500">
                  暂无人员数据
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
            <DialogDescription>
              {resetTarget ? `账号：${resetTarget.username}` : "选择账号"}
            </DialogDescription>
          </DialogHeader>
          <Form {...resetForm}>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void resetForm.handleSubmit(handleReset)()
              }}
              className="space-y-4"
            >
              <FormField
                control={resetForm.control}
                name="password"
                rules={{
                  validate: (value) =>
                    value.trim() ? true : "请输入新密码",
                }}
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <FormLabel htmlFor="reset-password">新密码</FormLabel>
                    <FormControl>
                      <Input
                        id="reset-password"
                        type="password"
                        placeholder="请输入新密码"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <ConfirmButton
                className="w-full"
                label="确认重置"
                confirmText="确认重置密码？"
                onBeforeConfirmOpen={() => resetForm.trigger()}
                onConfirm={() => resetForm.handleSubmit(handleReset)()}
              />
            </form>
          </Form>
        </DialogContent>
      </Dialog>

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
                  event.preventDefault()
                  setPageIndex((prev) => Math.max(1, prev - 1))
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault()
                  const totalPages = Math.max(1, Math.ceil(total / pageSize))
                  setPageIndex((prev) => Math.min(totalPages, prev + 1))
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  )
}
