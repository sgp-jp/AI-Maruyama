#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/ec2_bootstrap.sh"
  exit 1
fi

dnf update -y
dnf install -y docker git

systemctl enable docker
systemctl start docker

if id ec2-user >/dev/null 2>&1; then
  usermod -aG docker ec2-user
fi

echo "Bootstrap complete. Re-login once to apply docker group if needed."
