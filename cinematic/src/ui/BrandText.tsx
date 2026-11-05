/* Text with "Guest-ly" kept on one line: browsers may break a line after a
   hyphen, and "Guest-" / "ly" on two lines reads as a different word. */
export function BrandText({ text }: { text: string }) {
  const parts = text.split('Guest-ly');
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 ? <span style={{ whiteSpace: 'nowrap' }}>Guest-ly</span> : null}
          {p}
        </span>
      ))}
    </>
  );
}
