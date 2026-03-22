# 外構MVP (EC2 1台最小構成)

EC2 1台で運用検証できる最小構成です。

- `nginx` (reverse proxy)
- `frontend` (Next.js)
- `backend` (Express + Prisma)
- `db` (PostgreSQL)
- `redis` (queue/cache)
- `worker` (heartbeat worker)

## 起動

```bash
docker compose up -d --build
```

EC2へのデプロイ手順:

- [EC2デプロイ手順](/Users/sakamotonaoya/Desktop/AI-Maruyama/docs/EC2_DEPLOY.md)
- `.env` は `.env.ec2.example` をコピーして作成

## 停止

```bash
docker compose down
```

## 動作確認

- 画面: `http://<EC2のIP>/projects`
- APIヘルス: `http://<EC2のIP>/api/health`

## 画面

- `/projects` 案件一覧
- `/projects/:id?tab=hearing` ヒアリング入力
- `/projects/:id?tab=diagnosis` 診断結果
- `/projects/:id?tab=proposal` 提案出力
- `/projects/:id?tab=handover` 引継ぎメモ
- `/admin` 管理画面

## バックアップ

```bash
./scripts/backup.sh
```

- `backups/db_*.sql`
- `backups/files_*.tar.gz`

## 注意事項（自動付与）

- 本機能は外構の判断補助です
- 最終設計・施工判断は専門業者確認前提です
- 現地条件により内容は変わります
- 提案内容は概念整理であり、施工保証ではありません
