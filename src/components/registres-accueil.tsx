import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { neutraliserFormule } from "@/lib/export";
import { useSiteDeTravail } from "@/lib/site-analyse";
import {
  ajouterDepot,
  ajouterObjetTrouve,
  ajouterVisiteManuelle,
  CATEGORIES_DEPOT,
  listerDepots,
  listerObjetsTrouves,
  marquerDepotRemis,
  marquerObjetRestitue,
  type CategorieDepot,
} from "@/lib/registres.functions";

export const inputClass =
  "rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40";
const labelClass = "block text-xs font-medium text-muted-foreground";

export const LIBELLES_CATEGORIE: Record<CategorieDepot, string> = {
  courrier: "Courrier",
  colis: "Colis",
  cles: "Clés",
  autre: "Autre",
};

export type Site = { id: string; nom: string };

export const LIBELLES_STATUT = {
  en_attente: "En attente",
  restitue: "Restitué",
  recu: "Reçu",
  remis: "Remis",
} as const;
type CleStatut = keyof typeof LIBELLES_STATUT;

function ChoixStatut({
  valeur,
  onChange,
  options,
}: {
  valeur: string;
  onChange: (v: string) => void;
  options: CleStatut[];
}) {
  return (
    <div>
      <label className={labelClass} htmlFor="f-statut">
        Statut
      </label>
      <select
        id="f-statut"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 ${inputClass}`}
      >
        <option value="">Tous</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {LIBELLES_STATUT[o]}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Badge de statut + action à sens unique (confirmée, sans retour arrière). */
function Statut({
  libelle,
  final,
  depuis,
  action,
}: {
  libelle: string;
  final: boolean;
  depuis: string | null;
  action?:
    | { libelle: string; confirmation: string; executer: () => Promise<unknown>; cles: string[][] }
    | undefined;
}) {
  const queryClient = useQueryClient();
  const [envoi, setEnvoi] = useState(false);
  return (
    <div className="flex flex-col items-start gap-1">
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          final ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
        }`}
      >
        {libelle}
      </span>
      {final && depuis && (
        <span className="text-[11px] text-muted-foreground">{formatFr(depuis)}</span>
      )}
      {action && (
        <button
          disabled={envoi}
          onClick={async () => {
            if (!confirm(action.confirmation)) return;
            setEnvoi(true);
            try {
              await action.executer();
              for (const cle of action.cles) await queryClient.invalidateQueries({ queryKey: cle });
            } catch (err) {
              alert(err instanceof Error ? err.message : "Action impossible.");
            } finally {
              setEnvoi(false);
            }
          }}
          className="rounded-md border border-border px-2 py-0.5 text-xs text-foreground hover:bg-accent disabled:opacity-50"
        >
          {action.libelle}
        </button>
      )}
    </div>
  );
}

export type Profil = { estSuperAdmin: boolean; siteId: string | null } | undefined;

/** Seul le compte d'un site ajoute des entrées ; la super admin consulte. */
export function peutAjouter(profil: Profil) {
  return profil !== undefined && !profil.estSuperAdmin && profil.siteId !== null;
}

export function formatFr(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

/** Valeur par défaut d'un champ datetime-local : maintenant, heure du navigateur. */
export function maintenantLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Export Excel ou CSV (formules neutralisées dans le CSV). */
export async function exporter(
  lignes: Record<string, string>[],
  nom: string,
  format: "xlsx" | "csv",
) {
  const XLSX = await import("xlsx");
  const fichier = `${nom}-${new Date().toISOString().slice(0, 10)}`;
  if (format === "xlsx") {
    const classeur = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(classeur, XLSX.utils.json_to_sheet(lignes), "Registre");
    XLSX.writeFile(classeur, `${fichier}.xlsx`);
    return;
  }
  const surs = lignes.map((l) =>
    Object.fromEntries(Object.entries(l).map(([k, v]) => [k, neutraliserFormule(v)])),
  );
  const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(surs));
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fichier}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export type Filtres = {
  du: string;
  heureDu: string;
  au: string;
  heureAu: string;
  recherche: string;
};
export const filtresVides: Filtres = { du: "", heureDu: "", au: "", heureAu: "", recherche: "" };

export function versRequete(f: Filtres, siteId: string | undefined) {
  return {
    du: f.du || undefined,
    heureDu: f.du && f.heureDu ? f.heureDu : undefined,
    au: f.au || undefined,
    heureAu: f.au && f.heureAu ? f.heureAu : undefined,
    recherche: f.recherche,
    siteId,
  };
}

