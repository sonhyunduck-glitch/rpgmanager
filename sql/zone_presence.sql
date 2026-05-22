-- =========================================================
-- zone_presence — 존별 접속자 추적
-- user_id PK → 항상 1 row / UPSERT로 입장·이동·퇴장 처리
-- =========================================================

CREATE TABLE IF NOT EXISTS zone_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  zone_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 존별 인원 조회 최적화
CREATE INDEX IF NOT EXISTS idx_zone_presence_zone_id ON zone_presence(zone_id);

-- 오래된 row 자동 정리 (5분 이상 갱신 없으면 무시하는 쿼리 기반)
-- 추가로 1시간 이상 stale row 삭제하는 cron 가능 (선택)

-- RLS 정책
ALTER TABLE zone_presence ENABLE ROW LEVEL SECURITY;

-- 자기 자신의 row만 INSERT/UPDATE/DELETE 가능
CREATE POLICY "Users can manage own presence"
  ON zone_presence
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 모든 인증 유저가 존별 인원 수 조회 가능 (count만)
CREATE POLICY "Authenticated users can read presence"
  ON zone_presence
  FOR SELECT
  USING (auth.role() = 'authenticated');
