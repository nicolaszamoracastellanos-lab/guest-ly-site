/* Slot for real testimonials from real weddings. Renders nothing while the
   list is empty; the first honest founding-couple quotes drop straight into
   copy.ts (founding.proof) with no layout work. */
export function FoundingProof({ items }: { items: { quote: string; names: string; place: string }[] }) {
  if (items.length === 0) return null;

  return (
    <div className="proof-grid">
      {items.map((item) => (
        <figure key={item.names} className="glass glass-card proof">
          <blockquote className="proof__quote">{item.quote}</blockquote>
          <figcaption className="proof__who">
            <span className="proof__names">{item.names}</span>
            <span className="proof__place">{item.place}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
