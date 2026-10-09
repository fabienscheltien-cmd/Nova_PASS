// Utilitaires réservés au serveur : limitation de débit et envoi d'e-mails.
import { getRequest } from "@tanstack/react-start/server";

const FENETRE_MS = 10 * 60 * 1000;
const MAX_PAR_FENETRE = 10;
const compteurs = new Map<string, { debut: number; nombre: number }>();

function ipClient() {
  const h = getRequest()?.headers;
  if (!h) return "inconnue";
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "inconnue"
  );
}

/**
 * Limite le nombre d'enregistrements par adresse IP (10 / 10 min).
 * Mémoire locale : efficace sur un serveur Node unique (VPS OVH).
 */
export function verifierLimiteDebit() {
  const maintenant = Date.now();
  const ip = ipClient();
  const c = compteurs.get(ip);
  if (!c || maintenant - c.debut > FENETRE_MS) {
    compteurs.set(ip, { debut: maintenant, nombre: 1 });
  } else if (++c.nombre > MAX_PAR_FENETRE) {
    throw new Error("Trop d'enregistrements depuis cet appareil. Merci de prévenir l'accueil.");
  }
  if (compteurs.size > 10_000) {
    for (const [cle, val] of compteurs) {
      if (maintenant - val.debut > FENETRE_MS) compteurs.delete(cle);
    }
  }
}

type Message = { to: string; subject: string; html: string; text: string };

/**
 * Envoie un e-mail via SMTP (ex. OVH : ssl0.ovh.net:465) si SMTP_HOST est défini,
 * sinon via le service e-mail Lovable. Renvoie false si aucun canal n'est configuré.
 */
export async function envoyerEmail(message: Message): Promise<boolean> {
  const env = process.env;
  if (env["SMTP_HOST"]) {
    const nodemailer = await import("nodemailer");
    const port = Number(env["SMTP_PORT"] ?? 465);
    const transport = nodemailer.createTransport({
      host: env["SMTP_HOST"],
      port,
      secure: env["SMTP_SECURE"] ? env["SMTP_SECURE"] === "true" : port === 465,
      auth: env["SMTP_USER"]
        ? { user: env["SMTP_USER"], pass: env["SMTP_PASSWORD"] ?? "" }
        : undefined,
    });
    await transport.sendMail({ from: env["SMTP_FROM"] ?? env["SMTP_USER"], ...message });
    return true;
  }

  const apiKey = env["LOVABLE_API_KEY"];
  const senderDomain = env["LOVABLE_EMAIL_DOMAIN"];
  if (apiKey && senderDomain) {
    const { sendLovableEmail } = await import("@lovable.dev/email-js");
    await sendLovableEmail({ from: `accueil@${senderDomain}`, ...message }, { apiKey });
    return true;
  }
  return false;
}
