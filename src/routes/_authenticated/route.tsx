import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { monProfil } from "@/lib/visites.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

const lienClass = "text-muted-foreground hover:text-foreground";

function Layout() {
  const queryClient = useQueryClient();
  const charger = useServerFn(monProfil);
  const { data: profil } = useQuery({ queryKey: ["monProfil"], queryFn: () => charger() });

  async function seDeconnecter() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/" className="text-sm font-semibold tracking-tight text-foreground">
            Nova Pass
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link to="/registre" className={lienClass} activeProps={{ className: "text-foreground font-medium" }}>
              Registre
            </Link>
            {profil?.estSuperAdmin && (
              <>
                <Link to="/sites" className={lienClass} activeProps={{ className: "text-foreground font-medium" }}>
                  Sites
                </Link>
                <Link to="/comptes" className={lienClass} activeProps={{ className: "text-foreground font-medium" }}>
                  Comptes
                </Link>
              </>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">
              {profil?.email}
              {profil?.estSuperAdmin
                ? " · super admin"
                : profil?.siteNom
                  ? ` · ${profil.siteNom}`
                  : ""}
            </span>
            <button
              onClick={seDeconnecter}
              className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-accent"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
