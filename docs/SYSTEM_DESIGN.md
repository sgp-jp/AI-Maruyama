# システムデザイン（MVP / EC2単体）

## 1. 背景と目的

現状の実装では、診断結果・提案・引継ぎメモが `JSON` のまま画面表示されている。
この状態は以下の課題を持つ。

- 営業担当が打ち合わせ中に読み上げしづらい
- 施主説明用の見やすさが不足
- どこが重要か瞬時に判断しづらい
- 編集対象（文言・優先順位・注意事項）が分かりにくい

本ドキュメントの目的は、**JSONを内部契約として維持しつつ、UIは業務向けの構造表示に変換する設計**を定義すること。

## 2. 設計方針

- APIは JSON 契約を維持（後方互換性）
- フロントエンドで ViewModel に変換して表示
- 各出力を「見出し + 箇条書き + 編集欄」に分割
- 免責文言（必須4文）は常時表示・編集不可
- JSONの生表示は「デバッグモード時のみ」

## 3. 現行アーキテクチャ

- `nginx` が `/api/*` を `backend` にリバースプロキシ
- `frontend` (Next.js) がUIを提供
- `backend` (Express + Prisma) が診断ロジックを生成
- `PostgreSQL` が案件/生成結果を保持
- `worker` は非同期処理の最小実装（heartbeat）

## 4. 論理アーキテクチャ（表示改善後）

1. `backend` は従来どおり JSON 返却
2. `frontend` で `DTO -> ViewModel` 変換
3. `SectionCard` コンポーネントで各セクション描画
4. 編集は `textarea` 単位で行い、保存時に JSON 再構築
5. PDF出力は保存済みの構造データを使用

## 5. 表示モデル定義

### 5.1 診断結果タブ

入力（API）:

- `summary: string[]`
- `risks: string[]`
- `priorities: string[]`
- `policy.minimum: string[]`
- `policy.reduceCandidates: string[]`
- `policy.dontCut: string[]`
- `policy.talkTrack: string[]`
- `salesTalk: string[]`
- `disclaimer: string[]`

表示（UI）:

- 施主要望サマリー（カード）
- 外構失敗リスク（重要度タグ付きリスト）
- 優先順位（1位〜4位）
- 提案方針（最低限・削減候補・削れない項目）
- 営業トーク補助（折りたたみ可）
- 注意事項（固定表示）

### 5.2 提案タブ

入力:

- `minimum: string[]`
- `standard: string[]`
- `ideal: string[]`
- `customerSummary: string`
- `disclaimer: string[]`

表示:

- 3列比較（最低限 / 標準 / 理想）
- 施主説明用要約（単独カード）
- PDF出力ボタン
- 注意事項（固定表示）

### 5.3 引継ぎタブ

入力:

- `topPriorities: string[]`
- `styleNotes: string[]`
- `absoluteNg: string[]`
- `fieldCheckPoints: string[]`
- `disclaimer: string[]`

表示:

- 優先事項
- 建物との統一感メモ
- 絶対NG
- 現調チェック項目
- 共有用テキスト出力ボタン
- 注意事項（固定表示）

## 6. コンポーネント設計（frontend）

新規推奨コンポーネント:

- `components/SectionCard.tsx`
- `components/BulletListEditor.tsx`
- `components/PriorityList.tsx`
- `components/DisclaimerBox.tsx`
- `components/ThreePlanTable.tsx`

責務:

- `SectionCard`: 見出し・説明・中身の共通レイアウト
- `BulletListEditor`: 箇条書きの表示/編集
- `PriorityList`: 順位表示
- `DisclaimerBox`: 必須文言固定表示
- `ThreePlanTable`: 3案比較

## 7. API契約ルール

- 既存エンドポイントは変更しない
- 既存JSONキーは原則維持
- UI編集保存用に将来 `PATCH /projects/:id/*` を追加
- バリデーションは Zod で継続

## 8. データ保存ルール

- DBには構造JSONを保持（表示HTMLは保存しない）
- 監査ログに「生成」「編集」「PDF出力」を記録
- 必須免責文言は保存時に再付与（欠落防止）

## 9. 非機能要件（表示改善版）

- 打ち合わせ時操作: クリック3回以内で主要情報へ到達
- モバイル: 1カラムで崩れない
- 可読性: 本文14px以上、行間1.5相当
- 体感速度: タブ切替200ms以内目標

## 10. 実装ステップ

1. ViewModel変換層を `projects/[id]/page.tsx` に追加
2. JSON `<pre>` をセクション表示へ置換
3. `DisclaimerBox` を全タブ共通適用
4. 編集UI（箇条書き・要約）を追加
5. 保存API（PATCH）を追加
6. PDFを編集結果に追従

## 11. 受け入れ基準

- JSON生表示なしで主要情報が読める
- 営業が10分以内に資料生成〜説明準備できる
- 必須免責文言が常に表示される
- 既存生成APIの互換性を壊さない

## 12. リスクと対策

- リスク: UI変換でキー欠落
  - 対策: Zodの `safeParse` とフォールバック表示
- リスク: 編集時に免責文言が消える
  - 対策: 保存時のサーバー再付与
- リスク: モバイル崩れ
  - 対策: 3案比較をモバイル時は縦積みに切替

## 13. 補足

本設計はEC2単体構成向けMVPを前提とし、将来のRDS/S3分離にも流用可能。
