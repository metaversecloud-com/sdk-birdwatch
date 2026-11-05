export const Spinner = ({ label = "Loading..." }: { label?: string }) => (
  <div className="flex flex-col items-center gap-2">
    <svg className="bw-spin" width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="var(--bw-primary-soft)" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="var(--bw-primary)" strokeWidth="4" strokeLinecap="round" />
    </svg>
    <span className="bw-subtitle">{label}</span>
  </div>
);
export default Spinner;
