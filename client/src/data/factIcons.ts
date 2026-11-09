import type { ClueType } from "@shared/types";

/** A bird fact kind. Matches the Mystery Bird clue types, lowercased. */
export type FactKind = Lowercase<ClueType>;

/** Single source of truth for the fact / clue tile icons (bird cards, Mystery Bird clues). */
export const FACT_ICONS: Record<FactKind, string> = {
  looks: "◉",
  spot: "⌂",
  eats: "●",
  nests: "⌣",
  behavior: "➤",
};

export const clueFactKind = (type: ClueType): FactKind => type.toLowerCase() as FactKind;
