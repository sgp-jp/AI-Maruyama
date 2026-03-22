import type { ReactNode } from "react";

export function SectionCard({ title, children, description }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="card">
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>{title}</h3>
      {description ? <p style={{ marginTop: 0, color: "#4b5563" }}>{description}</p> : null}
      {children}
    </section>
  );
}
