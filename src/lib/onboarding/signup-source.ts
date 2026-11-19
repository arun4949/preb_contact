/**
 * The optional second onboarding step: "How did you first hear about Preb?".
 * Pure and shared by the form, the server actions and the admin pages.
 *
 * The option list lives here and nowhere else (the database only checks the
 * shape of a key), so options can be added or reworded without a migration.
 * Removing a key keeps old answers readable: admin labels fall back to the
 * stored key.
 *
 * Order: shuffled per person so no channel profits from being first, with
 * "Other" and "Not sure" always last. The shuffle is seeded by the user id,
 * so a reload shows the same order and the server can recompute what the
 * person saw instead of trusting the browser.
 */

export interface SignupSourceOption {
  key: string;
  /** What the person reads on the chip. */
  label: string;
  /** Shorter name for admin tables and charts, where the examples in the label are noise. */
  short?: string;
  /** Label of the optional follow-up line; null when there is nothing to add. */
  detailLabel: string | null;
  detailPlaceholder?: string;
}

/** Shuffled for each person. */
const CHANNELS: SignupSourceOption[] = [
  { key: "search", label: "Google or another search engine", short: "Search engine", detailLabel: "What did you search for?", detailPlaceholder: "For example, recruiter contact data" },
  { key: "ai_assistant", label: "AI assistant (ChatGPT, Claude, Perplexity)", short: "AI assistant", detailLabel: "Which assistant?", detailPlaceholder: "For example, ChatGPT" },
  { key: "linkedin", label: "LinkedIn", detailLabel: "What did you see there?", detailPlaceholder: "A post, an ad or a message" },
  { key: "facebook", label: "Facebook", detailLabel: "What did you see there?", detailPlaceholder: "An ad, a post or a group" },
  { key: "instagram", label: "Instagram", detailLabel: "What did you see there?", detailPlaceholder: "An ad, a post or a story" },
  { key: "tiktok", label: "TikTok", detailLabel: "What did you see there?", detailPlaceholder: "An ad or a video" },
  { key: "youtube", label: "YouTube", detailLabel: "Which channel or video?" },
  { key: "colleague", label: "Colleague or friend", detailLabel: "Who recommended us?", detailPlaceholder: "A name or a company" },
  { key: "podcast_newsletter", label: "Podcast or newsletter", detailLabel: "Which one?" },
  { key: "community", label: "Online community or forum", detailLabel: "Which community?", detailPlaceholder: "A Slack group, Reddit or a forum" },
];

/** Always last, in this order. */
const PINNED: SignupSourceOption[] = [
  { key: "other", label: "Other", detailLabel: "Where did you hear about us?" },
  { key: "not_sure", label: "Not sure", detailLabel: null },
];

export const SIGNUP_SOURCE_OPTIONS: readonly SignupSourceOption[] = [...CHANNELS, ...PINNED];

export const SIGNUP_SOURCE_DETAIL_MAX = 200;

const BY_KEY = new Map(SIGNUP_SOURCE_OPTIONS.map((option) => [option.key, option]));

export function signupSourceOption(key: string | null | undefined): SignupSourceOption | null {
  return key ? (BY_KEY.get(key) ?? null) : null;
}

/** FNV-1a: a stable 32-bit seed from the user id. */
function seedFrom(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: small deterministic generator, good enough to spread ten options. */
function generator(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The option keys in the order this person sees them. Same input, same order. */
export function signupSourceOrder(userId: string): string[] {
  const keys = CHANNELS.map((option) => option.key);
  const random = generator(seedFrom(userId));
  for (let i = keys.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  return [...keys, ...PINNED.map((option) => option.key)];
}

export interface SignupSourceAnswer {
  source: string;
  detail: string | null;
}

/**
 * A submitted answer, or null when the key is not one of ours. The detail is
 * trimmed, collapsed to one line and capped; options without a follow-up
 * never store one.
 */
export function parseSignupSourceAnswer(source: unknown, detail: unknown): SignupSourceAnswer | null {
  const option = typeof source === "string" ? signupSourceOption(source) : null;
  if (!option) return null;
  const text = typeof detail === "string" ? detail.replace(/\s+/g, " ").trim().slice(0, SIGNUP_SOURCE_DETAIL_MAX) : "";
  return { source: option.key, detail: option.detailLabel && text ? text : null };
}

/** 1-based place of a key in the order shown, or null when it was not in it. */
export function shownPosition(order: readonly string[], key: string): number | null {
  const index = order.indexOf(key);
  return index === -1 ? null : index + 1;
}

/** How long after step 1 the question may still be shown. Later it would be a stale, less reliable answer. */
export const SIGNUP_SOURCE_FRESH_MS = 24 * 60 * 60 * 1000;

export function isSignupSourceFresh(askedAt: string, now = Date.now()): boolean {
  const asked = new Date(askedAt).getTime();
  return Number.isFinite(asked) && now - asked <= SIGNUP_SOURCE_FRESH_MS;
}

export const SIGNUP_SOURCE_PATH = "/onboarding/source";
