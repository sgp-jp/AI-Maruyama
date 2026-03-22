export function PriorityList({ items }: { items: string[] }) {
  return (
    <ol style={{ margin: 0, paddingLeft: 20 }}>
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: 6 }}>
          {item}
        </li>
      ))}
    </ol>
  );
}
