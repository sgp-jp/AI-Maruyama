# EC2デプロイ手順（最小構成 / Docker Compose）

この手順で、外構MVPを **EC2 1台** にデプロイできます。

## 1. 事前準備

- AWSアカウント
- GitリポジトリURL
- EC2へSSHできるキーペア

推奨:

- AMI: Amazon Linux 2023
- Instance: t3.small 以上
- Storage: 30GB 以上

## 2. セキュリティグループ

最低限の受信ルール:

- TCP 22: 自分のIPのみ
- TCP 80: 0.0.0.0/0

HTTPSを使う場合のみ:

- TCP 443: 0.0.0.0/0

## 3. EC2初期化

EC2へSSH後:

```bash
sudo mkdir -p /opt/AI-Maruyama
sudo chown -R ec2-user:ec2-user /opt/AI-Maruyama
cd /opt/AI-Maruyama
```

リポジトリを取得:

```bash
git clone <YOUR_REPOSITORY_URL> /opt/AI-Maruyama
cd /opt/AI-Maruyama
```

Docker導入:

```bash
sudo bash scripts/ec2_bootstrap.sh
exit
```

`docker` グループ反映のため再SSH。

## 4. 環境変数設定

```bash
cd /opt/AI-Maruyama
cp .env.ec2.example .env
vi .env
```

最低限変更:

- `POSTGRES_PASSWORD`

## 5. デプロイ

```bash
cd /opt/AI-Maruyama
bash scripts/deploy_ec2.sh
```

確認:

```bash
curl -sS http://localhost/api/health
```

ブラウザ確認:

- `http://<EC2_PUBLIC_IP>/projects`

## 6. 自動起動（任意だが推奨）

```bash
sudo cp infra/AI-Maruyama.service /etc/systemd/system/AI-Maruyama.service
sudo systemctl daemon-reload
sudo systemctl enable AI-Maruyama
sudo systemctl start AI-Maruyama
sudo systemctl status AI-Maruyama --no-pager
```

## 7. 更新デプロイ

```bash
cd /opt/AI-Maruyama
bash scripts/deploy_ec2.sh
```

## 8. バックアップ

```bash
cd /opt/AI-Maruyama
./scripts/backup.sh
```

生成先:

- `backups/db_*.sql`
- `backups/files_*.tar.gz`

## 9. トラブルシュート

コンテナ状態:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx
```

再起動:

```bash
docker compose down
docker compose up -d --build
```

---

補足: 本手順はHTTP(80)前提です。運用段階でドメイン利用する場合は、次フェーズでALB+ACMかNginx+Let's Encryptへ拡張してください。
