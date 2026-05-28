/* =========================================================
   VERSION — 앱 버전 단일 상수 (Single Source of Truth)

   📌 새 버전 배포 시 갱신 순서:
     1. 이 파일의 APP_VERSION 변경
     2. git push → Vercel 자동 배포
     3. node scripts/push-meta.mjs → Supabase meta 테이블 갱신
        → 모든 활성 사용자에게 자동으로 업데이트 모달 노출

   📌 데이터 초기화 시:
     1. APP_EPOCH 숫자 올리기
     2. git push → 배포
     3. 접속 유저: 로컬 epoch ≠ APP_EPOCH → localStorage 전체 삭제
   ========================================================= */

// v2.39.35 — 몬스터 리스폰 즉시 배치 + 근접 공격 모션
export const APP_VERSION = '2.39.35';

// ───── 데이터 EPOCH (데이터 초기화 시 ↑) ─────
//   APP_EPOCH 가 올라가면 클라가 보유한 옛 localStorage 전체 폐기.
//   로컬 epoch !== APP_EPOCH → initFromDB 진입 직전 wipe.
//
//   히스토리:
//     1 — 초기 배포
//     2 — 클래스 시스템 도입 (전체 데이터 초기화 + 캐릭터 재생성)
export const APP_EPOCH = 2;

// 빌드 문자열
export const APP_BUILD = `v${APP_VERSION}`;
