import { createFileRoute, Outlet, redirect, Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listerSites, monProfil } from "@/lib/visites.functions";
import { choisirSiteAnalyse, useSiteAnalyse } from "@/lib/site-analyse";

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
  const chargerSites = useServerFn(listerSites);
  const { data: sites } = useQuery({
    queryKey: ["sites"],
    queryFn: () => chargerSites(),
    enabled: profil?.estSuperAdmin === true,
  });
  const siteAnalyse = useSiteAnalyse();
  const chemin = useRouterState({ select: (s) => s.location.pathname });
  const siteValide = (sites ?? []).find((s) => s.id === siteAnalyse) ?? null;
  // La super admin choisit d'abord le site à analyser (sauf pour gérer les sites).
  const doitChoisir =
    profil?.estSuperAdmin === true && sites !== undefined && !siteValide && chemin !== "/sites";

  async function seDeconnecter() {
    choisirSiteAnalyse("");
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/" className="text-sm font-semibold tracking-tight text-foreground">
            Nova Pass
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link
              to="/registre"
              className={lienClass}
              activeProps={{ className: "text-foreground font-medium" }}
            >
              Registre
            </Link>
            <Link
              to="/statistiques"
              className={lienClass}
              activeProps={{ className: "text-foreground font-medium" }}
            >
              Statistiques
            </Link>
            <Link
              to="/affiche"
              search={{ site: undefined }}
              className={lienClass}
              activeProps={{ className: "text-foreground font-medium" }}
            >
              Affiche PDF
            </Link>
            {profil?.estSuperAdmin && (
              <Link
                to="/sites"
                className={lienClass}
                activeProps={{ className: "text-foreground font-medium" }}
              >
                Sites et accès
              </Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {profil?.estSuperAdmin && siteValide && (
              <label className="flex items-center gap-2 text-muted-foreground">
                Site analysé
                <select
                  aria-label="Site analysé"
                  value={siteValide.id}
                  onChange={(e) => choisirSiteAnalyse(e.target.value)}
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm font-medium text-foreground"
                >
                  {(sites ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nom}
                    </option>
                  ))}
                </select>
              </label>
            )}
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
      {profil && !profil.estSuperAdmin && profil.siteNom && (
        <p className="mx-auto max-w-6xl px-4 pt-6 text-2xl font-semibold tracking-tight text-foreground print:hidden">
          Bienvenue chez {profil.siteNom}
        </p>
      )}
      {doitChoisir ? <ChoixSiteAnalyse sites={sites ?? []} /> : <Outlet />}
    </div>
  );
}

function ChoixSiteAnalyse({
  sites,
}: {
  sites: { id: string; nom: string; ville: string | null; logo_url: string | null }[];
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Quel site voulez-vous analyser ?
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Le registre, les statistiques et l'affiche porteront sur ce site. Vous pourrez en changer à
        tout moment depuis l'en-tête.
      </p>
      {sites.length === 0 ? (
        <p className="mt-6 text-sm text-foreground">
          Aucun site pour le moment.{" "}
          <Link to="/sites" className="text-primary underline">
            Créer un site
          </Link>
        </p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => choisirSiteAnalyse(s.id)}
                className="flex h-full w-full flex-col items-start gap-2 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary hover:bg-accent"
              >
                {s.logo_url && (
                  <img src={s.logo_url} alt="" className="h-10 w-auto max-w-full object-contain" />
                )}
                <span className="text-base font-semibold text-foreground">{s.nom}</span>
                {s.ville && <span className="text-sm text-muted-foreground">{s.ville}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-sm">
        <Link to="/sites" className="text-primary hover:underline">
          Gérer les sites et accès
        </Link>
      </p>
    </div>
  );
}
