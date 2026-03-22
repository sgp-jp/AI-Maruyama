# 実装要件・コーディング規約（MVP）

## 実装方針

- LLM自由生成を避け、`入力正規化 -> ルール判定 -> テンプレ整形` を優先
- AI出力はすべて手編集可能
- 断定表現・施工保証誤認を避ける
- 監査ログを必ず残す

## コーディング規約

- TypeScript strict 必須
- any 禁止
- API入出力は Zod バリデーション
- Controller(ルーティング)とビジネスロジックを分離
- 例外時は内部情報を返さない
- 監査ログに `action, actor, projectId, detail` を残す

## API最小要件

- `POST /projects`
- `GET /projects`
- `GET /projects/:id`
- `POST /projects/:id/hearing`
- `POST /projects/:id/diagnosis/generate`
- `POST /projects/:id/proposals/generate`
- `POST /projects/:id/handover/generate`
- `POST /projects/:id/pdf`

## インフラ要件（EC2 1台）

- docker compose で全コンテナ同居
- nginx で `/api/*` を backend にプロキシ
- 添付/PDF はローカル永続化 `./data`
- 日次バックアップ（DB dump + data tar）
