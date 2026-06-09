import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth";

/**
 * Wrap admin-only pages with this component to enforce the admin role.
 * Renders nothing while checking, then either the children or redirects to login.
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");

  useEffect(() => {
    let cancelled = false;
    getCurrentUser().then((user) => {
      if (cancelled) return;
      console.log("[RequireAdmin] user:", user);
      if (user?.role === "admin") {
        setStatus("allowed");
      } else {
        setStatus("denied");
        navigate({ to: "/admin/login", replace: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (status !== "allowed") {
    return <div className="min-h-screen bg-background" />;
  }

  return <>{children}</>;
}
