import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form"
import { Input } from "~/components/ui/input"
import { tauriInvoke } from "~/lib/tauri"
import { toast } from "sonner"

type ForceChangePasswordDialogProps = {
  open: boolean
  // 是否允许通过对话框右上角或点击遮罩关闭对话框，默认允许
  closable?: boolean
  onClose?: () => void
  onSuccess?: () => void
}

type ForceChangePasswordValues = {
  oldPassword: string
  nextPassword: string
  confirmPassword: string
}

export function ForceChangePasswordDialog({
  open,
  // 默认不允许关闭，除非父组件明确传入 `closable={true}`
  closable = false,
  onClose,
  onSuccess,
}: ForceChangePasswordDialogProps) {
  const [loading, setLoading] = useState(false)
  const form = useForm<ForceChangePasswordValues>({
    defaultValues: {
      oldPassword: "",
      nextPassword: "",
      confirmPassword: "",
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      oldPassword: "",
      nextPassword: "",
      confirmPassword: "",
    })
  }, [open])

  const handleSubmit = async (values: ForceChangePasswordValues) => {
    setLoading(true)
    try {
      await tauriInvoke("change_password", {
        oldPassword: values.oldPassword,
        newPassword: values.nextPassword,
      })
      toast.success("密码修改成功")
      onSuccess?.()
      // 提交成功后默认关闭对话框（如果父组件希望保持打开，可在 onSuccess 中决定）
      onClose?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : "修改失败"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // 当尝试关闭对话框（next === false）时，如果 closable 为 false 则阻止关闭
        if (!closable && !next) return
        if (!next) onClose?.()
      }}
    >
      <DialogContent showCloseButton={closable === true} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>修改密码</DialogTitle>
          <DialogDescription>完成修改后，下次登录请使用新密码</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit(handleSubmit)()
            }}
          >
            <FormField
              control={form.control}
              name="oldPassword"
              rules={{
                validate: (value) => (value.trim() ? true : "请输入旧密码"),
              }}
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel htmlFor="old-password">旧密码</FormLabel>
                  <FormControl>
                    <Input id="old-password" type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nextPassword"
              rules={{
                validate: (value) =>
                  value.length >= 6 ? true : "新密码至少 6 位",
              }}
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel htmlFor="new-password">新密码</FormLabel>
                  <FormControl>
                    <Input id="new-password" type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              rules={{
                validate: (value) =>
                  value === form.getValues("nextPassword")
                    ? true
                    : "两次输入的新密码不一致",
              }}
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel htmlFor="confirm-password">确认新密码</FormLabel>
                  <FormControl>
                    <Input id="confirm-password" type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "提交中..." : "确认修改"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
