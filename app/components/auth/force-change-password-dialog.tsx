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
  actorOperatorId: string
  onSuccess: () => void
}

type ForceChangePasswordValues = {
  oldPassword: string
  nextPassword: string
  confirmPassword: string
}

export function ForceChangePasswordDialog({
  open,
  actorOperatorId,
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
        actorOperatorId,
        oldPassword: values.oldPassword,
        newPassword: values.nextPassword,
      })
      toast.success("密码修改成功")
      onSuccess()
    } catch (err) {
      const message = err instanceof Error ? err.message : "修改失败"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>首次登录需修改密码</DialogTitle>
          <DialogDescription>完成修改后可继续使用系统</DialogDescription>
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
