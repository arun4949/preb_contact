/**
 * Per-list result breakdown, the shape returned by the SQL function
 * `list_result_insights` (migration 0025). Client-safe: the summary cards
 * and the filter chips read it, `queries.ts` fetches it.
 */
export interface EmailBreakdown {
  valid: number;
  probable: number;
  catch_all: number;
  not_found: number;
  /** Contacts with more than one billable candidate address. */
  multi: number;
}

export interface PhoneBreakdown {
  found: number;
  not_found: number;
  mobile: number;
  landline: number;
  voip: number;
  unknown_type: number;
  connect: { highest: number; high: number; medium: number; unrated: number };
  ownership: { confirmed: number; mismatch: number; unknown: number };
  /** Contacts with more than one usable candidate number. */
  multi: number;
}

export interface ListInsights {
  processed: number;
  work_email: EmailBreakdown;
  personal_email: EmailBreakdown;
  phone: PhoneBreakdown;
  identified: number;
}

const emptyEmail = (): EmailBreakdown => ({ valid: 0, probable: 0, catch_all: 0, not_found: 0, multi: 0 });

export const EMPTY_INSIGHTS: ListInsights = {
  processed: 0,
  work_email: emptyEmail(),
  personal_email: emptyEmail(),
  phone: {
    found: 0,
    not_found: 0,
    mobile: 0,
    landline: 0,
    voip: 0,
    unknown_type: 0,
    connect: { highest: 0, high: 0, medium: 0, unrated: 0 },
    ownership: { confirmed: 0, mismatch: 0, unknown: 0 },
    multi: 0,
  },
  identified: 0,
};

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : 0);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function shapeEmail(v: unknown): EmailBreakdown {
  const o = obj(v);
  return { valid: num(o.valid), probable: num(o.probable), catch_all: num(o.catch_all), not_found: num(o.not_found), multi: num(o.multi) };
}

/** Defensive parse of the jsonb: every missing or non-numeric key becomes 0. */
export function shapeInsights(json: unknown): ListInsights {
  const o = obj(json);
  const phone = obj(o.phone);
  const connect = obj(phone.connect);
  const ownership = obj(phone.ownership);
  return {
    processed: num(o.processed),
    work_email: shapeEmail(o.work_email),
    personal_email: shapeEmail(o.personal_email),
    phone: {
      found: num(phone.found),
      not_found: num(phone.not_found),
      mobile: num(phone.mobile),
      landline: num(phone.landline),
      voip: num(phone.voip),
      unknown_type: num(phone.unknown_type),
      connect: { highest: num(connect.highest), high: num(connect.high), medium: num(connect.medium), unrated: num(connect.unrated) },
      ownership: { confirmed: num(ownership.confirmed), mismatch: num(ownership.mismatch), unknown: num(ownership.unknown) },
      multi: num(phone.multi),
    },
    identified: num(o.identified),
  };
}

/** Addresses we show for a field: every level that is charged. */
export const emailFound = (b: EmailBreakdown): number => b.valid + b.probable + b.catch_all;
