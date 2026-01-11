import { toast } from "@/hooks/use-toast";

export function normalizePhoneToWa(phoneRaw: string): string | null {
  // Keep digits only
  let digits = phoneRaw.replace(/[^\d+]/g, "");
  // Convert leading + to nothing for wa.me
  digits = digits.replace(/^\+/, "");
  // Convert leading 00 to nothing
  digits = digits.replace(/^00/, "");
  // Must be at least country+number
  if (digits.length < 8) return null;
  return digits;
}

export function buildContactMessage(params: { pseudo: string }) {
  return `Bonjour ${params.pseudo}, je viens de voir votre annonce sur NIXYAH. Est-ce que vous êtes disponible ?`;
}

export function openWhatsApp(params: { phone: string; message: string }) {
  const wa = normalizePhoneToWa(params.phone);
  if (!wa) {
    toast({ title: "Numéro invalide", description: "Veuillez saisir un numéro avec indicatif pays." });
    return;
  }
  const url = `https://wa.me/${wa}?text=${encodeURIComponent(params.message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function openTelegram(params: { usernameOrLink: string; message: string }) {
  const raw = params.usernameOrLink.trim();
  const username = raw.replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "");
  if (!username) {
    toast({ title: "Telegram invalide", description: "Veuillez saisir un @username Telegram." });
    return;
  }

  try {
    await navigator.clipboard.writeText(params.message);
    toast({ title: "Message copié", description: "Collez-le dans Telegram." });
  } catch {
    // ignore
  }

  const url = `https://t.me/${encodeURIComponent(username)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}



