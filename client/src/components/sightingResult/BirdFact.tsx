import { FACT_ICONS } from "@/data/factIcons";
import type { FactKind } from "@/data/factIcons";

/** One colored-tile fact (icon + label + value), used in the four-icon row on a bird card. */
export const BirdFact = ({ kind, label, value }: { kind: FactKind; label: string; value: string }) => (
  <div className="bw-fact">
    <div className={`bw-fact__icon bw-fact-color--${kind}`} aria-hidden="true">
      {FACT_ICONS[kind]}
    </div>
    <p className="bw-fact__label">{label}</p>
    <p className="bw-fact__value">{value}</p>
  </div>
);

export default BirdFact;
