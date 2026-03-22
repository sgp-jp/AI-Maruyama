import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <main>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h1 style={{ margin: 0 }}>外構MVP</h1>
            <div style={{ display: "flex", gap: 12 }}>
              <Link href="/projects">案件一覧</Link>
              <Link href="/admin">管理</Link>
            </div>
          </div>
          {children}
        </main>
      </body>
    </html>
  );
}