export function BarreFiltres({
  filtres,
  onChange,
  placeholder,
  children,
}: {
  filtres: Filtres;
  onChange: (f: Filtres) => void;
  placeholder: string;
  children?: ReactNode;
}) {
  const maj = (k: keyof Filtres) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...filtres, [k]: e.target.value });
  return (
    <div className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      {children}
      <DateHeure
        id="f-du"
        label="Du"
        date={filtres.du}
        heure={filtres.heureDu}
        onDate={(v) => onChange({ ...filtres, du: v })}
        onHeure={(v) => onChange({ ...filtres, heureDu: v })}
      />
      <DateHeure
        id="f-au"
        label="Au"
        date={filtres.au}
        heure={filtres.heureAu}
        onDate={(v) => onChange({ ...filtres, au: v })}
        onHeure={(v) => onChange({ ...filtres, heureAu: v })}
      />
      <div className="min-w-[200px] flex-1">
        <label className={labelClass} htmlFor="f-q">
          Recherche
        </label>
        <input
          id="f-q"
          value={filtres.recherche}
          onChange={maj("recherche")}
          placeholder={placeholder}
          className={`mt-1 w-full ${inputClass}`}
        />
      </div>
      <button
        onClick={() => onChange(filtresVides)}
        className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-accent"
      >
        Réinitialiser
      </button>
    </div>
  );
}

/** Champ « date + heure » d'un filtre ; l'heure est facultative (journée entière). */
function DateHeure({
  id,
  label,
  date,
  heure,
  onDate,
  onHeure,
}: {
  id: string;
  label: string;
  date: string;
  heure: string;
  onDate: (v: string) => void;
  onHeure: (v: string) => void;
}) {
  return (
    <fieldset>
      <legend className={labelClass}>{label}</legend>
      <div className="mt-1 flex gap-1">
        <input
          id={id}
          aria-label={`${label} : date`}
          type="date"
          value={date}
          onChange={(e) => onDate(e.target.value)}
          className={inputClass}
        />
        <input
          id={`${id}-heure`}
          aria-label={`${label} : heure`}
          type="time"
          value={heure}
          disabled={!date}
          title={date ? "Facultatif" : "Choisissez d'abord une date"}
          onChange={(e) => onHeure(e.target.value)}
          className={`${inputClass} w-28 disabled:opacity-50`}
        />
      </div>
    </fieldset>
  );
}

export function BoutonsExport({
  onExport,
  desactive,
}: {
  onExport: (f: "xlsx" | "csv") => void;
  desactive: boolean;
}) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onExport("xlsx")}
        disabled={desactive}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        Export Excel
      </button>
      <button
        onClick={() => onExport("csv")}
        disabled={desactive}
        className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
      >
        Export CSV
      </button>
    </div>
  );
}

