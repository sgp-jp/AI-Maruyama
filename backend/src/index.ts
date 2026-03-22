import cors from "cors";
import express from "express";
import multer from "multer";
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.PORT ?? 4000);
const storageRoot = process.env.FILE_STORAGE_ROOT ?? "/tmp/data";

fs.mkdirSync(path.join(storageRoot, "uploads"), { recursive: true });
fs.mkdirSync(path.join(storageRoot, "exports"), { recursive: true });

const upload = multer({ dest: path.join(storageRoot, "uploads") });

app.use(cors());
app.use(express.json({ limit: "5mb" }));

const disclaimerLines = [
  process.env.REQUIRED_DISCLAIMER_1 ?? "本機能は外構の判断補助です",
  process.env.REQUIRED_DISCLAIMER_2 ?? "最終設計・施工判断は専門業者確認前提です",
  process.env.REQUIRED_DISCLAIMER_3 ?? "現地条件により内容は変わります",
  process.env.REQUIRED_DISCLAIMER_4 ?? "提案内容は概念整理であり、施工保証ではありません"
];

const projectCreateSchema = z.object({
  name: z.string().min(1),
  customerName: z.string().min(1),
  assignee: z.string().min(1)
});

const hearingSchema = z.object({
  site: z.object({
    buildingType: z.string().default(""),
    siteCondition: z.string().default(""),
    roadSide: z.boolean().default(false),
    handoverDate: z.string().default("")
  }),
  preferences: z.object({
    parkingCount: z.number().int().min(0).default(1),
    needPrivacy: z.boolean().default(false),
    gardenUse: z.boolean().default(false),
    kidsOrPets: z.boolean().default(false),
    weedControlPriority: z.number().min(1).max(5).default(3),
    securityPriority: z.number().min(1).max(5).default(3),
    designPriority: z.number().min(1).max(5).default(3),
    maintenanceTolerance: z.number().min(1).max(5).default(3),
    budgetBand: z.enum(["low", "mid", "high"]).default("mid")
  }),
  building: z.object({
    taste: z.string().default(""),
    wallColor: z.string().default(""),
    entrancePos: z.string().default(""),
    windowPoints: z.string().default(""),
    parkingPos: z.string().default("")
  }),
  memo: z.string().default(""),
  mustHaves: z.array(z.string()).default([])
});

type Hearing = z.infer<typeof hearingSchema>;

