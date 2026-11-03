type FactKind = "spot" | "eats" | "nests" | "behavior";

const ICONS: Record<FactKind, string> = {
  spot: "⌂",
  eats: "●",
  nests: "⌣",
  behavior: "▸",
};

/** One colored-tile fact (icon + label + value), used in the four-icon row on a bird card. */
export const BirdFact = ({ kind, label, value }: { kind: FactKind; label: string; value: string }) => (
  <div className="bw-fact">
    <div className={`bw-fact__icon bw-fact__icon--${kind}`} aria-hidden="true">
      {ICONS[kind]}
    </div>
    <p className="bw-fact__label">{label}</p>
    <p className="bw-fact__value">{value}</p>
  </div>
);

export default BirdFact;
