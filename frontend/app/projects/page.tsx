"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Project = {
  id: string;
  name: string;
  customerName: string;
  status: string;
  updatedAt: string;
  assignee: string;
};

const API = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState({ name: "", customerName: "", assignee: "" });

  const load = async () => {
    const res = await fetch(`${API}/projects`);
    setProjects(await res.json());
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    await fetch(`${API}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    setForm({ name: "", customerName: "", assignee: "" });
    await load();
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <section className="card grid two">
        <input placeholder="案件名" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="顧客名" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
        <input placeholder="担当者" value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} />
        <button onClick={create}>案件作成</button>
      </section>

      <section className="card">
        <h2>案件一覧</h2>
        <div className="grid">
          {projects.map((p) => (
            <div key={p.id} className="card" style={{ padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{p.name}</strong>
                <span className="badge">{p.status}</span>
              </div>
              <div>{p.customerName} / {p.assignee}</div>
              <div>{new Date(p.updatedAt).toLocaleString()}</div>
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <Link href={`/projects/${p.id}?tab=hearing`}>ヒアリング</Link>
                <Link href={`/projects/${p.id}?tab=diagnosis`}>診断</Link>
                <Link href={`/projects/${p.id}?tab=proposal`}>提案</Link>
                <Link href={`/projects/${p.id}?tab=handover`}>引継ぎ</Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