type DiagnosisPayload = {
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

type ProposalPayload = {
  minimum: string[];
  standard: string[];
  ideal: string[];
  customerSummary: string;
  disclaimer: string[];
};

type HandoverPayload = {
  topPriorities: string[];
  styleNotes: string[];
  absoluteNg: string[];
  fieldCheckPoints: string[];
  disclaimer: string[];
};

const diagnosisEditSchema = z.object({
  summary: z.array(z.string()),
  risks: z.array(z.string()),
  priorities: z.array(z.string()),
  policy: z.object({
    minimum: z.array(z.string()),
    reduceCandidates: z.array(z.string()),
    dontCut: z.array(z.string()),
    talkTrack: z.array(z.string())
  }),
  salesTalk: z.array(z.string())
});

const proposalEditSchema = z.object({
  minimum: z.array(z.string()),
  standard: z.array(z.string()),
  ideal: z.array(z.string()),
  customerSummary: z.string()
});

const handoverEditSchema = z.object({
  topPriorities: z.array(z.string()),
  styleNotes: z.array(z.string()),
  absoluteNg: z.array(z.string()),
  fieldCheckPoints: z.array(z.string())
});

function withDisclaimer<T extends object>(payload: T): T & { disclaimer: string[] } {
  return { ...payload, disclaimer: disclaimerLines };
}

function normalizeInput(input: Hearing) {
  return {
    ...input,
    memo: input.memo.trim(),
    mustHaves: input.mustHaves.filter(Boolean)
  };
}

function rankPriorities(input: Hearing): string[] {
  const pairs: Array<{ name: string; score: number }> = [
    { name: "生活利便性", score: 6 - input.preferences.parkingCount + input.preferences.securityPriority },
    { name: "目隠し", score: input.preferences.needPrivacy ? 6 : 2 },
    { name: "メンテ軽減", score: 6 - input.preferences.maintenanceTolerance + input.preferences.weedControlPriority },
    { name: "デザイン", score: input.preferences.designPriority }
  ];
  return pairs.sort((a, b) => b.score - a.score).map((item) => item.name);
}

function evaluateRisks(input: Hearing): string[] {
  const risks: string[] = [];
  if (input.site.roadSide && input.preferences.needPrivacy) {
    risks.push("道路側視線への対策不足リスク（目隠し計画の早期確定が必要）");
  }
  if (input.preferences.parkingCount >= 2 && input.building.parkingPos.length === 0) {
    risks.push("駐車切り返しストレス（駐車動線未確定）");
  }
  if (input.preferences.securityPriority >= 4) {
    risks.push("夜間暗さによる不満（照明計画不足）");
  }
  if (input.preferences.weedControlPriority >= 4) {
    risks.push("防草対策不足による後悔（舗装/防草シート検討必須）");
  }
  if (input.preferences.kidsOrPets && input.preferences.gardenUse) {
    risks.push("子ども・ペット動線での安全性不足（滑り/角/汚れ対策優先）");
  }
  if (input.preferences.maintenanceTolerance <= 2) {
    risks.push("植栽過多によるメンテ負荷増大");
  }
  if (input.preferences.budgetBand === "low" && input.mustHaves.length >= 4) {
    risks.push("予算低×要望多による満足度低下（優先順位説明が必須）");
  }
  if (risks.length === 0) {
    risks.push("大きな構造リスクは低いが、現地条件確認前提で計画を確定する必要があります");
  }
  return risks;
}

function buildDiagnosis(input: Hearing): DiagnosisPayload {
  const priority = rankPriorities(input);
  const risks = evaluateRisks(input);
  const budgetLabel = input.preferences.budgetBand === "low" ? "予算制約が強い" : input.preferences.budgetBand === "mid" ? "予算は標準帯" : "予算は比較的柔軟";

  const minimum = [
    "駐車・アプローチ・境界の3点を先に確定",
    "夜間照明と防草を最低限の範囲で先行施工"
  ];

  const reduceCandidates = [
    "装飾性の高い植栽量",
    "高単価仕上げ材の一部",
    "初期時点での庭フル施工"
  ];

  const dontCut = [
    "駐車の使い勝手",
    "視線ストレス対策",
    "安全と防犯に直結する照明"
  ];

  const talkTrack = [
    "先に生活動線を固めることで、後悔と追加費用を抑えます",
    "削る部分と残す部分を明確にし、将来増設できる設計にします",
    "見た目の優先度は残しつつ、体感不満が出る項目は先行で実施します"
  ];

  const salesTalk = [
    "目隠しフェンスは高さと抜け感のバランスで圧迫感を下げられます",
    "予算が厳しい場合は、最初に不満化しやすい項目から確保します",
    "相見積もり時は、価格だけでなく将来追加費用の発生有無を比較軸にします"
  ];

  return {
    summary: [
      `この施主は「${priority.join(" > ")}」の順で重視する傾向があります`,
      input.preferences.kidsOrPets ? "将来的に子ども・ペットの使い方変化を考慮すべきです" : "ライフステージ変化は中程度として設計します",
      `${budgetLabel}ため、優先順位の説明が重要です`
    ],
    risks,
    priorities: priority,
    policy: { minimum, reduceCandidates, dontCut, talkTrack },
    salesTalk,
    disclaimer: disclaimerLines
  };
}

function buildProposal(diag: DiagnosisPayload) {
  return withDisclaimer({
    minimum: [...diag.policy.minimum, "将来拡張前提の配管・下地のみ先行"],
    standard: [...diag.policy.minimum, "目隠しと防犯照明を計画的に実装", "雑草対策を主要動線まで拡張"],
    ideal: [...diag.policy.minimum, "外観統一感を高める素材・植栽を一体設計", "庭利用と夜間演出まで初期実装"],
    customerSummary: "最小費用でも日常不満を抑える順で実施し、将来拡張可能な計画にする提案です"
  });
}

function buildHandover(input: Hearing, diag: DiagnosisPayload) {
  return withDisclaimer({
    topPriorities: diag.priorities,
    styleNotes: [
      `建物テイスト: ${input.building.taste || "未指定"}`,
      `外壁色: ${input.building.wallColor || "未指定"}`,
      "建物外観との統一感を優先し、過度な異素材ミックスを避ける"
    ],
    absoluteNg: [
      "駐車動線を狭める計画",
      "夜間安全性を落とす照明削減",
      "メンテ負荷が急増する植栽過多"
    ],
    fieldCheckPoints: [
      "道路・隣地からの視線角度",
      "雨天時の水はけと高低差",
      "車両切り返し回数",
      "夜間照度の不足箇所"
    ]
  });
}

async function writeAudit(action: string, actor: string, detailJson: Prisma.InputJsonValue, projectId?: string) {
  await prisma.auditLog.create({ data: { action, actor, detailJson, projectId } });
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/projects", async (_req, res) => {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" }
  });
  res.json(projects);
});

