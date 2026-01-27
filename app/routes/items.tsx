import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { useForm } from "react-hook-form"
import { PageHeader } from "~/components/common/page-header"
import { ImagePicker } from "~/components/common/image-picker"
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
import { Textarea } from "~/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "~/components/ui/input-group"
import { ChevronDownIcon } from "lucide-react"
import { getSession } from "~/lib/auth"
import { tauriInvoke } from "~/lib/tauri"
import { usePhotoList } from "~/lib/use-photo-list"
import { toast } from "sonner"

type ItemRow = {
  id: string
  item_code: string
  name: string
  model?: string | null
  spec?: string | null
  uom?: string | null
  stock_qty: number
  status: string
  remark?: string | null
  created_at: number
}

type ItemListResult = {
  items: ItemRow[]
  total: number
}

type PhotoRow = {
  id: string
  data_id: string
  photo_type: string
  file_path: string
  created_at: number
}

type PhotoListResult = {
  items: PhotoRow[]
}

type SettingsDto = {
  storage_root: string
}

const generateItemCode = () => {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)
  return `T${stamp}`
}

type ItemFormValues = {
  code: string
  name: string
  model: string
  spec: string
  uom: string
  remark: string
}

export default function ItemsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<ItemRow[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState("")
  const [status, setStatus] = useState("all")
  const [formOpen, setFormOpen] = useState(false)
  const [editRow, setEditRow] = useState<ItemRow | null>(null)
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const {
    paths: selectedPhotoPaths,
    setPaths: setSelectedPhotoPaths,
    reset: resetSelectedPhotoPaths,
  } = usePhotoList()
  const [photoRows, setPhotoRows] = useState<PhotoRow[]>([])
  const [photoLoading, setPhotoLoading] = useState(false)
  const [storageRoot, setStorageRoot] = useState("")
  const form = useForm<ItemFormValues>({
    defaultValues: {
      code: "",
      name: "",
      model: "",
      spec: "",
      uom: "",
      remark: "",
    },
  })

  const fetchItems = async (keywordValue?: string, page = pageIndex) => {
    setLoading(true)
    try {
      const result = await tauriInvoke<ItemListResult>("list_items", {
        query: {
          keyword: keywordValue || undefined,
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
      void fetchItems(keyword, pageIndex)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [pageIndex, keyword])

  const resetForm = () => {
    form.reset({
      code: "",
      name: "",
      model: "",
      spec: "",
      uom: "",
      remark: "",
    })
    resetSelectedPhotoPaths()
    setPhotoRows([])
  }

  const openCreate = () => {
    setEditRow(null)
    resetForm()
    form.setValue("code", generateItemCode())
    setFormOpen(true)
  }

  const openEdit = (row: ItemRow) => {
    setEditRow(row)
    form.reset({
      code: row.item_code,
      name: row.name,
      model: row.model || "",
      spec: row.spec || "",
      uom: row.uom || "",
      remark: row.remark || "",
    })
    resetSelectedPhotoPaths()
    setFormOpen(true)
    fetchPhotos(row.id)
  }

  const handleSubmit = async (values: ItemFormValues) => {
    const code = values.code.trim()
    const name = values.name.trim()
    const model = values.model.trim()
    const spec = values.spec.trim()
    const uom = values.uom.trim()
    const remark = values.remark.trim()
    // if (!model.trim()) {
    //   toast.error("请输入设备型号")
    //   return
    // }
    // if (!spec.trim()) {
    //   toast.error("请输入规格")
    //   return
    // }
    try {
      let itemId = editRow?.id || ""
      if (editRow) {
        await tauriInvoke("update_item", {
          input: {
            id: editRow.id,
            name,
            model: model || null,
            spec: spec || null,
            uom: uom || null,
            remark: remark || null,
          },
        })
        toast.success("物品更新成功")
      } else {
        await tauriInvoke("create_item", {
          input: {
            item_code: code,
            name,
            model: model || null,
            spec: spec || null,
            uom: uom || null,
            remark: remark || null,
          },
        })
        toast.success("物品创建成功")
        const lookup = await tauriInvoke<ItemListResult>("list_items", {
          query: {
            keyword: code,
            page_index: 1,
            page_size: 10,
          },
        })
        const match = lookup.items.find((item) => item.item_code === code)
        itemId = match?.id || ""
      }
      if (itemId) {
        await uploadSelectedPhotos(itemId)
      } else if (selectedPhotoPaths.length > 0) {
        toast.error("图片上传失败：未找到物品")
      }
      setFormOpen(false)
      resetForm()
      await fetchItems(keyword)
    } catch (err) {
      const message = err instanceof Error ? err.message : "保存失败"
      toast.error(message)
    }
  }

  const handleToggleStatus = async (row: ItemRow) => {
    
    const nextStatus = row.status === "active" ? "inactive" : "active"
    try {
      await tauriInvoke("set_item_status", {
        input: {
          id: row.id,
          status: nextStatus,
        },
      })
      toast.success("状态更新成功")
      await fetchItems(keyword)
    } catch (err) {
      const message = err instanceof Error ? err.message : "更新失败"
      toast.error(message)
    }
  }

  const handleFilter = async () => {
    setPageIndex(1)
    await fetchItems(keyword, 1)
  }

  const filteredRows =
    status === "all" ? rows : rows.filter((row) => row.status === status)

  const fetchPhotos = async (itemId: string) => {
    setPhotoLoading(true)
    try {
      const [photos, settings] = await Promise.all([
        tauriInvoke<PhotoListResult>("list_photos", {
          query: {
            photo_type: "item",
            data_id: itemId,
          },
        }),
        tauriInvoke<SettingsDto>("get_settings"),
      ])
      setPhotoRows(photos.items)
      setStorageRoot(settings.storage_root || "")
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载图片失败"
      toast.error(message)
    } finally {
      setPhotoLoading(false)
    }
  }

  const buildPhotoPath = (filePath: string) => {
    if (!storageRoot) return ""
    const root = storageRoot.replace(/\\+/g, "/")
    return `${root}/${filePath}`.replace(/\/{2,}/g, "/")
  }

  const uploadedPhotoPaths = useMemo(
    () => photoRows.map((photo) => buildPhotoPath(photo.file_path)).filter(Boolean),
    [photoRows, storageRoot],
  )
  const uploadedPhotoByPath = useMemo(() => {
    const entries = photoRows
      .map((photo) => {
        const path = buildPhotoPath(photo.file_path)
        return path ? ([path, photo] as const) : null
      })
      .filter(Boolean) as Array<readonly [string, PhotoRow]>
    return new Map<string, PhotoRow>(entries)
  }, [photoRows, storageRoot])

  const uploadSelectedPhotos = async (itemId: string) => {
    if (selectedPhotoPaths.length === 0) return
    try {
      await tauriInvoke("add_photos", {
        input: {
          photo_type: "item",
          data_id: itemId,
          src_paths: selectedPhotoPaths,
        },
      })
      toast.success("图片上传成功")
      resetSelectedPhotoPaths()
      await fetchPhotos(itemId)
    } catch (err) {
      const message = err instanceof Error ? err.message : "图片上传失败"
      toast.error(message)
    }
  }

  const handleRemoveUploadedPhoto = async (photo: PhotoRow) => {
    try {
      await tauriInvoke("remove_photo", {
        input: {
          photo_type: "item",
          data_id: photo.data_id,
          photo_id: photo.id,
        },
      })
      toast.success("图片已删除")
      setPhotoRows((prev) => prev.filter((row) => row.id !== photo.id))
    } catch (err) {
      const message = err instanceof Error ? err.message : "图片删除失败"
      toast.error(message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="物品管理"
        description="管理物品基础信息与图片。"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">批量导入</Button>
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}>新增物品</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editRow ? "编辑物品" : "新增物品"}</DialogTitle>
                  <DialogDescription>填写物品信息并上传图片</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      void form.handleSubmit(handleSubmit)()
                    }}
                    className="grid gap-4 md:grid-cols-2"
                  >
                    <FormField
                      control={form.control}
                      name="code"
                      rules={{
                        validate: (value) =>
                          editRow || value.trim() ? true : "请输入物品编号",
                      }}
                      render={({ field }) => (
                        <FormItem className="grid gap-2">
                          <FormLabel htmlFor="item-code">物品编号</FormLabel>
                          <FormControl>
                            <Input
                              id="item-code"
                              placeholder="T0004"
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
                      name="name"
                      rules={{
                        validate: (value) =>
                          value.trim() ? true : "请输入物品名称",
                      }}
                      render={({ field }) => (
                        <FormItem className="grid gap-2">
                          <FormLabel htmlFor="item-name">物品名称</FormLabel>
                          <FormControl>
                            <Input id="item-name" placeholder="新物品" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem className="grid gap-2">
                          <FormLabel htmlFor="item-model">设备型号</FormLabel>
                          <FormControl>
                            <Input id="item-model" placeholder="型号" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="spec"
                      render={({ field }) => (
                        <FormItem className="grid gap-2">
                          <FormLabel htmlFor="item-spec">规格</FormLabel>
                          <FormControl>
                            <Input id="item-spec" placeholder="规格" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="uom"
                      render={({ field }) => (
                        <FormItem className="grid gap-2">
                          <FormLabel htmlFor="item-uom">单位</FormLabel>
                          <FormControl>
                            <InputGroup>
                              <InputGroupInput
                                id="item-uom"
                                placeholder="可手动填写"
                                value={field.value}
                                onChange={field.onChange}
                              />
                              <InputGroupAddon align="inline-end">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <InputGroupButton
                                      variant="ghost"
                                      className="!pr-1.5 text-xs"
                                    >
                                      {field.value || "选择单位"}{" "}
                                      <ChevronDownIcon className="size-3" />
                                    </InputGroupButton>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="[--radius:0.95rem]"
                                  >
                                    {["件", "台", "箱", "套", "个"].map((option) => (
                                      <DropdownMenuItem
                                        key={option}
                                        onClick={() => field.onChange(option)}
                                      >
                                        {option}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </InputGroupAddon>
                            </InputGroup>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="remark"
                      render={({ field }) => (
                        <FormItem className="grid gap-2 md:col-span-2">
                          <FormLabel htmlFor="item-remark">备注</FormLabel>
                          <FormControl>
                            <Textarea
                              id="item-remark"
                              placeholder="补充说明"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <ImagePicker
                      photoType="item"
                      value={selectedPhotoPaths}
                      onChange={setSelectedPhotoPaths}
                    />
                    {editRow ? (
                      <div className="grid gap-2 md:col-span-2">
                        <Label>已上传图片</Label>
                        {photoLoading ? (
                          <div className="text-xs text-slate-500">加载中...</div>
                        ) : photoRows.length > 0 ? (
                          <ImagePicker
                            photoType="item"
                            value={uploadedPhotoPaths}
                            mode="preview"
                            onRemove={(path) => {
                              const photo = uploadedPhotoByPath.get(path)
                              if (photo) {
                                void handleRemoveUploadedPhoto(photo)
                              }
                            }}
                          />
                        ) : (
                          <div className="text-xs text-slate-500">暂无图片</div>
                        )}
                      </div>
                    ) : null}
                    <ConfirmButton
                      className="w-full md:col-span-2"
                      label="保存"
                      confirmText="确认提交物品信息？"
                      onBeforeConfirmOpen={() => form.trigger()}
                      onConfirm={() => form.handleSubmit(handleSubmit)()}
                    />
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
        <div className="min-w-[140px] w-[140px] max-w-[140px] flex-1 space-y-2">
          <Label>搜索</Label>
          <Input
            placeholder="名称/编号/型号"
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
        <Button variant="outline" onClick={handleFilter}>
          筛选
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setKeyword("")
            setStatus("all")
            setPageIndex(1)
            fetchItems(undefined, 1)
          }}
        >
          重置
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>物品编号</TableHead>
              <TableHead>名称</TableHead>
              <TableHead>型号</TableHead>
              <TableHead>单位</TableHead>
              <TableHead>库存数</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>更新时间</TableHead>
              <TableHead className="text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.item_code}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.model || "-"}</TableCell>
                <TableCell>{row.uom || "-"}</TableCell>
                <TableCell>{row.stock_qty}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "active" ? "secondary" : "outline"}>
                    {row.status === "active" ? "启用" : "停用"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(row.created_at * 1000).toLocaleString()}
                </TableCell>
                <TableCell className="text-center">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                    编辑
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        更多
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          navigate(`/stock?tab=item&item_id=${encodeURIComponent(row.id)}`)
                        }}
                      >
                        查看库存
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          navigate(`/txns?item_id=${encodeURIComponent(row.id)}`)
                        }}
                      >
                        查看流水
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleToggleStatus(row)}
                      >
                        {row.status === "active" ? "停用" : "启用"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {!loading && filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-500">
                  暂无物品数据
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
