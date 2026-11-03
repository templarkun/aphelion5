/**
 * Reader for data/Expansion1.txt (the Heat module). The file is rulebook
 * prose, not records: it is split into its numbered rules H1..H8 so the
 * engine and the log can cite them. The rules themselves are code (stage 7).
 */

export interface ExpansionRule {
  /** "H1" .. "H8". */
  id: string;
  title: string;
  /** Lines under the heading, verbatim. */
  text: string;
}

export interface ExpansionDef {
  name: string;
  intro: string;
  /** Heat tokens in the box ("Heat tokens (10 copies)"). */
  heatTokens: number;
  rules: ExpansionRule[];
  byId: ReadonlyMap<string, ExpansionRule>;
}

export function parseExpansion(text: string, fileName = "Expansion1.txt"): ExpansionDef {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const name = (lines[0] ?? "").trim();
  if (!name) throw new Error(`${fileName}: no title on the first line`);
  const intro: string[] = [];
  const rules: ExpansionRule[] = [];
  let current: { id: string; title: string; text: string[] } | undefined;
  let heatTokens: number | undefined;

  for (const raw of lines.slice(1)) {
    const line = raw.replace(/\s+$/, "");
    const h = /^(H\d+)\. (.+)$/.exec(line);
    if (h) {
      if (current) rules.push({ id: current.id, title: current.title, text: current.text.join("\n").trim() });
      current = { id: h[1]!, title: h[2]!, text: [] };
      continue;
    }
    const tokens = /^Heat tokens \((\d+) copies\)\.$/.exec(line);
    if (tokens) heatTokens = Number(tokens[1]);
    if (current) current.text.push(line);
    else intro.push(line);
  }
  if (current) rules.push({ id: current.id, title: current.title, text: current.text.join("\n").trim() });
  if (heatTokens === undefined) throw new Error(`${fileName}: Heat token count ("Heat tokens (N copies).") not found`);

  const byId = new Map<string, ExpansionRule>();
  rules.forEach((r, i) => {
    if (r.id !== `H${i + 1}`) throw new Error(`${fileName}: rules out of order at ${r.id}`);
    byId.set(r.id, r);
  });
  return { name, intro: intro.join("\n").trim(), heatTokens, rules, byId };
}
