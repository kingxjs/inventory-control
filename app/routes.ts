import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  layout("routes/guard.tsx", [
    layout("routes/_layout.tsx", [
      index("routes/dashboard.tsx"),
      route("warehouses", "routes/warehouses.tsx"),
      route("racks", "routes/racks.tsx"),
      route("items", "routes/items.tsx"),
      route("stock", "routes/stock.tsx"),
      route("txns", "routes/txns.tsx"),
      route("operators", "routes/operators.tsx"),
      route("audit", "routes/audit.tsx"),
      route("settings", "routes/settings.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
