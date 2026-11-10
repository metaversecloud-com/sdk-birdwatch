import type { ClueType } from "@shared/types";

/** A bird fact kind. Matches the Mystery Bird clue types, lowercased. */
export type FactKind = Lowercase<ClueType>;

/** Single source of truth for the fact / clue tile icons (bird cards, Mystery Bird clues). SVGs live in public/assets. */
export const FACT_ICONS: Record<FactKind, string> = {
  looks: `${import.meta.env.BASE_URL}assets/looks.svg`,
  spot: `${import.meta.env.BASE_URL}assets/spot.svg`,
  eats: `${import.meta.env.BASE_URL}assets/eats.svg`,
  nests: `${import.meta.env.BASE_URL}assets/nests.svg`,
  behavior: `${import.meta.env.BASE_URL}assets/behavior.svg`,
  call: `${import.meta.env.BASE_URL}assets/call.svg`,
};

export const clueFactKind = (type: ClueType): FactKind => type.toLowerCase() as FactKind;