app.post("/projects", async (req, res) => {
  const parsed = projectCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const project = await prisma.project.create({ data: parsed.data });
  await writeAudit("project.created", "system", parsed.data, project.id);
  return res.status(201).json(project);
});

app.get("/projects/:id", async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      hearingInput: true,
      diagnosisResult: true,
      proposalDraft: true,
      handoverMemo: true
    }
  });
  if (!project) {
    return res.status(404).json({ error: "Not found" });
  }
  res.json(project);
});

app.get("/projects/:id/audits", async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    where: { projectId: req.params.id },
    orderBy: { createdAt: "desc" },
    take: 30
  });
  res.json(logs);
});

app.post("/projects/:id/hearing", upload.array("photos", 5), async (req, res) => {
  const payload = typeof req.body.payload === "string" ? JSON.parse(req.body.payload) : req.body;
  const parsed = hearingSchema.safeParse(payload);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  const files = ((req.files as Express.Multer.File[] | undefined) ?? []).map((f) => ({
    originalName: f.originalname,
    path: f.path
  }));

  const normalized = normalizeInput(parsed.data);

  await prisma.hearingInput.upsert({
    where: { projectId: req.params.id },
    create: { projectId: req.params.id, payloadJson: { ...normalized, files } },
    update: { payloadJson: { ...normalized, files } }
  });

  await prisma.project.update({ where: { id: req.params.id }, data: { status: "hearing_saved" } });
  await writeAudit("hearing.saved", "system", { ...normalized, files }, req.params.id);
  res.json({ ok: true });
});

app.post("/projects/:id/diagnosis/generate", async (req, res) => {
  const hearing = await prisma.hearingInput.findUnique({ where: { projectId: req.params.id } });
  if (!hearing) {
    return res.status(400).json({ error: "hearing not found" });
  }

  const parsed = hearingSchema.safeParse(hearing.payloadJson);
  if (!parsed.success) {
    return res.status(500).json({ error: "invalid hearing payload" });
  }

  const result = buildDiagnosis(parsed.data);

  await prisma.diagnosisResult.upsert({
    where: { projectId: req.params.id },
    create: { projectId: req.params.id, payloadJson: result },
    update: { payloadJson: result }
  });

  await prisma.project.update({ where: { id: req.params.id }, data: { status: "diagnosed" } });
  await writeAudit("diagnosis.generated", "system", result, req.params.id);

  res.json(result);
});

app.patch("/projects/:id/diagnosis", async (req, res) => {
  const parsed = diagnosisEditSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const payload: DiagnosisPayload = withDisclaimer(parsed.data);
  await prisma.diagnosisResult.upsert({
    where: { projectId: req.params.id },
    create: { projectId: req.params.id, payloadJson: payload },
    update: { payloadJson: payload }
  });

  await writeAudit("diagnosis.edited", "system", payload, req.params.id);
  res.json(payload);
});

app.post("/projects/:id/proposals/generate", async (req, res) => {
  const diag = await prisma.diagnosisResult.findUnique({ where: { projectId: req.params.id } });
  if (!diag) {
    return res.status(400).json({ error: "diagnosis not found" });
  }

  const proposal = buildProposal(diag.payloadJson as DiagnosisPayload);
  await prisma.proposalDraft.upsert({
    where: { projectId: req.params.id },
    create: { projectId: req.params.id, payloadJson: proposal },
    update: { payloadJson: proposal }
  });

  await prisma.project.update({ where: { id: req.params.id }, data: { status: "proposal_ready" } });
  await writeAudit("proposal.generated", "system", proposal, req.params.id);

  res.json(proposal);
});

app.patch("/projects/:id/proposal", async (req, res) => {
  const parsed = proposalEditSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const payload: ProposalPayload = withDisclaimer(parsed.data);
  await prisma.proposalDraft.upsert({
    where: { projectId: req.params.id },
    create: { projectId: req.params.id, payloadJson: payload },
    update: { payloadJson: payload }
  });

  await writeAudit("proposal.edited", "system", payload, req.params.id);
  res.json(payload);
});

