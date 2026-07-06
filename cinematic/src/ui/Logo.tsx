/* The Guest-ly wordmark, replicated 1:1 from the production site:
   Playfair "Guest" + rotated gold gem (with the periodic diamondGlow blink)
   + italic "ly". Text-based so spacing always matches the brand. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={className ? `logo ${className}` : 'logo'}>
      <span>Guest</span>
      <span className="logo__gem" aria-hidden="true" />
      <span className="logo__ly">ly</span>
    </span>
  );
}
