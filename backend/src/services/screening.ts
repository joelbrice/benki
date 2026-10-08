import type { ScreeningStatus } from "@benki/shared";
import { nameSimilarity } from "../lib/names";

interface WatchlistEntry {
  listName: string;
  name: string;
  dateOfBirth: string | null;
  pep: boolean;
}

/**
 * Sandbox watchlist standing in for the consolidated sanctions lists (UN,
 * OFAC, EU, local FIU designations) and a PEP register. All names are
 * fictional. A real deployment syncs these from a screening vendor and
 * re-screens the whole customer base whenever a list changes.
 */
const WATCHLIST: WatchlistEntry[] = [
  { listName: "Sanctions — consolidated (sandbox)", name: "Viktor Blackwood", dateOfBirth: "1968-03-14", pep: false },
  { listName: "Sanctions — consolidated (sandbox)", name: "Ravenna Holloway", dateOfBirth: "1975-11-02", pep: false },
  { listName: "Sanctions — consolidated (sandbox)", name: "Dorian Ashgrave", dateOfBirth: null, pep: false },
  { listName: "PEP register (sandbox)", name: "Octavia Sterling-Vance", dateOfBirth: "1961-07-21", pep: true },
];

const POTENTIAL_MATCH_THRESHOLD = 0.9;
const STRONG_MATCH_THRESHOLD = 0.97;

export interface ScreeningResult {
  status: Exclude<ScreeningStatus, "NOT_SCREENED">;
  matches: { listName: string; matchedName: string; similarity: number }[];
}

export function screenName(fullName: string, dateOfBirth: string): ScreeningResult {
  const matches = WATCHLIST.map((entry) => ({ entry, similarity: nameSimilarity(fullName, entry.name) }))
    .filter((m) => m.similarity >= POTENTIAL_MATCH_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity);

  // Only an exact-strength sanctions match corroborated by date of birth is
  // auto-confirmed; everything else is a potential match for a human to
  // decide. PEP status alone never blocks — it triggers enhanced due diligence.
  const confirmed = matches.some(
    (m) => !m.entry.pep && m.similarity >= STRONG_MATCH_THRESHOLD && m.entry.dateOfBirth === dateOfBirth,
  );
  return {
    status: confirmed ? "CONFIRMED_MATCH" : matches.length ? "POTENTIAL_MATCH" : "CLEAR",
    matches: matches.map((m) => ({
      listName: m.entry.listName,
      matchedName: m.entry.name,
      similarity: Math.round(m.similarity * 1000) / 1000,
    })),
  };
}
