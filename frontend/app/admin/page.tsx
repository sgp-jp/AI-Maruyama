"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

export default function AdminPage() {
  const [data, setData] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(API + "/admin/templates")
      .then((r) => r.json())
      .then((d) => setData(d as Record<string, string>));
  }, []);

  return (
    <section className="card">
      <h2>管理画面</h2>
      <p>質問項目管理 / テンプレ管理 / 自社ルール / ブランドトーン（MVP最小版）</p>
      <div className="grid">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="card" style={{ padding: 12 }}>
            <div style={{ fontSize: 12, color: "#5b6470", marginBottom: 6 }}>{key}</div>
            <div style={{ fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
