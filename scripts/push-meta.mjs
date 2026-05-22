#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/push-meta.mjs — Supabase app_meta 테이블에 버전/epoch 동기화
//
//  src/lib/version.ts 의 APP_VERSION + APP_EPOCH 를 읽어
//  Supabase app_meta 테이블에 upsert.
//
//  사용:
//    node scripts/push-meta.mjs          배포 확인 후 push (기본)
//    node scripts/push-meta.mjs --now    즉시 push (대기 없음)
//
//  환경 변수 (.env 에서 자동 로드):
//    VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
//    DEPLOY_URL (배포된 사이트 URL, 기본: https://rpgmanager.vercel.app)
// ═══════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projRoot = resolve(__dirname, '..');
const skipWait = process.argv.includes('--now');

// ── .env 로드 ──
function loadEnv() {
  const env = {};
  try {
    const raw = readFileSync(resolve(projRoot, '.env'), 'utf-8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  } catch { /* no .env */ }
  return env;
}

const dotenv = loadEnv();
const SUPABASE_URL = process.env.SUPABASE_URL || dotenv.VITE_SUPABASE_URL || dotenv.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || dotenv.VITE_SUPABASE_ANON_KEY || dotenv.SUPABASE_ANON_KEY;
const DEPLOY_URL = dotenv.DEPLOY_URL || 'https://rpgmanager-beryl.vercel.app';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[push-meta] SUPABASE_URL 또는 SUPABASE_KEY 환경변수가 없습니다.');
  process.exit(1);
}

// ── version.ts 파싱 ──
const versionFile = readFileSync(resolve(projRoot, 'src', 'lib', 'version.ts'), 'utf-8');
const versionMatch = versionFile.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
const epochMatch = versionFile.match(/APP_EPOCH\s*=\s*(\d+)/);

if (!versionMatch || !epochMatch) {
  console.error('[push-meta] version.ts 파싱 실패');
  process.exit(1);
}

const version = versionMatch[1];
const epoch = parseInt(epochMatch[1], 10);
console.log(`[push-meta] APP_VERSION = ${version}, APP_EPOCH = ${epoch}`);

// ── 빌드 시 version.json 생성 (public/) ──
const versionJsonPath = resolve(projRoot, 'public', 'version.json');
writeFileSync(versionJsonPath, JSON.stringify({ version, epoch }));
console.log(`  ✓ public/version.json 생성`);

// ── 배포 확인: version.json 폴링 ──
async function waitForDeployment() {
  const url = `${DEPLOY_URL}/version.json?_v=${Date.now()}`;
  const maxRetries = 30;  // 최대 5분 (10초 × 30)
  const interval = 10_000;

  console.log(`\n[push-meta] Vercel 배포 대기 중... (${DEPLOY_URL})`);

  for (let i = 1; i <= maxRetries; i++) {
    try {
      const res = await fetch(`${DEPLOY_URL}/version.json?_v=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.version === version) {
          console.log(`  ✓ 배포 확인! (v${data.version})`);
          return true;
        }
        console.log(`  … ${i}/${maxRetries} — 배포 중 (사이트: v${data.version}, 대기: v${version})`);
      } else {
        console.log(`  … ${i}/${maxRetries} — version.json 없음 (${res.status}), 첫 배포 대기...`);
      }
    } catch (e) {
      console.log(`  … ${i}/${maxRetries} — 연결 실패, 재시도...`);
    }
    await new Promise(r => setTimeout(r, interval));
  }

  console.warn('\n[push-meta] ⚠ 배포 확인 타임아웃. 그래도 push 진행합니다.');
  return false;
}

// ── Supabase upsert ──
async function upsertMeta(key, value) {
  const url = `${SUPABASE_URL}/rest/v1/app_meta`;
  const body = JSON.stringify({ key, value: String(value), updated_at: new Date().toISOString() });

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

// ── 실행 ──
try {
  if (!skipWait) {
    await waitForDeployment();
  } else {
    console.log('\n[push-meta] --now 플래그: 배포 대기 건너뜀');
  }

  await upsertMeta('latestVersion', version);
  await upsertMeta('epoch', epoch);
  console.log(`\n[push-meta] 완료 — v${version} (epoch=${epoch}) → Supabase 동기화됨`);
  console.log('  → 접속 중인 유저에게 업데이트 모달이 표시됩니다.');
} catch (e) {
  console.error('\n[push-meta] 실패:', e.message);
  process.exit(1);
}
