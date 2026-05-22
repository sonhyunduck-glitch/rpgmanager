#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/push-meta.mjs — Supabase app_meta 테이블에 버전/epoch 동기화
//
//  src/lib/version.ts 의 APP_VERSION + APP_EPOCH 를 읽어
//  Supabase app_meta 테이블에 upsert.
//
//  사용:
//    node scripts/push-meta.mjs
//
//  환경 변수 (.env 에서 자동 로드):
//    VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
//    또는 SUPABASE_URL, SUPABASE_SERVICE_KEY (service role 우선)
// ═══════════════════════════════════════════════════════════════

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projRoot = resolve(__dirname, '..');

// ── .env 로드 (간단 파서) ──
function loadEnv() {
  const env = {};
  try {
    const raw = readFileSync(resolve(projRoot, '.env'), 'utf-8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
  } catch { /* no .env file */ }
  return env;
}

const dotenv = loadEnv();
const SUPABASE_URL = process.env.SUPABASE_URL || dotenv.VITE_SUPABASE_URL || dotenv.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || dotenv.VITE_SUPABASE_ANON_KEY || dotenv.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[push-meta] SUPABASE_URL 또는 SUPABASE_KEY 환경변수가 없습니다.');
  console.error('  .env 파일에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 를 확인하세요.');
  process.exit(1);
}

// ── version.ts 파싱 ──
const versionFile = readFileSync(resolve(projRoot, 'src', 'lib', 'version.ts'), 'utf-8');
const versionMatch = versionFile.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
const epochMatch = versionFile.match(/APP_EPOCH\s*=\s*(\d+)/);

if (!versionMatch) {
  console.error('[push-meta] APP_VERSION not found in src/lib/version.ts');
  process.exit(1);
}
if (!epochMatch) {
  console.error('[push-meta] APP_EPOCH not found in src/lib/version.ts');
  process.exit(1);
}

const version = versionMatch[1];
const epoch = parseInt(epochMatch[1], 10);

console.log(`[push-meta] APP_VERSION = ${version}, APP_EPOCH = ${epoch}`);

// ── Supabase REST API 로 upsert ──
async function upsertMeta(key, value) {
  const url = `${SUPABASE_URL}/rest/v1/app_meta`;
  const body = JSON.stringify({ key, value: String(value) });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'resolution=merge-duplicates',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${key} upsert 실패 (${res.status}): ${text}`);
  }
  console.log(`  ✓ ${key} = ${value}`);
}

try {
  await upsertMeta('latestVersion', version);
  await upsertMeta('epoch', epoch);
  console.log(`\n[push-meta] 완료 — v${version} (epoch=${epoch}) → Supabase app_meta 동기화됨`);
  console.log('  → 접속 중인 유저에게 업데이트 모달이 표시됩니다.');
} catch (e) {
  console.error('\n[push-meta] 실패:', e.message);
  console.error('\n  ⚠ app_meta 테이블이 없으면 Supabase SQL Editor에서 생성하세요:');
  console.error(`
  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- RLS 설정: 읽기는 누구나, 쓰기는 service role만
  ALTER TABLE app_meta ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Anyone can read meta" ON app_meta FOR SELECT USING (true);

  -- Realtime 활성화
  ALTER PUBLICATION supabase_realtime ADD TABLE app_meta;

  -- 초기 데이터
  INSERT INTO app_meta (key, value) VALUES
    ('latestVersion', '${version}'),
    ('epoch', '${epoch}'),
    ('maintenance', 'false'),
    ('maintenanceMsg', '서버 점검 중입니다.')
  ON CONFLICT (key) DO NOTHING;
  `);
  process.exit(1);
}
