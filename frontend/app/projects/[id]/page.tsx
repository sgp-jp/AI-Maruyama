"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BulletListEditor } from "../../../components/BulletListEditor";
import { DisclaimerBox } from "../../../components/DisclaimerBox";
import { SectionCard } from "../../../components/SectionCard";
import { ThreePlanTable } from "../../../components/ThreePlanTable";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

const DEFAULT_DISCLAIMER = [
  "本機能は外構の判断補助です",
  "最終設計・施工判断は専門業者確認前提です",
  "現地条件により内容は変わります",
  "提案内容は概念整理であり、施工保証ではありません"
];

type ProjectDetail = {
  id: string;
  name: string;
  customerName: string;
  status: string;
  assignee: string;
  hearingInput?: { payloadJson: unknown };
  diagnosisResult?: { payloadJson: unknown };
  proposalDraft?: { payloadJson: unknown };
  handoverMemo?: { payloadJson: unknown };
};

type DiagnosisView = {
  summary: string[];
  risks: string[];
  priorities: string[];
  policy: {
    minimum: string[];
    reduceCandidates: string[];
    dontCut: string[];
    talkTrack: string[];
  };
  salesTalk: string[];
  disclaimer: string[];
};

type ProposalView = {
  minimum: string[];
  standard: string[];
  ideal: string[];
  customerSummary: string;
  disclaimer: string[];
};

type HandoverView = {
  topPriorities: string[];
  styleNotes: string[];
  absoluteNg: string[];
  fieldCheckPoints: string[];
  disclaimer: string[];
};

type AuditLog = {
  id: string;
  action: string;
  actor: string;
  detailJson: unknown;
  createdAt: string;
};

const actionLabels: Record<string, string> = {
  "project.created": "案件作成",
  "hearing.saved": "ヒアリング保存",
  "diagnosis.generated": "診断生成",
  "diagnosis.edited": "診断編集保存",
  "proposal.generated": "提案生成",
  "proposal.edited": "提案編集保存",
  "handover.generated": "引継ぎ生成",
  "handover.edited": "引継ぎ編集保存",
  "pdf.generated": "PDF出力"
};

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseDiagnosis(value: unknown): DiagnosisView {
  const obj = asObject(value);
  const policy = asObject(obj.policy);
  const disclaimer = asStringArray(obj.disclaimer);
  return {
    summary: asStringArray(obj.summary),
    risks: asStringArray(obj.risks),
    priorities: asStringArray(obj.priorities),
    policy: {
      minimum: asStringArray(policy.minimum),
      reduceCandidates: asStringArray(policy.reduceCandidates),
      dontCut: asStringArray(policy.dontCut),
      talkTrack: asStringArray(policy.talkTrack)
    },
    salesTalk: asStringArray(obj.salesTalk),
    disclaimer: disclaimer.length > 0 ? disclaimer : DEFAULT_DISCLAIMER
  };
}

function parseProposal(value: unknown): ProposalView {
  const obj = asObject(value);
  const disclaimer = asStringArray(obj.disclaimer);
  return {
    minimum: asStringArray(obj.minimum),
    standard: asStringArray(obj.standard),
    ideal: asStringArray(obj.ideal),
    customerSummary: asString(obj.customerSummary),
    disclaimer: disclaimer.length > 0 ? disclaimer : DEFAULT_DISCLAIMER
  };
}

function parseHandover(value: unknown): HandoverView {
  const obj = asObject(value);
  const disclaimer = asStringArray(obj.disclaimer);
  return {
    topPriorities: asStringArray(obj.topPriorities),
    styleNotes: asStringArray(obj.styleNotes),
    absoluteNg: asStringArray(obj.absoluteNg),
    fieldCheckPoints: asStringArray(obj.fieldCheckPoints),
    disclaimer: disclaimer.length > 0 ? disclaimer : DEFAULT_DISCLAIMER
  };
}

function flattenObject(value: unknown, prefix = ""): Record<string, string> {
  const obj = asObject(value);
  const result: Record<string, string> = {};
  Object.entries(obj).forEach(([key, raw]) => {
    const path = prefix ? prefix + "." + key : key;
    if (Array.isArray(raw)) {
      result[path] = JSON.stringify(raw);
      return;
    }
    if (typeof raw === "object" && raw !== null) {
      const nested = flattenObject(raw, path);
      Object.assign(result, nested);
      return;
    }
    result[path] = String(raw ?? "");
  });
  return result;
}

function computeDiff(current: unknown, prev: unknown): string[] {
  const curr = flattenObject(current);
  const old = flattenObject(prev);
  const keys = new Set<string>([...Object.keys(curr), ...Object.keys(old)]);
  return [...keys].filter((key) => curr[key] !== old[key]).sort();
}

