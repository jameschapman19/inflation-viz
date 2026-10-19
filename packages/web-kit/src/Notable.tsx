/** "What's notable": one to three short, data-derived statements, shown only when a strict rule fires. Renders nothing when there are none. */
export function Notable({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <aside className="notable" aria-label="What's notable">
      <span className="notable-label">Notable</span>
      <ul>
        {items.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    </aside>
  );
}
