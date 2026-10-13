import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supprimerEntrees, type Registre } from "@/lib/registres.functions";

/**
 * Suppression sélective des entrées d'un registre, réservée à la super admin.
 * Pour un compte de site, `actif` est faux : aucune case, aucune corbeille,
 * aucun bouton n'est rendu (et le serveur refuse de toute façon).
 */
export type Suppression = {
  actif: boolean;
  coches: Set<string>;
  basculer: (id: string) => void;
  basculerTout: () => void;
  tout: boolean;
  partiel: boolean;
  demander: (ids: string[]) => void;
  /** Barre « Supprimer (X) » et boîte de confirmation, à placer au-dessus du tableau. */
  rendu: ReactNode;
};

export function useSuppression({
  registre,
  idsVisibles,
  cles,
  actif,
  libelle,
}: {
  registre: Registre;
  idsVisibles: string[];
  cles: string[][];
  actif: boolean;
  libelle: (n: number) => string;
}): Suppression {
  const queryClient = useQueryClient();
  const supprimer = useServerFn(supprimerEntrees);
  const [cochesBrutes, setCoches] = useState<Set<string>>(new Set());
  const [aSupprimer, setASupprimer] = useState<string[] | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Seules les lignes affichées (filtres en cours) peuvent rester cochées.
  const visibles = useMemo(() => new Set(idsVisibles), [idsVisibles]);
  const coches = useMemo(
    () => new Set([...cochesBrutes].filter((id) => visibles.has(id))),
    [cochesBrutes, visibles],
  );
  const tout = idsVisibles.length > 0 && coches.size === idsVisibles.length;
  const partiel = coches.size > 0 && !tout;

  function basculer(id: string) {
    setCoches((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function confirmer() {
    if (!aSupprimer) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await supprimer({ data: { registre, ids: aSupprimer } });
      setCoches((c) => new Set([...c].filter((id) => !aSupprimer.includes(id))));
      setMessage(`${libelle(r.supprimees)} supprimée${r.supprimees > 1 ? "s" : ""}.`);
      for (const cle of cles) await queryClient.invalidateQueries({ queryKey: cle });
      setASupprimer(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "La suppression a échoué.");
    } finally {
      setEnvoi(false);
    }
  }

  const n = aSupprimer?.length ?? 0;
  const rendu = actif ? (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={coches.size === 0}
          onClick={() => {
            setMessage(null);
            setErreur(null);
            setASupprimer([...coches]);
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Supprimer ({coches.size})
        </button>
        {message && (
          <span role="status" className="text-sm text-muted-foreground">
            {message}
          </span>
        )}
      </div>
      <AlertDialog
        open={aSupprimer !== null}
        onOpenChange={(o) => {
          if (!o && !envoi) setASupprimer(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer {n > 1 ? `ces ${n} entrées` : "cette entrée"} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {libelle(n)} {n > 1 ? "seront supprimées" : "sera supprimée"} définitivement du
              registre. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {erreur && (
            <p role="alert" className="text-sm text-destructive">
              {erreur}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={envoi}>Annuler</AlertDialogCancel>
            <button
              type="button"
              disabled={envoi}
              onClick={confirmer}
              className="inline-flex h-9 items-center justify-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
            >
              {envoi ? "Suppression…" : "Supprimer définitivement"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  ) : null;

  return {
    actif,
    coches,
    basculer,
    basculerTout: () => setCoches(tout ? new Set() : new Set(idsVisibles)),
    tout,
    partiel,
    demander: (ids) => {
      setMessage(null);
      setErreur(null);
      setASupprimer(ids);
    },
    rendu,
  };
}

/** Case « Tout sélectionner » de l'en-tête. */
export function CaseTout({ s }: { s: Suppression }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = s.partiel;
  }, [s.partiel]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label="Tout sélectionner"
      checked={s.tout}
      onChange={s.basculerTout}
      className="h-4 w-4 cursor-pointer accent-primary"
    />
  );
}

/** Case d'une ligne. */
export function CaseLigne({ s, id }: { s: Suppression; id: string }) {
  return (
    <input
      type="checkbox"
      aria-label="Sélectionner cette ligne"
      checked={s.coches.has(id)}
      onChange={() => s.basculer(id)}
      className="h-4 w-4 cursor-pointer accent-primary"
    />
  );
}

/** Corbeille d'une ligne. */
export function CorbeilleLigne({ s, id }: { s: Suppression; id: string }) {
  return (
    <button
      type="button"
      aria-label="Supprimer cette ligne"
      title="Supprimer"
      onClick={() => s.demander([id])}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
