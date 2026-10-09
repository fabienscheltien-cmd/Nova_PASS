import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listerSites, listerVisites, monProfil } from "@/lib/visites.functions";

export const Route = createFileRoute("/_authenticated/statistiques")({
  head: () => ({
    meta: [
      { title: "Statistiques de fréquentation — Nova Pass" },
      {
        name: "description",
        content: "Nombre de visiteurs par jour, par semaine et par mois, par site.",
      },
      { property: "og:title", content: "Statistiques de fréquentation — Nova Pass" },
      { property: "og:description", content: "Suivi de la fréquentation des accueils." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Statistiques,
});

type Periode = "jour" | "semaine" | "mois";

function cle(d: Date, p: Periode) {
  const pad = (n: number) => String(n).padStart(2, "0");
  if (p === "jour") return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (p === "mois") return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const lundi = new Date(d);
  lundi.setHours(0, 0, 0, 0);
  lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7));
  return `${lundi.getFullYear()}-${pad(lundi.getMonth() + 1)}-${pad(lundi.getDate())}`;
}

function libelle(k: string, p: Periode) {
  if (p === "mois") {
    const [a, m] = k.split("-");
    return new Date(Number(a), Number(m) - 1, 1).toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });
  }
  const d = new Date(`${k}T00:00:00`);
  const txt = d.toLocaleDateString("fr-FR", {
    weekday: p === "jour" ? "short" : undefined,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return p === "semaine" ? `Semaine du ${txt}` : txt;
}

const NB: Record<Periode, number> = { jour: 30, semaine: 12, mois: 12 };

function Statistiques() {
  const chargerVisites = useServerFn(listerVisites);
  const chargerSites = useServerFn(listerSites);
  const chargerProfil = useServerFn(monProfil);
  const [siteId, setSiteId] = useState("");
  const [periode, setPeriode] = useState<Periode>("jour");
  const { data: profil } = useQuery({ queryKey: ["monProfil"], queryFn: () => chargerProfil() });
  const { data: sites } = useQuery({ queryKey: ["sites"], queryFn: () => chargerSites() });

  const du = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  // Statistiques toujours par site : la super admin choisit le site (le premier
  // par défaut), un compte de site voit uniquement le sien.
  const siteChoisi = profil?.estSuperAdmin ? siteId || sites?.[0]?.id : undefined;
  const nomSite = profil?.estSuperAdmin
    ? (sites ?? []).find((s) => s.id === siteChoisi)?.nom
    : profil?.siteNom;
  const { data: visites, isLoading } = useQuery({
    queryKey: ["stats", siteChoisi, du],
    queryFn: () => chargerVisites({ data: { du, siteId: siteChoisi } }),
    enabled: profil !== undefined && (!profil.estSuperAdmin || siteChoisi !== undefined),
  });

  const { lignes, max, totaux } = useMemo(() => {
    const maintenant = new Date();
    const comptes = new Map<string, number>();
    for (const v of visites ?? []) {
      const k = cle(new Date(v.arrivee_at), periode);
      comptes.set(k, (comptes.get(k) ?? 0) + 1);
    }
    const cles: string[] = [];
    const d = new Date(maintenant);
    for (let i = 0; i < NB[periode]; i++) {
      const k = cle(d, periode);
      if (!cles.includes(k)) cles.push(k);
      if (periode === "jour") d.setDate(d.getDate() - 1);
      else if (periode === "semaine") d.setDate(d.getDate() - 7);
      else d.setMonth(d.getMonth() - 1, 1);
    }
    const lignes = cles.map((k) => ({ k, n: comptes.get(k) ?? 0 }));
    const compter = (p: Periode) =>
      (visites ?? []).filter((v) => cle(new Date(v.arrivee_at), p) === cle(maintenant, p)).length;
    return {
      lignes,
      max: Math.max(1, ...lignes.map((l) => l.n)),
      totaux: { jour: compter("jour"), semaine: compter("semaine"), mois: compter("mois") },
    };
  }, [visites, periode]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Statistiques</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nombre de visiteurs enregistrés{nomSite ? ` · ${nomSite}` : ""}.
          </p>
        </div>
        {profil?.estSuperAdmin && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground" htmlFor="stats-site">
              Site
            </label>
            <select
              id="stats-site"
              value={siteChoisi ?? ""}
              onChange={(e) => setSiteId(e.target.value)}
              className="mt-1 min-w-56 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              {(sites ?? []).length === 0 && <option value="">Aucun site</option>}
              {(sites ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {(
          [
            ["Aujourd'hui", totaux.jour],
            ["Cette semaine", totaux.semaine],
            ["Ce mois-ci", totaux.mois],
          ] as const
        ).map(([t, n]) => (
          <div key={t} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t}</p>
            <p className="mt-2 text-4xl font-semibold text-foreground">{isLoading ? "…" : n}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex gap-2">
          {(["jour", "semaine", "mois"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriode(p)}
              className={`rounded-md px-3 py-1.5 text-sm ${periode === p ? "bg-primary text-primary-foreground" : "border border-border text-foreground hover:bg-accent"}`}
            >
              Par {p}
            </button>
          ))}
        </div>
        <ul className="mt-5 space-y-2">
          {lignes.map((l) => (
            <li key={l.k} className="grid grid-cols-[170px_1fr_40px] items-center gap-3 text-sm">
              <span className="truncate capitalize text-muted-foreground">
                {libelle(l.k, periode)}
              </span>
              <span className="h-3 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${(l.n / max) * 100}%` }}
                />
              </span>
              <span className="text-right font-medium text-foreground">{l.n}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
