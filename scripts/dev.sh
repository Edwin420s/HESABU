#!/usr/bin/env bash
set -euo pipefail
docker compose up -d db
echo "PostgreSQL started. In another terminal: cd backend && npm install && npx prisma generate && npx prisma migrate dev --name init && npm run db:seed && npm run dev"
echo "Then: cd frontend && npm install && npm run dev"
