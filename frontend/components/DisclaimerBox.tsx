export function DisclaimerBox({ lines }: { lines: string[] }) {
  return (
    <section className="card" style={{ borderColor: "#d7c9aa", background: "#fff9ef" }}>
      <h3 style={{ marginTop: 0 }}>注意事項</h3>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {lines.map((line, i) => (
          <li key={i} style={{ marginBottom: 4 }}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
