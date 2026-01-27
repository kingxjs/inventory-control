import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useNavigate } from "react-router"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form"
import { Input } from "~/components/ui/input"
import { setSession, useSession } from "~/lib/auth"
import {
  clearCredentials,
  loadSavedCredentials,
  saveCredentials,
} from "~/lib/credentials"
import { tauriInvoke } from "~/lib/tauri"
import { toast } from "sonner"

type LoginResponse = {
  actor_operator_id: string
  must_change_pwd: boolean
}

type LoginFormValues = {
  username: string
  password: string
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [remember, setRemember] = useState(false)
  const form = useForm<LoginFormValues>({
    defaultValues: {
      username: "",
      password: "",
    },
  })
  const session = useSession()
  useEffect(() => {
    if (session) {
      navigate("/", { replace: true })
    }
  }, [navigate, session])

  useEffect(() => {
    let mounted = true
    loadSavedCredentials().then((saved) => {
      if (!mounted || !saved) return
      form.setValue("username", saved.username)
      form.setValue("password", saved.password)
      setRemember(true)
    })
    return () => {
      mounted = false
    }
  }, [])

  const handleSubmit = async (values: LoginFormValues) => {
    const username = values.username.trim()
    const password = values.password
    setLoading(true)
    try {
      const result = await tauriInvoke<LoginResponse>("login", {
        username,
        password,
      })
      setSession({
        actor_operator_id: result.actor_operator_id,
        must_change_pwd: result.must_change_pwd,
        username,
      })
      if (remember) {
        await saveCredentials({ username, password })
      } else {
        clearCredentials()
      }
      toast.success("登录成功")
      navigate("/", { replace: true })
    } catch (err) {
      let message = "登录失败"
      if (err && typeof err === "object") {
        const rawMessage = (err as { message?: unknown }).message
        if (typeof rawMessage === "string") {
          try {
            const parsed = JSON.parse(rawMessage) as { message?: string }
            message = parsed.message || rawMessage
          } catch {
            message = rawMessage
          }
        } else if (rawMessage) {
          message = String(rawMessage)
        }
      } else if (typeof err === "string") {
        message = err
      }
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fef6e5,_#edf4ff_40%,_#f7f7f2_70%)] px-4 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[80vh] max-w-5xl flex-col items-center justify-center gap-10 lg:flex-row">
        <div className="max-w-lg space-y-6">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
            Secure Local Client
          </p>
          <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
            物品出入库登记系统
          </h1>
          <p className="text-base text-slate-600">
            支持本地 持久化与离线操作。请使用管理员账号登录，首次登录需修改密码。
          </p>
        </div>
        <Card className="w-full max-w-md border-slate-200/80 bg-white/90 shadow-xl shadow-slate-200/60 backdrop-blur">
          <CardHeader>
            <CardTitle>登录</CardTitle>
            <CardDescription>请输入账号密码继续操作</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
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
                  name="username"
                  rules={{
                    validate: (value) => (value.trim() ? true : "请输入账号"),
                  }}
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel htmlFor="username">账号</FormLabel>
                      <FormControl>
                        <Input
                          id="username"
                          placeholder="admin"
                          autoComplete="username"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  rules={{
                    validate: (value) => (value.trim() ? true : "请输入密码"),
                  }}
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel htmlFor="password">密码</FormLabel>
                      <FormControl>
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="请输入密码"
                          autoComplete="current-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <button
                          type="button"
                          className="transition hover:text-slate-900"
                          onClick={() => setShowPassword((value) => !value)}
                        >
                          {showPassword ? "隐藏密码" : "显示密码"}
                        </button>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-slate-900"
                            checked={remember}
                            onChange={(event) => setRemember(event.target.checked)}
                          />
                          保存账号密码
                        </label>
                      </div>
                    </FormItem>
                  )}
                />
                <Button className="w-full" type="submit" disabled={loading}>
                  {loading ? "登录中..." : "登录"}
                </Button>
              </form>
            </Form>
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              登录成功后如提示“必须修改密码”，将自动弹出改密窗口。
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
