/**
 * Words and placeholders of the command briefing that are NOT rules and not in the data files:
 * sector designations, lore snippets, difficulty ratings, and the empty places kept for Campaigns,
 * Companies and expansion modules still to come. The designer can change any line here freely.
 */

export interface CampaignLore {
  /** Shown in place of "Campaign 1". */
  title: string;
  sector: string;
  lore: string;
  /** 1-5, shown as pips. A placeholder until the designer rates each Campaign. */
  difficulty: number;
}

/** By Campaign prefix. A Campaign in the data with no entry here uses FALLBACK_LORE. */
export const CAMPAIGN_LORE: Record<string, CampaignLore> = {
  C1: {
    title: "Campaign 1",
    sector: "SECTOR A5-01",
    lore: "The Field went dark without a word. Under every tile something waits: Bots, Sentinels, the slow fire of Flares. Take your Company in, break the Alpha line, and bring the Flagship home.",
    difficulty: 2,
  },
};
export const FALLBACK_LORE: CampaignLore = { title: "", sector: "SECTOR UNCHARTED", lore: "No briefing on file.", difficulty: 3 };

/** How many Campaign places the selection shows (8 planned); the rest are locked placeholders. */
export const CAMPAIGN_SLOTS = 8;
/** How many Company places (4-5 planned). */
export const COMPANY_SLOTS = 5;
/** How many expansion sockets (up to 6 planned). */
export const EXPANSION_SLOTS = 6;

/** Short text for each expansion module (the rules are in the Expansion file). */
export const EXPANSION_INFO: Record<string, { code: string; name: string; text: string }> = {
  heat: {
    code: "HX-01",
    name: "Heat",
    text: "Start every mission with 10 Heat tokens. Pay 1 for a Heat Wave: 1 damage to one Bot. Overclock a Module to gain Heat back.",
  },
};

/** Boot log of the long intro. "!" in front = a line that glitches. */
export const BOOT_LOG = [
  "CORP-SEC PROTOCOL v4.2",
  "COLD START ............................ OK",
  "MEMORY LATTICE 0x7F3A ................. OK",
  "UPLINK // RELAY 5 ..................... HANDSHAKE",
  "CRYPTO KEY EXCHANGE ................... VERIFIED",
  "!FIELD TELEMETRY ...................... SIGNAL DEGRADED",
  "REROUTING VIA APHELION ARRAY .......... OK",
  "FLAGSHIP REGISTRY ..................... LOADED",
  "OPERATOR CLEARANCE .................... GRANTED",
];
