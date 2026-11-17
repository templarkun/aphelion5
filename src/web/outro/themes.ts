/**
 * The colours of each Company in the outros. PLACEHOLDERS (like content.ts of the briefing): the
 * data files give a Company no colours, so the designer can change any line here freely. A Company
 * with no entry gets FALLBACK_THEME.
 */

import type { CompanyTheme } from "./types.js";

type Colours = Omit<CompanyTheme, "id">;

export const COMPANY_THEMES: Record<string, Colours> = {
  // Support Vessel Of Ko and Van: ion cyan with the amber of the intro ship's livery.
  V1: { primary: "110 231 255", secondary: "255 196 110", glow: "70 170 255", hull: "96 108 126", livery: "214 112 34" },
  // Kew'n X2: violet with mint.
  V2: { primary: "196 160 255", secondary: "120 255 204", glow: "140 96 255", hull: "104 100 128", livery: "126 84 220" },
};

export const FALLBACK_THEME: Colours = { primary: "255 214 130", secondary: "190 240 255", glow: "255 170 80", hull: "110 110 116", livery: "200 150 60" };

export function companyTheme(companyId: string): CompanyTheme {
  return { id: companyId, ...(COMPANY_THEMES[companyId] ?? FALLBACK_THEME) };
}
