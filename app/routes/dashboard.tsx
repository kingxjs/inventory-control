import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "~/components/ui/chart"
import { getSession } from "~/lib/auth"
import { tauriInvoke } from "~/lib/tauri"
import { toast } from "sonner"

type DashboardTxnCounts = {
  inbound: number
  outbound: number
  move_count: number
  count_count: number
  reversal: number
}

type DashboardTrendPoint = {
  day: string
  inbound: number
  outbound: number
  move_count: number
  count_count: number
}

type DashboardWarehouseStock = {
  warehouse_code?: string | null
  warehouse_name?: string | null
  total_qty: number
}

type DashboardOverview = {
  today: DashboardTxnCounts
  total_stock_qty: number
  active_items: number
  active_racks: number
  active_warehouses: number
  negative_stock: number
  trend: DashboardTrendPoint[]
  stock_by_warehouse: DashboardWarehouseStock[]
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchOverview = async () => {
    setLoading(true)
    try {
      const result = await tauriInvoke<DashboardOverview>("get_dashboard_overview", {
        query: {  },
      })
      setOverview(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载仪表盘失败"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOverview()
  }, [])

  const primaryCards = useMemo(() => {
    if (!overview) return []
    return [
      { title: "今日入库", value: overview.today.inbound },
      { title: "今日出库", value: overview.today.outbound },
      { title: "库存总量", value: overview.total_stock_qty },
      { title: "库存异常", value: overview.negative_stock },
    ]
  }, [overview])

  const secondaryMetrics = useMemo(() => {
    if (!overview) return []
    return [
      { title: "移库次数", value: overview.today.move_count },
      { title: "盘点批次", value: overview.today.count_count },
      { title: "冲正次数", value: overview.today.reversal },
      { title: "启用物品", value: overview.active_items },
      { title: "启用货架", value: overview.active_racks },
      { title: "启用仓库", value: overview.active_warehouses },
    ]
  }, [overview])

  const formatDayLabel = (value: string) => value.slice(5).replace("-", "/")

  const trendData = useMemo(() => {
    if (!overview) return []
    return overview.trend.map((point) => ({
      ...point,
      day_label: formatDayLabel(point.day),
    }))
  }, [overview])

  const stockData = useMemo(() => {
    if (!overview) return []
    return overview.stock_by_warehouse.map((row) => ({
      label:
        row.warehouse_code && row.warehouse_name
          ? `${row.warehouse_code} · ${row.warehouse_name}`
          : row.warehouse_name || "未分配",
      total_qty: row.total_qty,
    }))
  }, [overview])

  const quickActions = [
    { label: "入库", path: "/stock?open=inbound" },
    { label: "出库", path: "/stock?open=outbound" },
    { label: "移库", path: "/stock?open=move" },
    { label: "盘点", path: "/stock?open=count" },
    { label: "库存管理", path: "/stock" },
    { label: "流水查询", path: "/txns" },
  ]

  const alerts = (() => {
    if (!overview) return []
    const items = []
    if (overview.negative_stock > 0) {
      items.push({
        title: "负库存预警",
        detail: `存在 ${overview.negative_stock} 个异常库存记录待处理。`,
        action: "查看库存",
        path: "/stock",
      })
    }
    if (items.length === 0) {
      items.push({
        title: "暂无异常",
        detail: "目前未发现负库存或占用冲突。",
        action: "刷新数据",
        path: "",
      })
    }
    return items
  })()

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">今日概览</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate("/stock")}>
            进入库存管理
          </Button>
          <Button onClick={() => navigate("/txns?date_type=day")}>查看今日流水</Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {primaryCards.length === 0 ? (
          <Card className="border-slate-200/70 bg-white sm:col-span-2 xl:col-span-4">
            <CardHeader className="space-y-2">
              <CardTitle className="text-sm text-slate-500">
                数据加载中
              </CardTitle>
              <p className="text-3xl font-semibold text-slate-900">
                {loading ? "正在刷新..." : "暂无数据"}
              </p>
            </CardHeader>
          </Card>
        ) : (
          primaryCards.map((card) => (
            <Card key={card.title} className="border-slate-200/70 bg-white">
              <CardHeader className="space-y-2">
                <CardTitle className="text-sm text-slate-500">
                  {card.title}
                </CardTitle>
                <p className="text-3xl font-semibold text-slate-900">{card.value}</p>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
      <Card className="border-slate-200/70 bg-white">
        <CardHeader>
          <CardTitle>快捷入口</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              className="justify-start"
              onClick={() => navigate(action.path)}
            >
              {action.label}
            </Button>
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-6">
          <Card className="border-slate-200/70 bg-white">
            <CardHeader>
              <CardTitle>近 7 天入库 / 出库趋势</CardTitle>
            </CardHeader>
            <CardContent>
              {overview && trendData.length > 0 ? (
                <ChartContainer
                  className="h-56 w-full aspect-auto"
                  config={{
                    inbound: { label: "入库", color: "var(--chart-1)" },
                    outbound: { label: "出库", color: "var(--chart-2)" },
                  }}
                >
                  <BarChart data={trendData} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="day_label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={28} />
                    <ChartTooltip
                      cursor={{ fill: "rgba(148,163,184,0.12)" }}
                      content={<ChartTooltipContent />}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="inbound" fill="var(--color-inbound)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="outbound" fill="var(--color-outbound)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-slate-500">暂无趋势数据</p>
              )}
            </CardContent>
          </Card>
          <Card className="border-slate-200/70 bg-white">
            <CardHeader>
              <CardTitle>库存分布</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {overview && stockData.length > 0 ? (
                <ChartContainer
                  className="h-56 w-full aspect-auto"
                  config={{ total_qty: { label: "库存量", color: "var(--chart-3)" } }}
                >
                  <BarChart data={stockData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} />
                    <YAxis
                      dataKey="label"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      width={90}
                    />
                    <ChartTooltip
                      cursor={{ fill: "rgba(148,163,184,0.12)" }}
                      content={<ChartTooltipContent />}
                    />
                    <Bar dataKey="total_qty" fill="var(--color-total_qty)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-slate-500">暂无库存数据</p>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-6">
          <Card className="border-slate-200/70 bg-white">
            <CardHeader>
              <CardTitle>运营概览</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {secondaryMetrics.length === 0 ? (
                <p className="text-sm text-slate-500">暂无数据</p>
              ) : (
                secondaryMetrics.map((metric) => (
                  <div key={metric.title} className="flex items-center justify-between">
                    <span className="text-slate-500">{metric.title}</span>
                    <span className="font-semibold text-slate-900">{metric.value}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card className="border-slate-200/70 bg-white">
            <CardHeader>
              <CardTitle>预警清单</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {alerts.map((alert) => (
                <div
                  key={alert.title}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {alert.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{alert.detail}</p>
                  <Button
                    variant="link"
                    className="mt-2 px-0"
                    onClick={() => {
                      if (alert.path) {
                        navigate(alert.path)
                      } else {
                        fetchOverview()
                      }
                    }}
                  >
                    {alert.action}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
