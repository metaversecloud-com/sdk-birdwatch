export const ResultBanner = ({ kind, message }: { kind: "correct" | "wrong"; message: string }) => (
  <div className={`bw-banner bw-banner--${kind}`} role={kind === "wrong" ? "alert" : "status"} aria-live="polite">
    <span aria-hidden="true">{kind === "correct" ? "✓" : "✕"}</span>
    <span>{message}</span>
  </div>
);
export default ResultBanner;
