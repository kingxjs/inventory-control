import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, Link, useLocation, useNavigate } from "react-router";
import { cn } from "~/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "~/components/ui/dropdown-menu";
import { ForceChangePasswordDialog } from "~/components/auth/force-change-password-dialog";
import { clearSession, getSession, type Session } from "~/lib/auth";
import { tauriInvoke } from "~/lib/tauri";

const navSections = [
  {
    title: "概览",
    items: [{ to: "/", label: "仪表盘" }],
  },
  {
    title: "物品与库存",
    items: [
      { to: "/stock", label: "库存管理" },
      { to: "/items", label: "物品管理" },
      { to: "/txns", label: "流水查询" },
    ],
  },
  {
    title: "仓库管理",
    items: [
      { to: "/warehouses", label: "仓库管理" },
      { to: "/racks", label: "货架结构" },
    ],
  },
  {
    title: "人员与审计",
    items: [
      { to: "/operators", label: "人员管理" },
      { to: "/audit", label: "操作日志" },
    ],
  },
  {
    title: "系统",
    items: [{ to: "/settings", label: "系统设置" }],
  },
];

export function AppShell() {
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const openTimer = useRef<number | null>(null);
  const [forceChangeOpen, setForceChangeOpen] = useState(false);
  const [session, setSessionState] = useState<Session | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const breadcrumbMap: Record<string, string> = {
    "/": "仪表盘",
    "/warehouses": "仓库管理",
    "/racks": "货架结构",
    "/items": "物品管理",
    "/stock": "库存管理",
    "/txns": "流水查询",
    "/operators": "人员管理",
    "/audit": "操作日志",
    "/settings": "系统设置",
  };
  const path = location.pathname === "/" ? "/" : location.pathname.replace(/\/$/, "");
  const currentLabel = breadcrumbMap[path] ?? "页面";

  useEffect(() => {
    setSessionState(getSession());
  }, []);

  const handleLogout = () => {
    const actorId = session?.actor_operator_id;
    if (actorId) {
      tauriInvoke("logout", { actorOperatorId: actorId }).catch(() => null);
    }
    clearSession();
    setSessionState(null);
    setAccountOpen(false);
    navigate("/login", { replace: true });
  };
  const displayName = session?.username || "Admin";

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#f6f1e8,_#f3f6fb_35%,_#f7f7f2_70%)] text-slate-900">
      <div className="mx-auto flex h-screen min-h-0 max-w-[1600px] gap-6 px-4 py-6 lg:px-6">
        <aside className="hidden w-64 flex-col overflow-y-scroll rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm backdrop-blur lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">INV</div>
            <div>
              <p className="text-sm font-semibold">出入库登记</p>
              <p className="text-xs text-slate-500">Inventory Control</p>
            </div>
          </div>
          <div className="mt-8 flex flex-1 flex-col gap-6">
            {navSections.map((section) => (
              <div key={section.title} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{section.title}</p>
                <div className="flex flex-col gap-1">
                  {section.items.map((item) => (
                    <NavLink key={item.to} to={item.to} className={({ isActive }) => cn("rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900", isActive && "bg-slate-900 text-white hover:bg-slate-900 hover:text-white")}>
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>
        <div className="flex h-full min-h-0 flex-1 flex-col gap-6 overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200/70 bg-white/80 px-6 py-4 shadow-sm backdrop-blur">
            <nav aria-label="面包屑导航" className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Inventory Control</p>
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
                <Link to="/" className="transition hover:text-slate-900">
                  出入库登记系统
                </Link>
                <span className="text-slate-300">/</span>
                <span className="text-slate-900">{currentLabel}</span>
              </div>
            </nav>
            <div className="flex items-center gap-3">
              <DropdownMenu open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full cursor-pointer bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                    onMouseEnter={() => {
                      // 清除关闭定时器
                      if (closeTimer.current) {
                        window.clearTimeout(closeTimer.current);
                        closeTimer.current = null;
                      }
                      if (openTimer.current) {
                        window.clearTimeout(openTimer.current);
                        openTimer.current = null;
                      }
                      // 立即打开或使用很短的延迟
                      setAccountMenuOpen(true);
                    }}
                    // 移除 onMouseLeave，让下拉内容控制关闭
                  >
                    {displayName}
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  side="bottom"
                  align="end"
                  className="mt-2" // 添加一点间距，让鼠标更容易移动过去
                  onMouseEnter={() => {
                    // 清除关闭定时器
                    if (closeTimer.current) {
                      window.clearTimeout(closeTimer.current);
                      closeTimer.current = null;
                    }
                    setAccountMenuOpen(true);
                  }}
                  onMouseLeave={() => {
                    // 鼠标离开下拉内容时才关闭
                    closeTimer.current = window.setTimeout(() => {
                      setAccountMenuOpen(false);
                    }, 200);
                  }}
                >
                  <DropdownMenuItem
                    onSelect={() => {
                      setAccountOpen(true);
                      setAccountMenuOpen(false);
                    }}
                  >
                    个人信息
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      setAccountMenuOpen(false);
                      setForceChangeOpen(true);
                    }}
                  >
                    修改密码
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      setAccountMenuOpen(false);
                      handleLogout();
                    }}
                  >
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/70 bg-white/70 p-3 text-sm font-medium text-slate-600 shadow-sm backdrop-blur lg:hidden">
            {navSections
              .flatMap((section) => section.items)
              .map((item) => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => cn("rounded-full px-4 py-2 transition hover:bg-slate-100 hover:text-slate-900", isActive && "bg-slate-900 text-white hover:bg-slate-900 hover:text-white")}>
                  {item.label}
                </NavLink>
              ))}
          </nav>
          <main className="flex-1 overflow-y-scroll rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-sm backdrop-blur">
            <Outlet />
          </main>
        </div>
      </div>
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>当前账号</DialogTitle>
            <DialogDescription>查看账号信息与角色</DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <p>当前账号：{displayName}</p>
            <p className="mt-2">角色：全权限</p>
          </div>
          <button type="button" className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900" onClick={handleLogout}>
            退出登录
          </button>
        </DialogContent>
      </Dialog>
      {forceChangeOpen ? <ForceChangePasswordDialog open={forceChangeOpen} closable={true} onSuccess={() => setForceChangeOpen(false)} onClose={() => setForceChangeOpen(false)} /> : null}
    </div>
  );
}