function labelForPath(path: string): string {
  const labels: Record<string, string> = {
    summary: "施主要望サマリー",
    risks: "外構失敗リスク",
    priorities: "優先順位",
    "policy.minimum": "提案方針（最低限）",
    "policy.reduceCandidates": "削減候補",
    "policy.dontCut": "削れない項目",
    "policy.talkTrack": "施主への伝え方",
    salesTalk: "営業トーク補助",
    minimum: "最低限プラン",
    standard: "標準プラン",
    ideal: "理想プラン",
    customerSummary: "施主説明用要約",
    topPriorities: "施主優先事項",
    styleNotes: "統一感の要点",
    absoluteNg: "絶対NG事項",
    fieldCheckPoints: "現調チェック項目",
    disclaimer: "注意事項",
    exportPath: "PDF出力先"
  };
  return labels[path] ?? path;
}

function prettyValue(value: string): string {
  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        const textItems = parsed.filter((item): item is string => typeof item === "string");
        return textItems.length > 0 ? textItems.join(" / ") : "更新";
      }
    } catch {
      return value;
    }
  }
  return value;
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "hearing";
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? "");
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [message, setMessage] = useState("");
  const [hearing, setHearing] = useState({
    site: { buildingType: "戸建", siteCondition: "", roadSide: false, handoverDate: "" },
    preferences: {
      parkingCount: 2,
      needPrivacy: true,
      gardenUse: true,
      kidsOrPets: false,
      weedControlPriority: 4,
      securityPriority: 3,
      designPriority: 3,
      maintenanceTolerance: 2,
      budgetBand: "mid"
    },
    building: { taste: "", wallColor: "", entrancePos: "", windowPoints: "", parkingPos: "" },
    memo: "",
    mustHaves: ["駐車", "目隠し"]
  });

  const title = useMemo(() => {
    if (!project) return "案件";
    return project.name + " / " + project.customerName;
  }, [project]);

  const diagnosis = useMemo(() => parseDiagnosis(project?.diagnosisResult?.payloadJson), [project]);
  const proposal = useMemo(() => parseProposal(project?.proposalDraft?.payloadJson), [project]);
  const handover = useMemo(() => parseHandover(project?.handoverMemo?.payloadJson), [project]);
  const [diagnosisDraft, setDiagnosisDraft] = useState<DiagnosisView>(diagnosis);
  const [proposalDraft, setProposalDraft] = useState<ProposalView>(proposal);
  const [handoverDraft, setHandoverDraft] = useState<HandoverView>(handover);

  useEffect(() => {
    setDiagnosisDraft(diagnosis);
  }, [diagnosis]);

  useEffect(() => {
    setProposalDraft(proposal);
  }, [proposal]);

  useEffect(() => {
    setHandoverDraft(handover);
  }, [handover]);

  const load = async () => {
    const [projectRes, auditRes] = await Promise.all([
      fetch(API + "/projects/" + id),
      fetch(API + "/projects/" + id + "/audits")
    ]);
    const data = (await projectRes.json()) as ProjectDetail;
    const auditData = (await auditRes.json()) as AuditLog[];
    setProject(data);
    setAudits(auditData);
    if (data.hearingInput?.payloadJson) {
      setHearing(data.hearingInput.payloadJson as typeof hearing);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const saveHearing = async () => {
    const res = await fetch(API + "/projects/" + id + "/hearing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(hearing)
    });
    setMessage(res.ok ? "ヒアリング保存完了" : "保存失敗");
    await load();
  };

  const generate = async (kind: "diagnosis" | "proposal" | "handover") => {
    const endpoint =
      kind === "diagnosis"
        ? "/diagnosis/generate"
        : kind === "proposal"
        ? "/proposals/generate"
        : "/handover/generate";
    const res = await fetch(API + "/projects/" + id + endpoint, { method: "POST" });
    setMessage(res.ok ? kind + " 生成完了" : kind + " 生成失敗");
    await load();
  };

  const exportPdf = async () => {
    const res = await fetch(API + "/projects/" + id + "/pdf", { method: "POST" });
    const data = (await res.json()) as { url?: string };
    if (data.url) {
      window.open(data.url, "_blank");
    }
  };

  const saveDiagnosis = async () => {
    const payload = {
      summary: diagnosisDraft.summary,
      risks: diagnosisDraft.risks,
      priorities: diagnosisDraft.priorities,
      policy: diagnosisDraft.policy,
      salesTalk: diagnosisDraft.salesTalk
    };
    const res = await fetch(API + "/projects/" + id + "/diagnosis", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setMessage(res.ok ? "診断結果を保存しました" : "診断結果の保存に失敗しました");
    await load();
  };

  const saveProposal = async () => {
    const payload = {
      minimum: proposalDraft.minimum,
      standard: proposalDraft.standard,
      ideal: proposalDraft.ideal,
      customerSummary: proposalDraft.customerSummary
    };
    const res = await fetch(API + "/projects/" + id + "/proposal", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setMessage(res.ok ? "提案内容を保存しました" : "提案内容の保存に失敗しました");
    await load();
  };

  const saveHandover = async () => {
    const payload = {
      topPriorities: handoverDraft.topPriorities,
      styleNotes: handoverDraft.styleNotes,
      absoluteNg: handoverDraft.absoluteNg,
      fieldCheckPoints: handoverDraft.fieldCheckPoints
    };
    const res = await fetch(API + "/projects/" + id + "/handover", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setMessage(res.ok ? "引継ぎメモを保存しました" : "引継ぎメモの保存に失敗しました");
    await load();
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <span className="badge">{project?.status ?? "-"}</span>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          <Link href={"/projects/" + id + "?tab=hearing"}>ヒアリング入力</Link>
          <Link href={"/projects/" + id + "?tab=diagnosis"}>診断結果</Link>
          <Link href={"/projects/" + id + "?tab=proposal"}>提案出力</Link>
          <Link href={"/projects/" + id + "?tab=handover"}>引継ぎメモ</Link>
          <Link href="/admin">管理画面</Link>
        </div>
      </div>

      {tab === "hearing" && (
        <section className="card grid two">
          <input value={hearing.site.buildingType} onChange={(e) => setHearing({ ...hearing, site: { ...hearing.site, buildingType: e.target.value } })} placeholder="建物タイプ" />
          <input value={hearing.site.siteCondition} onChange={(e) => setHearing({ ...hearing, site: { ...hearing.site, siteCondition: e.target.value } })} placeholder="敷地条件" />
          <input type="number" value={hearing.preferences.parkingCount} onChange={(e) => setHearing({ ...hearing, preferences: { ...hearing.preferences, parkingCount: Number(e.target.value) } })} placeholder="駐車台数" />
          <select value={hearing.preferences.budgetBand} onChange={(e) => setHearing({ ...hearing, preferences: { ...hearing.preferences, budgetBand: e.target.value } })}>
            <option value="low">低予算</option>
            <option value="mid">標準</option>
            <option value="high">高予算</option>
          </select>
          <label><input type="checkbox" checked={hearing.preferences.needPrivacy} onChange={(e) => setHearing({ ...hearing, preferences: { ...hearing.preferences, needPrivacy: e.target.checked } })} />目隠し要</label>
          <label><input type="checkbox" checked={hearing.preferences.gardenUse} onChange={(e) => setHearing({ ...hearing, preferences: { ...hearing.preferences, gardenUse: e.target.checked } })} />庭利用あり</label>
          <label><input type="checkbox" checked={hearing.preferences.kidsOrPets} onChange={(e) => setHearing({ ...hearing, preferences: { ...hearing.preferences, kidsOrPets: e.target.checked } })} />子ども/ペットあり</label>
          <textarea value={hearing.memo} onChange={(e) => setHearing({ ...hearing, memo: e.target.value })} placeholder="メモ" />
          <button onClick={saveHearing}>ヒアリング保存</button>
        </section>
      )}

      {tab === "diagnosis" && (
        <>
          <section className="card" style={{ display: "flex", gap: 12 }}>
            <button onClick={() => generate("diagnosis")}>診断生成</button>
            <button className="secondary" onClick={saveDiagnosis}>編集を保存</button>
          </section>

          <SectionCard title="施主要望サマリー">
            <BulletListEditor items={diagnosisDraft.summary} editable onChange={(items) => setDiagnosisDraft({ ...diagnosisDraft, summary: items })} />
          </SectionCard>

          <SectionCard title="外構失敗リスク">
            <BulletListEditor items={diagnosisDraft.risks} editable onChange={(items) => setDiagnosisDraft({ ...diagnosisDraft, risks: items })} />
          </SectionCard>

          <SectionCard title="優先順位">
            <BulletListEditor items={diagnosisDraft.priorities} editable onChange={(items) => setDiagnosisDraft({ ...diagnosisDraft, priorities: items })} />
          </SectionCard>

          <SectionCard title="提案方針（最低限）">
            <BulletListEditor
              items={diagnosisDraft.policy.minimum}
              editable
              onChange={(items) =>
                setDiagnosisDraft({
                  ...diagnosisDraft,
                  policy: { ...diagnosisDraft.policy, minimum: items }
                })
              }
            />
          </SectionCard>

          <SectionCard title="予算が限られる場合の削減候補">
            <BulletListEditor
              items={diagnosisDraft.policy.reduceCandidates}
              editable
              onChange={(items) =>
                setDiagnosisDraft({
                  ...diagnosisDraft,
                  policy: { ...diagnosisDraft.policy, reduceCandidates: items }
                })
              }
            />
          </SectionCard>

          <SectionCard title="削ると不満化しやすい項目">
            <BulletListEditor
              items={diagnosisDraft.policy.dontCut}
              editable
              onChange={(items) =>
                setDiagnosisDraft({
                  ...diagnosisDraft,
                  policy: { ...diagnosisDraft.policy, dontCut: items }
                })
              }
            />
          </SectionCard>

          <SectionCard title="営業トーク補助">
            <BulletListEditor items={diagnosisDraft.salesTalk} editable onChange={(items) => setDiagnosisDraft({ ...diagnosisDraft, salesTalk: items })} />
          </SectionCard>

          <DisclaimerBox lines={diagnosisDraft.disclaimer} />
        </>
      )}

      {tab === "proposal" && (
        <>
          <section className="card" style={{ display: "flex", gap: 12 }}>
            <button onClick={() => generate("proposal")}>提案3案生成</button>
            <button className="secondary" onClick={saveProposal}>編集を保存</button>
            <button className="secondary" onClick={exportPdf}>PDF出力</button>
          </section>

          <SectionCard title="3案比較（最低限 / 標準 / 理想）">
            <ThreePlanTable
              minimum={proposalDraft.minimum}
              standard={proposalDraft.standard}
              ideal={proposalDraft.ideal}
              onChangeMinimum={(items) => setProposalDraft({ ...proposalDraft, minimum: items })}
              onChangeStandard={(items) => setProposalDraft({ ...proposalDraft, standard: items })}
              onChangeIdeal={(items) => setProposalDraft({ ...proposalDraft, ideal: items })}
            />
          </SectionCard>

          <SectionCard title="施主説明用要約">
            <textarea
              value={proposalDraft.customerSummary}
              onChange={(e) => setProposalDraft({ ...proposalDraft, customerSummary: e.target.value })}
              placeholder="施主説明用要約"
            />
          </SectionCard>

          <DisclaimerBox lines={proposalDraft.disclaimer} />
        </>
      )}

      {tab === "handover" && (
        <>
          <section className="card" style={{ display: "flex", gap: 12 }}>
            <button onClick={() => generate("handover")}>引継ぎメモ生成</button>
            <button className="secondary" onClick={saveHandover}>編集を保存</button>
          </section>

          <SectionCard title="施主優先事項">
            <BulletListEditor items={handoverDraft.topPriorities} editable onChange={(items) => setHandoverDraft({ ...handoverDraft, topPriorities: items })} />
          </SectionCard>

          <SectionCard title="建物との統一感の要点">
            <BulletListEditor items={handoverDraft.styleNotes} editable onChange={(items) => setHandoverDraft({ ...handoverDraft, styleNotes: items })} />
          </SectionCard>

          <SectionCard title="絶対NG事項">
            <BulletListEditor items={handoverDraft.absoluteNg} editable onChange={(items) => setHandoverDraft({ ...handoverDraft, absoluteNg: items })} />
          </SectionCard>

          <SectionCard title="現調で確認すべき点">
            <BulletListEditor items={handoverDraft.fieldCheckPoints} editable onChange={(items) => setHandoverDraft({ ...handoverDraft, fieldCheckPoints: items })} />
          </SectionCard>

          <DisclaimerBox lines={handoverDraft.disclaimer} />
        </>
      )}

      {message ? <div className="card">{message}</div> : null}

      <SectionCard title="変更履歴（最新30件）" description="保存・生成・出力の履歴">
        <div className="grid">
          {audits.map((log, index) => {
            const prev = audits[index + 1];
            const changedKeys = computeDiff(log.detailJson, prev?.detailJson);
            const flattened = flattenObject(log.detailJson);
            const previewItems = Object.entries(flattened)
              .filter(([key]) => key !== "disclaimer")
              .slice(0, 6);
            return (
              <details key={log.id} className="card" style={{ padding: 12 }}>
                <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                  {new Date(log.createdAt).toLocaleString()} / {(actionLabels[log.action] ?? log.action)} / {log.actor}
                </summary>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>変更項目</div>
                  {changedKeys.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {changedKeys.slice(0, 20).map((k) => (
                        <span
                          key={k}
                          style={{
                            background: "#eef3ef",
                            border: "1px solid #cfdbd1",
                            borderRadius: 999,
                            padding: "2px 10px",
                            fontSize: 12
                          }}
                        >
                          {labelForPath(k)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div>差分なし</div>
                  )}
                  <div style={{ marginTop: 10, fontWeight: 700 }}>内容プレビュー</div>
                  {previewItems.length > 0 ? (
                    <ul style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
                      {previewItems.map(([key, value]) => (
                        <li key={key}>
                          {labelForPath(key)}: {prettyValue(value)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ marginTop: 6 }}>表示できる内容がありません</div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
