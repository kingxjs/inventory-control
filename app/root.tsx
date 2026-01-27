import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { useEffect, useRef, useState } from "react";
import { useSession } from "./lib/auth";
import { tauriInvoke } from "./lib/tauri";
import { Toaster } from "~/components/ui/sonner";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <Toaster position="top-center" theme="light" />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const initStartRef = useRef<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const session = useSession();

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    if (initStartRef.current === null) {
      initStartRef.current = Date.now();
    }
    const init = async () => {
      try {
        if (session) {
          await tauriInvoke("get_settings");
        }
      } catch {
        // 忽略初始化错误，避免阻塞进入登录页
      } finally {
        const start = initStartRef.current ?? Date.now();
        const elapsed = Date.now() - start;
        const minDelay = 200;
        const remaining = Math.max(0, minDelay - elapsed);
        window.setTimeout(() => {
          if (mounted) {
            setInitialized(true);
          }
        }, remaining);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [session]);

  useEffect(() => {
    if (hydrated && initialized) {
      tauriInvoke("close_splashscreen").catch(() => undefined);
    }
  }, [hydrated, initialized]);

  if (!hydrated || !initialized) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
          <p className="text-sm text-slate-600">正在加载…</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
