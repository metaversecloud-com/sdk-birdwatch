/** Simple label/value row used for Field mark, Call, and Fun fact. */
export const BirdInfoSection = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="bw-caption">{label}</p>
    <p>{value}</p>
  </div>
);

export default BirdInfoSection;
