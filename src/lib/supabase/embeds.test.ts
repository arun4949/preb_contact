import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard against silently broken joins (2026-10-21: a new foreign key made
 * `profiles → workspaces(...)` ambiguous, PostgREST answered PGRST201 and the
 * Ops page showed "No signups"). Every embed in a `.from("x").select("…")`
 * query must resolve to exactly one relationship in the generated types, or
 * name its foreign key with `!fk_name`. Runs on every `npm test`, so adding a
 * foreign key and regenerating `types.ts` flags each query it breaks.
 */

const ROOT = join(__dirname, "..", "..");
const TYPES = readFileSync(join(__dirname, "types.ts"), "utf8");

interface Fk {
  name: string;
  from: string;
  to: string;
}

/** Foreign keys per table, read from the `Relationships` arrays of `types.ts`. */
function foreignKeys(): Fk[] {
  const tablesStart = TYPES.indexOf("    Tables: {");
  const tablesEnd = TYPES.indexOf("    Views: {", tablesStart);
  const block = TYPES.slice(tablesStart, tablesEnd);
  const fks: Fk[] = [];
  const tableRe = /\n {6}([a-z_]+): \{\n {8}Row: \{/g;
  const starts = [...block.matchAll(tableRe)].map((m) => ({ name: m[1], at: m.index! }));
  starts.forEach((t, i) => {
    const body = block.slice(t.at, starts[i + 1]?.at ?? block.length);
    for (const m of body.matchAll(/foreignKeyName: "([^"]+)"[\s\S]*?referencedRelation: "([^"]+)"/g)) {
      fks.push({ name: m[1], from: t.name, to: m[2] });
    }
  });
  return fks;
}

const FKS = foreignKeys();
const TABLES = new Set(FKS.flatMap((f) => [f.from, f.to]));

function relationships(a: string, b: string): Fk[] {
  return FKS.filter((f) => (f.from === a && f.to === b) || (f.from === b && f.to === a));
}

interface Embed {
  parent: string;
  table: string;
  hint: string | null;
}

/** Embeds in a select string, with their parent table (nested embeds included). */
export function parseEmbeds(root: string, select: string): Embed[] {
  const out: Embed[] = [];
  const stack = [root];
  const re = /([a-z_][a-z0-9_]*)(?:!([a-z0-9_]+))?\s*\(|\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(select))) {
    if (m[0] === ")") {
      stack.pop();
      continue;
    }
    const table = m[1];
    const hint = m[2] && !["inner", "left"].includes(m[2]) ? m[2] : null;
    out.push({ parent: stack[stack.length - 1], table, hint });
    stack.push(table);
  }
  return out;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") && name !== "types.ts" ? [path] : [];
  });
}

interface Query {
  file: string;
  table: string;
  select: string;
}

/** `.from("table")` followed (in the same chain) by `.select("…")`. */
function queries(): Query[] {
  const out: Query[] = [];
  for (const file of sourceFiles(ROOT)) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/\.from\("([a-z_]+)"\)/g)) {
      const rest = src.slice(m.index! + m[0].length, m.index! + m[0].length + 600);
      const sel = rest.match(/^[\s\S]*?\.select\(\s*(["`])([\s\S]*?)\1/);
      // Only when the select belongs to this chain (no new statement in between).
      if (!sel || /;\s*\n/.test(rest.slice(0, sel.index! + sel[0].indexOf(".select")))) continue;
      out.push({ file: relative(ROOT, file), table: m[1], select: sel[2] });
    }
  }
  return out;
}

describe("Supabase embeds", () => {
  const all = queries();

  it("finds the app's queries (parser sanity)", () => {
    expect(all.length).toBeGreaterThan(50);
    expect(TABLES.has("profiles") && TABLES.has("workspaces")).toBe(true);
  });

  it("parses nested embeds and hints", () => {
    expect(parseEmbeds("lead_shares", "*, list:lists(name), owner:profiles!lead_shares_owner_id_fkey(id)")).toEqual([
      { parent: "lead_shares", table: "lists", hint: null },
      { parent: "lead_shares", table: "profiles", hint: "lead_shares_owner_id_fkey" },
    ]);
    expect(parseEmbeds("workspace_members", "workspace_id, workspaces!inner(owner_id)")[0].hint).toBeNull();
  });

  it("flags the 2026-10-21 regression (ambiguous profiles → workspaces)", () => {
    const [embed] = parseEmbeds("profiles", "id, workspace:workspaces(name)");
    expect(relationships(embed.parent, embed.table).length).toBeGreaterThan(1);
  });

  it("every embed resolves to exactly one relationship or names its foreign key", () => {
    const problems: string[] = [];
    for (const q of all) {
      for (const e of parseEmbeds(q.table, q.select)) {
        if (!TABLES.has(e.table)) continue; // column function or unknown name, not an embed
        const rels = relationships(e.parent, e.table);
        if (e.hint) {
          if (!rels.some((r) => r.name === e.hint)) problems.push(`${q.file}: ${e.parent} → ${e.table}!${e.hint} names no foreign key between these tables`);
        } else if (rels.length === 0) {
          problems.push(`${q.file}: ${e.parent} → ${e.table} has no relationship`);
        } else if (rels.length > 1) {
          problems.push(`${q.file}: ${e.parent} → ${e.table} is ambiguous (${rels.map((r) => r.name).join(", ")}); write ${e.table}!<fk_name>(…)`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
