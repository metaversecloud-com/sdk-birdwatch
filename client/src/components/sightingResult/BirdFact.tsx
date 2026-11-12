import { FACT_ICONS } from "@/data/factIcons";
import type { FactKind } from "@/data/factIcons";

/** One colored-tile fact (icon + label + value), used in the four-icon row on a bird card. */
export const BirdFact = ({
  kind,
  label,
  value,
  size,
}: {
  kind: FactKind;
  label: string;
  value?: string;
  size?: "sm" | "md" | "lg";
}) => (
  <div className="bw-fact">
    <div className={`bw-fact__icon bw-fact-color--${kind} ${size ? `bw-fact__icon--${size}` : ""}`} aria-hidden="true">
      <img src={FACT_ICONS[kind]} alt="" />
    </div>
    <p className="bw-fact__label">{label}</p>
    {value && <p className="bw-fact__value">{value}</p>}
  </div>
);

export default BirdFact;