/** Formulaire d'ajout repliable (aucune suppression possible ensuite : on le rappelle). */
function PanneauAjout({
  autorise,
  titre,
  ouvert,
  setOuvert,
  onSubmit,
  erreur,
  envoi,
  children,
}: {
  autorise: boolean;
  titre: string;
  ouvert: boolean;
  setOuvert: (v: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  erreur: string | null;
  envoi: boolean;
  children: ReactNode;
}) {
  if (!autorise) return null;
  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        className="mt-6 rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
      >
        + {titre}
      </button>
    );
  }
  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 grid gap-4 rounded-xl border border-primary/40 bg-card p-5 sm:grid-cols-2"
    >
      <p className="text-sm font-semibold text-foreground sm:col-span-2">{titre}</p>
      {children}
      {erreur && <p className="text-sm text-destructive sm:col-span-2">{erreur}</p>}
      <p className="text-xs text-muted-foreground sm:col-span-2">
        Une fois enregistrée, l'entrée ne peut plus être modifiée ni supprimée du registre.
      </p>
      <div className="flex gap-2 sm:col-span-2">
        <button
          disabled={envoi}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {envoi ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-accent"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

function Champ({
  id,
  label,
  large,
  children,
}: {
  id: string;
  label: string;
  large?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={large ? "sm:col-span-2" : undefined}>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

/** Logique commune des formulaires d'ajout. */
function useAjout<T extends Record<string, string>>(initial: () => T, cles: string[][]) {
  const queryClient = useQueryClient();
  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState(initial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const set =
    (k: keyof T) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  async function soumettre(action: () => Promise<unknown>) {
    setErreur(null);
    setEnvoi(true);
    try {
      await action();
      setForm(initial());
      setOuvert(false);
      for (const cle of cles) queryClient.invalidateQueries({ queryKey: cle });
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setEnvoi(false);
    }
  }
  return { ouvert, setOuvert, form, setForm, set, erreur, envoi, soumettre };
}

// ---------- Visiteurs : saisie manuelle ----------

export function AjoutVisiteur({ profil }: { profil: Profil }) {
  const ajouter = useServerFn(ajouterVisiteManuelle);
  const a = useAjout(
    () => ({
      prenom: "",
      nom: "",
      entreprise: "",
      entrepriseVisitee: "",
      personneVisitee: "",
      arriveeAt: maintenantLocal(),
    }),
    [["visites"], ["stats"]],
  );
  return (
    <PanneauAjout
      autorise={peutAjouter(profil)}
      titre="Ajouter un visiteur manuellement"
      ouvert={a.ouvert}
      setOuvert={a.setOuvert}
      erreur={a.erreur}
      envoi={a.envoi}
      onSubmit={(e) => {
        e.preventDefault();
        const { arriveeAt, ...reste } = a.form;
        void a.soumettre(() =>
          ajouter({
            data: {
              ...reste,
              arriveeAt: new Date(arriveeAt).toISOString(),
            },
          }),
        );
      }}
    >
      {(
        [
          ["prenom", "Prénom", 80],
          ["nom", "Nom", 80],
          ["entreprise", "Entreprise du visiteur", 120],
          ["entrepriseVisitee", "Entreprise visitée", 120],
          ["personneVisitee", "Personne visitée", 120],
        ] as const
      ).map(([k, label, max]) => (
        <Champ key={k} id={`v-${k}`} label={label}>
          <input
            id={`v-${k}`}
            required
            maxLength={max}
            value={a.form[k]}
            onChange={a.set(k)}
            className={`mt-1 w-full ${inputClass}`}
          />
        </Champ>
      ))}
      <Champ id="v-arrivee" label="Date et heure d'arrivée">
        <input
          id="v-arrivee"
          type="datetime-local"
          required
          value={a.form.arriveeAt}
          onChange={a.set("arriveeAt")}
          className={`mt-1 w-full ${inputClass}`}
        />
      </Champ>
    </PanneauAjout>
  );
}

// ---------- Objets trouvés ----------

export function RegistreObjets({ profil }: { profil: Profil }) {
  const charger = useServerFn(listerObjetsTrouves);
  const ajouter = useServerFn(ajouterObjetTrouve);
  const [statut, setStatut] = useState<"" | "en_attente" | "restitue">("");
  const restituer = useServerFn(marquerObjetRestitue);
  const [filtres, setFiltres] = useState(filtresVides);
  const siteTravail = useSiteDeTravail(profil);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["objets", filtres, siteTravail, statut],
    queryFn: () =>
      charger({ data: { ...versRequete(filtres, siteTravail), ...(statut ? { statut } : {}) } }),
    refetchInterval: 30000,
  });
  const a = useAjout(
    () => ({
      objet: "",
      emplacement: "",
      observation: "",
      trouveAt: maintenantLocal(),
    }),
    [["objets"]],
  );
  const lignes = data ?? [];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {lignes.length} objet{lignes.length > 1 ? "s" : ""} trouvé{lignes.length > 1 ? "s" : ""}
        </p>
        <BoutonsExport
          desactive={lignes.length === 0}
          onExport={(f) =>
            exporter(
              lignes.map((o) => ({
                "Date et heure": formatFr(o.trouve_at),
                Site: o.sites?.nom ?? "",
                Objet: o.objet,
                Emplacement: o.emplacement,
                Observation: o.observation,
                Statut: LIBELLES_STATUT[o.statut],
                "Date du statut": o.statut_at ? formatFr(o.statut_at) : "",
              })),
              "objets-trouves",
              f,
            )
          }
        />
      </div>

      <PanneauAjout
        autorise={peutAjouter(profil)}
        titre="Déclarer un objet trouvé"
        ouvert={a.ouvert}
        setOuvert={a.setOuvert}
        erreur={a.erreur}
        envoi={a.envoi}
        onSubmit={(e) => {
          e.preventDefault();
          const { trouveAt, ...reste } = a.form;
          void a.soumettre(() =>
            ajouter({
              data: {
                ...reste,
                trouveAt: new Date(trouveAt).toISOString(),
              },
            }),
          );
        }}
      >
        <Champ id="o-objet" label="Objet">
          <input
            id="o-objet"
            required
            maxLength={160}
            value={a.form.objet}
            onChange={a.set("objet")}
            placeholder="Ex. trousseau de clés, parapluie noir…"
            className={`mt-1 w-full ${inputClass}`}
          />
        </Champ>
        <Champ id="o-lieu" label="Emplacement où il a été trouvé">
          <input
            id="o-lieu"
            maxLength={160}
            value={a.form.emplacement}
            onChange={a.set("emplacement")}
            className={`mt-1 w-full ${inputClass}`}
          />
        </Champ>
        <Champ id="o-date" label="Date et heure">
          <input
            id="o-date"
            type="datetime-local"
            required
            value={a.form.trouveAt}
            onChange={a.set("trouveAt")}
            className={`mt-1 w-full ${inputClass}`}
          />
        </Champ>
        <Champ id="o-obs" label="Observation (description de l'objet)" large>
          <textarea
            id="o-obs"
            rows={3}
            maxLength={2000}
            value={a.form.observation}
            onChange={a.set("observation")}
            className={`mt-1 w-full ${inputClass}`}
          />
        </Champ>
      </PanneauAjout>

      <BarreFiltres
        filtres={filtres}
        onChange={setFiltres}
        placeholder="Objet, emplacement, observation…"
      >
        <ChoixStatut
          valeur={statut}
          onChange={(v) => setStatut(v as typeof statut)}
          options={["en_attente", "restitue"]}
        />
      </BarreFiltres>

      <Tableau
        entetes={["Date et heure", "Site", "Objet", "Emplacement", "Observation", "Statut"]}
        isLoading={isLoading}
        isError={isError}
        vide="Aucun objet trouvé pour ces critères."
        lignes={lignes.map((o) => ({
          id: o.id,
          cellules: [
            formatFr(o.trouve_at),
            o.sites?.nom ?? "—",
            o.objet,
            o.emplacement,
            o.observation,
            <Statut
              key="statut"
              libelle={LIBELLES_STATUT[o.statut]}
              final={o.statut === "restitue"}
              depuis={o.statut_at}
              action={
                peutAjouter(profil) && o.statut === "en_attente"
                  ? {
                      libelle: "Marquer restitué",
                      confirmation: `Confirmer la restitution de « ${o.objet} » ? Cette action est définitive.`,
                      executer: () => restituer({ data: { id: o.id } }),
                      cles: [["objets"]],
                    }
                  : undefined
              }
            />,
          ],
        }))}
      />
    </>
  );
}

// ---------- Courrier, colis, clés, autre ----------

export function RegistreDepots({ profil }: { profil: Profil }) {
  const charger = useServerFn(listerDepots);
  const ajouter = useServerFn(ajouterDepot);
  const [statut, setStatut] = useState<"" | "recu" | "remis">("");
  const remettre = useServerFn(marquerDepotRemis);
  const [filtres, setFiltres] = useState(filtresVides);
  const siteTravail = useSiteDeTravail(profil);
  const [categorie, setCategorie] = useState<CategorieDepot | "">("");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["depots", filtres, categorie, siteTravail, statut],
    queryFn: () =>
      charger({
        data: {
          ...versRequete(filtres, siteTravail),
          ...(categorie ? { categorie } : {}),
          ...(statut ? { statut } : {}),
        },
      }),
    refetchInterval: 30000,
  });
  const a = useAjout(
    () => ({
      categorie: "courrier",
      destinataire: "",
      expediteur: "",
      description: "",
      recuAt: maintenantLocal(),
    }),
    [["depots"]],
  );
  const lignes = data ?? [];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {lignes.length} entrée{lignes.length > 1 ? "s" : ""}
        </p>
        <BoutonsExport
          desactive={lignes.length === 0}
          onExport={(f) =>
            exporter(
              lignes.map((d) => ({
                "Date et heure": formatFr(d.recu_at),
                Site: d.sites?.nom ?? "",
                Catégorie: LIBELLES_CATEGORIE[d.categorie],
                Destinataire: d.destinataire,
                "Expéditeur / transporteur": d.expediteur,
                Description: d.description,
                Statut: LIBELLES_STATUT[d.statut],
                "Date du statut": d.statut_at ? formatFr(d.statut_at) : "",
              })),
              "courrier-colis-cles",
              f,
            )
          }
        />
      </div>

      <PanneauAjout
        autorise={peutAjouter(profil)}
        titre="Enregistrer un courrier, colis, clé…"
        ouvert={a.ouvert}
        setOuvert={a.setOuvert}
        erreur={a.erreur}
        envoi={a.envoi}
        onSubmit={(e) => {
          e.preventDefault();
          const { recuAt, categorie: cat, ...reste } = a.form;
          void a.soumettre(() =>
            ajouter({
              data: {
                ...reste,
                categorie: cat as CategorieDepot,
                recuAt: new Date(recuAt).toISOString(),
              },
            }),
          );
        }}
      >
        <Champ id="d-cat" label="Catégorie">
          <select
            id="d-cat"
            value={a.form.categorie}
            onChange={a.set("categorie")}
            className={`mt-1 w-full ${inputClass}`}
          >
            {CATEGORIES_DEPOT.map((c) => (
              <option key={c} value={c}>
                {LIBELLES_CATEGORIE[c]}
              </option>
            ))}
          </select>
        </Champ>
        <Champ id="d-dest" label="Destinataire">
          <input
            id="d-dest"
            required
            maxLength={160}
            value={a.form.destinataire}
            onChange={a.set("destinataire")}
            className={`mt-1 w-full ${inputClass}`}
          />
        </Champ>
        <Champ id="d-exp" label="Expéditeur / transporteur">
          <input
            id="d-exp"
            maxLength={160}
            value={a.form.expediteur}
            onChange={a.set("expediteur")}
            className={`mt-1 w-full ${inputClass}`}
          />
        </Champ>
        <Champ id="d-date" label="Date et heure">
          <input
            id="d-date"
            type="datetime-local"
            required
            value={a.form.recuAt}
            onChange={a.set("recuAt")}
            className={`mt-1 w-full ${inputClass}`}
          />
        </Champ>
        <Champ id="d-desc" label="Description" large>
          <textarea
            id="d-desc"
            rows={3}
            maxLength={2000}
            value={a.form.description}
            onChange={a.set("description")}
            className={`mt-1 w-full ${inputClass}`}
          />
        </Champ>
      </PanneauAjout>

      <BarreFiltres
        filtres={filtres}
        onChange={setFiltres}
        placeholder="Destinataire, expéditeur, description…"
      >
        <div>
          <label className={labelClass} htmlFor="f-cat">
            Catégorie
          </label>
          <select
            id="f-cat"
            value={categorie}
            onChange={(e) => setCategorie(e.target.value as CategorieDepot | "")}
            className={`mt-1 ${inputClass}`}
          >
            <option value="">Toutes</option>
            {CATEGORIES_DEPOT.map((c) => (
              <option key={c} value={c}>
                {LIBELLES_CATEGORIE[c]}
              </option>
            ))}
          </select>
        </div>
        <ChoixStatut
          valeur={statut}
          onChange={(v) => setStatut(v as typeof statut)}
          options={["recu", "remis"]}
        />
      </BarreFiltres>

      <Tableau
        entetes={[
          "Date et heure",
          "Site",
          "Catégorie",
          "Destinataire",
          "Expéditeur / transporteur",
          "Description",
          "Statut",
        ]}
        isLoading={isLoading}
        isError={isError}
        vide="Aucune entrée pour ces critères."
        lignes={lignes.map((d) => ({
          id: d.id,
          cellules: [
            formatFr(d.recu_at),
            d.sites?.nom ?? "—",
            LIBELLES_CATEGORIE[d.categorie],
            d.destinataire,
            d.expediteur,
            d.description,
            <Statut
              key="statut"
              libelle={LIBELLES_STATUT[d.statut]}
              final={d.statut === "remis"}
              depuis={d.statut_at}
              action={
                peutAjouter(profil) && d.statut === "recu"
                  ? {
                      libelle: "Marquer remis",
                      confirmation: `Confirmer la remise à ${d.destinataire} ? Cette action est définitive.`,
                      executer: () => remettre({ data: { id: d.id } }),
                      cles: [["depots"]],
                    }
                  : undefined
              }
            />,
          ],
        }))}
      />
    </>
  );
}

function Tableau({
  entetes,
  lignes,
  isLoading,
  isError,
  vide,
}: {
  entetes: string[];
  lignes: { id: string; cellules: ReactNode[] }[];
  isLoading: boolean;
  isError: boolean;
  vide: string;
}) {
  const message = isLoading
    ? "Chargement…"
    : isError
      ? "Le registre n'a pas pu être chargé."
      : lignes.length === 0
        ? vide
        : null;
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {entetes.map((h) => (
              <th key={h} className="px-4 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {message ? (
            <tr>
              <td
                colSpan={entetes.length}
                className={`px-4 py-8 text-center ${isError ? "text-destructive" : "text-muted-foreground"}`}
              >
                {message}
              </td>
            </tr>
          ) : (
            lignes.map((l) => (
              <tr key={l.id} className="border-b border-border align-top last:border-0">
                {l.cellules.map((c, i) => (
                  <td
                    key={i}
                    className={
                      i === 0
                        ? "whitespace-nowrap px-4 py-3 text-foreground"
                        : "whitespace-pre-line px-4 py-3 text-muted-foreground"
                    }
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
