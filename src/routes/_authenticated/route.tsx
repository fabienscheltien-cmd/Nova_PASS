import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/" className="text-sm font-semibold tracking-tight text-foreground">
            Accueil visiteurs
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link
              to="/registre"
              className="text-muted-foreground hover:text-foreground"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              Registre
            </Link>
            <Link
              to="/reglages"
              className="text-muted-foreground hover:text-foreground"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              Réglages
            </Link>
          </nav>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/auth";
            }}
            className="ml-auto rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent"
          >
            Se déconnecter
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
