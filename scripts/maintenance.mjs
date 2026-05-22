#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/maintenance.mjs — 서버 점검 모드 ON/OFF
//
//  사용:
//    node scripts/maintenance.mjs on              # 점검 시작 (기본 메시지)
//    node scripts/maintenance.mjs on "패치 중..."  # 점검 시작 (커스텀 메시지)
//    node scripts/maintenance.mjs off             # 점검 종료
// ═══════════════════════════════════════════════════════════════

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projRoot = resolve(__dirname, '..');

// .env 로드
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
  } catch { /* */ }
  return env;
}

const dotenv = loadEnv();
const SUPABASE_URL = process.env.SUPABASE_URL || dotenv.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || dotenv.VITE_SUPABASE_ANON_KEY;

const action = process.argv[2]; // on | off
const customMsg = process.argv[3];

if (!action || !['on', 'off'].includes(action)) {
  console.log('사용법: node scripts/maintenance.mjs <on|off> [메시지]');
  process.exit(1);
}

async function upsertMeta(key, value) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_meta`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ key, value: String(value) }),
  });
  if (!res.ok) throw new Error(`${key}: ${res.status} ${await res.text()}`);
}

try {
  if (action === 'on') {
    const msg = customMsg || '서버 점검 중입니다. 잠시 후 다시 접속해주세요.';
    await upsertMeta('maintenance', 'true');
    await upsertMeta('maintenanceMsg', msg);
    console.log(`✓ 점검 모드 ON — "${msg}"`);
  } else {
    await upsertMeta('maintenance', 'false');
    console.log('✓ 점검 모드 OFF — 게임 재개');
  }
} catch (e) {
  console.error('실패:', e.message);
  process.exit(1);
}
