import { nawbCollection } from "@/data/nawb";

/** Subtitle under a correct-result bird card — shows Field Guide progress for new species, status for repeats. */
export const CountDescription = ({
  outcome,
  speciesCount,
}: {
  outcome: "new_species" | "repeat";
  speciesCount?: number;
}) => {
  if (outcome !== "new_species") {
    return <p className="text-sm">Already in your Field Guide</p>;
  }
  const total = nawbCollection.species.length;
  return (
    <p className="text-sm">
      Added to your Field Guide · {speciesCount ?? "?"} of {total}
    </p>
  );
};

export default CountDescription;