app.post("/projects/:id/handover/generate", async (req, res) => {
  const hearing = await prisma.hearingInput.findUnique({ where: { projectId: req.params.id } });
  const diag = await prisma.diagnosisResult.findUnique({ where: { projectId: req.params.id } });
  if (!hearing || !diag) {
    return res.status(400).json({ error: "hearing or diagnosis not found" });
  }

  const parsed = hearingSchema.safeParse(hearing.payloadJson);
  if (!parsed.success) {
    return res.status(500).json({ error: "invalid hearing payload" });
  }

  const memo = buildHandover(parsed.data, diag.payloadJson as DiagnosisPayload);

  await prisma.handoverMemo.upsert({
    where: { projectId: req.params.id },
    create: { projectId: req.params.id, payloadJson: memo },
    update: { payloadJson: memo }
  });

  await prisma.project.update({ where: { id: req.params.id }, data: { status: "handover_ready" } });
  await writeAudit("handover.generated", "system", memo, req.params.id);

  res.json(memo);
});

app.patch("/projects/:id/handover", async (req, res) => {
  const parsed = handoverEditSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const payload: HandoverPayload = withDisclaimer(parsed.data);
  await prisma.handoverMemo.upsert({
    where: { projectId: req.params.id },
    create: { projectId: req.params.id, payloadJson: payload },
    update: { payloadJson: payload }
  });

  await writeAudit("handover.edited", "system", payload, req.params.id);
  res.json(payload);
});

app.post("/projects/:id/pdf", async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      diagnosisResult: true,
      proposalDraft: true,
      handoverMemo: true
    }
  });

  if (!project) {
    return res.status(404).json({ error: "project not found" });
  }

  const exportPath = path.join(storageRoot, "exports", `${project.id}.pdf`);
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const stream = fs.createWriteStream(exportPath);

  doc.pipe(stream);
  doc.fontSize(16).text(`外構整理資料 - ${project.name}`);
  doc.moveDown(0.5).fontSize(12).text(`顧客: ${project.customerName}`);
  doc.text(`担当: ${project.assignee}`);
  doc.text(`ステータス: ${project.status}`);

  if (project.diagnosisResult) {
    doc.moveDown().fontSize(14).text("診断結果");
    const data = project.diagnosisResult.payloadJson as DiagnosisPayload;
    data.summary.forEach((line) => doc.fontSize(11).text(`・${line}`));
    doc.moveDown(0.2);
    data.risks.forEach((line) => doc.fontSize(11).text(`・${line}`));
  }

  if (project.proposalDraft) {
    const proposal = project.proposalDraft.payloadJson as { minimum: string[]; standard: string[]; ideal: string[] };
    doc.moveDown().fontSize(14).text("提案3案");
    doc.fontSize(12).text("最低限");
    proposal.minimum.forEach((line) => doc.fontSize(11).text(`・${line}`));
    doc.fontSize(12).text("標準");
    proposal.standard.forEach((line) => doc.fontSize(11).text(`・${line}`));
    doc.fontSize(12).text("理想");
    proposal.ideal.forEach((line) => doc.fontSize(11).text(`・${line}`));
  }

  if (project.handoverMemo) {
    const memo = project.handoverMemo.payloadJson as { topPriorities: string[]; absoluteNg: string[]; fieldCheckPoints: string[] };
    doc.moveDown().fontSize(14).text("引継ぎメモ");
    memo.topPriorities.forEach((line) => doc.fontSize(11).text(`・優先: ${line}`));
    memo.absoluteNg.forEach((line) => doc.fontSize(11).text(`・NG: ${line}`));
    memo.fieldCheckPoints.forEach((line) => doc.fontSize(11).text(`・現調: ${line}`));
  }

  doc.moveDown().fontSize(10).text("注意事項");
  disclaimerLines.forEach((line) => doc.fontSize(9).text(`・${line}`));
  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on("finish", () => resolve());
    stream.on("error", (err) => reject(err));
  });

  await writeAudit("pdf.generated", "system", { exportPath }, req.params.id);
  res.json({ url: `/api/exports/${project.id}.pdf` });
});

app.get("/exports/:name", (req, res) => {
  const filePath = path.join(storageRoot, "exports", req.params.name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "not found" });
  }
  res.sendFile(filePath);
});

app.get("/admin/templates", (_req, res) => {
  res.json({
    hearingTemplate: "ヒアリング要点テンプレ",
    diagnosisTemplate: "外構失敗リスクテンプレ",
    proposalTemplate: "最低限/標準/理想テンプレ",
    handoverTemplate: "外構業者引継ぎテンプレ",
    brandTone: "丁寧・断定回避・判断補助表現"
  });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "internal error" });
});

app.listen(port, () => {
  console.log(`backend listening on ${port}`);
});
