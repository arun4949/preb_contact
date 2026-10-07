/**
 * Work-email policy. Sign-up (magic link and Google) requires a company
 * address: free-mail providers are rejected to stop throwaway accounts from
 * farming trial credits — the same rule every enrichment vendor applies.
 *
 * Exceptions: addresses in `ADMIN_EMAILS`, and addresses with a workspace
 * invite (invited members get no trial, so there is nothing to farm).
 *
 * Keep this list in sync with `public.is_free_email_domain` (migration 0004),
 * which enforces "no trial" at the database as defense in depth.
 */
export const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "yahoo.de", "yahoo.fr", "yahoo.co.in", "ymail.com", "rocketmail.com",
  "hotmail.com", "hotmail.co.uk", "hotmail.de", "hotmail.fr", "outlook.com", "outlook.de", "live.com", "live.de", "live.co.uk", "msn.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "protonmail.ch", "pm.me",
  "gmx.com", "gmx.de", "gmx.net", "gmx.at", "gmx.ch", "web.de", "t-online.de", "freenet.de", "posteo.de", "mail.de",
  "mail.com", "email.com", "usa.com", "zoho.com", "zohomail.com", "yandex.com", "yandex.ru", "mail.ru", "bk.ru", "inbox.ru", "list.ru",
  "fastmail.com", "fastmail.fm", "hey.com", "tutanota.com", "tutamail.com", "tuta.io", "hushmail.com", "mailfence.com",
  "qq.com", "163.com", "126.com", "sina.com", "naver.com", "daum.net", "hanmail.net", "rediffmail.com",
  "orange.fr", "wanadoo.fr", "free.fr", "laposte.net", "sfr.fr", "libero.it", "virgilio.it", "tiscali.it", "bluewin.ch",
  "comcast.net", "verizon.net", "att.net", "sbcglobal.net", "bellsouth.net", "cox.net", "btinternet.com", "sky.com", "talktalk.net",
  // Disposable providers
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "temp-mail.org", "tempmail.com", "throwawaymail.com", "yopmail.com",
  "trashmail.com", "getnada.com", "dispostable.com", "maildrop.cc", "sharklasers.com", "mohmal.com", "fakeinbox.com",
]);

export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

export function isFreeEmailDomain(email: string): boolean {
  const domain = emailDomain(email);
  if (!domain) return true;
  if (FREE_EMAIL_DOMAINS.has(domain)) return true;
  // Sub-domains of free providers (e.g. mail.yahoo.com) and obvious throwaways.
  const parts = domain.split(".");
  for (let i = 1; i < parts.length - 1; i += 1) if (FREE_EMAIL_DOMAINS.has(parts.slice(i).join("."))) return true;
  return /(^|\.)(tempmail|temp-mail|trashmail|mailinator|guerrillamail|yopmail)\./.test(domain);
}

/** Addresses allowed to bypass the work-email rule (ops / founders). */
export function isAdminEmail(email: string): boolean {
  const list = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

export const WORK_EMAIL_MESSAGE = "Please use your work email address. Personal and disposable mailboxes can't start a Preb workspace.";
