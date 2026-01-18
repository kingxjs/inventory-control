import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { getSession, type Session } from "~/lib/auth";

export default function GuardRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(() => getSession());

  useEffect(() => {
    const session = getSession();
    setSession(session);
    if (!session && location.pathname !== "/login") {
      navigate("/login", { replace: true });
      window.setTimeout(() => {
        if (window.location.pathname !== "/login") {
          window.location.replace("/login");
        }
      }, 0);
    }
  }, [location.pathname, navigate]);

  if (!session && location.pathname !== "/login") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        正在跳转登录页…
      </div>
    );
  }

  return <Outlet />;
}
