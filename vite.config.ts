import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const isTauri =
  !!process.env.TAURI_PLATFORM ||
  !!process.env.TAURI_ARCH ||
  !!process.env.TAURI_DEBUG;

export default defineConfig(({ command }) => ({
  plugins: [reactRouter(), tsconfigPaths()],
  server: isTauri ? { hmr: false } : undefined,
}));
