import { useState } from "react";
import { ForceChangePasswordDialog } from "~/components/auth/force-change-password-dialog";
import { AppShell } from "~/components/layout/app-shell";
import { getSession, updateSession, type Session } from "~/lib/auth";

export default function AppLayout() {
  const [session, setSessionState] = useState<Session | null>(() => {
    if (typeof window === "undefined") return null;
    return getSession();
  });

  const handlePasswordChanged = () => {
    updateSession({ must_change_pwd: false });
    const current = getSession();
    setSessionState(current);
  };
  return (
    <>
      <AppShell />
      {session?.must_change_pwd ? (
        <ForceChangePasswordDialog
          open={session.must_change_pwd}
          actorOperatorId={session.actor_operator_id}
          onSuccess={handlePasswordChanged}
        />
      ) : null}
    </>
  );
}
