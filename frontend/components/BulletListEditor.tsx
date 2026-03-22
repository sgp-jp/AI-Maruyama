"use client";

type Props = {
  items: string[];
  editable?: boolean;
  onChange?: (items: string[]) => void;
};

export function BulletListEditor({ items, editable = false, onChange }: Props) {
  if (!editable) {
    return (
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {items.map((item, i) => (
          <li key={i} style={{ marginBottom: 6 }}>{item}</li>
        ))}
      </ul>
    );
  }

  return (
    <div className="grid">
      {items.map((item, i) => (
        <input
          key={i}
          value={item}
          onChange={(e) => {
            if (!onChange) return;
            const next = [...items];
            next[i] = e.target.value;
            onChange(next);
          }}
        />
      ))}
    </div>
  );
}
