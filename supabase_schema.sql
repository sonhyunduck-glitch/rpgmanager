-- =========================================================
-- RPG Manager — Supabase DB Schema
-- Supabase Dashboard → SQL Editor 에서 실행
-- =========================================================

-- 1. 유저 프로필 (auth.users 와 1:1)
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT UNIQUE NOT NULL,
  level       INT DEFAULT 1,
  exp         BIGINT DEFAULT 0,
  gold        BIGINT DEFAULT 0,
  title       TEXT DEFAULT '초보 모험가',
  current_hp  INT DEFAULT 30,
  max_hp      INT DEFAULT 30,
  stat_str    INT DEFAULT 0,
  stat_dex    INT DEFAULT 0,
  stat_con    INT DEFAULT 0,
  stat_wis    INT DEFAULT 0,
  last_zone_id TEXT,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at  TIMESTAMPTZ DEFAULT now(),
  guild_id    TEXT,

  -- 포션/설정
  selected_potion TEXT DEFAULT 'red_potion',
  potion_auto_use BOOLEAN DEFAULT true,
  potion_auto_threshold INTEGER DEFAULT 50,
  potion_auto_buy BOOLEAN DEFAULT true
);

-- 2. 아이템 (인벤토리 + 장착)
CREATE TABLE IF NOT EXISTS items (
  uid          TEXT PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_id  TEXT NOT NULL,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL,              -- weapon, armor, helmet, etc.
  base_atk     INT DEFAULT 0,
  base_atk_large INT DEFAULT 0,
  base_def     INT DEFAULT 0,
  enhance_level INT DEFAULT 0,
  safe_enchant INT DEFAULT 4,              -- 안전 강화 수치 (무기 6, 방어구 4)
  max_enhance  INT DEFAULT 0,
  is_two_handed BOOLEAN DEFAULT false,     -- 양손 무기 여부 (L1J is_twohanded)
  bonuses      JSONB DEFAULT '{}'::jsonb,
  bonus_effects JSONB DEFAULT '[]'::jsonb,
  sell_price   INT DEFAULT 0,
  weight       INT DEFAULT 0,             -- 무게 (L1J 1/10 단위)
  equipped     BOOLEAN DEFAULT false,      -- true = 장착중
  equipped_slot TEXT,                      -- 장착 슬롯 (weapon, armor, etc.)
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 3. 재료 보유량
CREATE TABLE IF NOT EXISTS materials (
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  material_id  TEXT NOT NULL,
  quantity     INT DEFAULT 0,
  PRIMARY KEY (user_id, material_id)
);

-- 4. 포션 보유량
CREATE TABLE IF NOT EXISTS potions (
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  potion_id    TEXT NOT NULL,
  quantity     INT DEFAULT 0,
  PRIMARY KEY (user_id, potion_id)
);

-- 5. 거래 로그
CREATE TABLE IF NOT EXISTS trade_logs (
  id           TEXT PRIMARY KEY,
  user_a       UUID NOT NULL,
  user_b       UUID NOT NULL,
  items_a      JSONB DEFAULT '[]'::jsonb,  -- A가 준 아이템 목록
  items_b      JSONB DEFAULT '[]'::jsonb,  -- B가 준 아이템 목록
  gold_a       INT DEFAULT 0,              -- A가 준 골드
  gold_b       INT DEFAULT 0,              -- B가 준 골드
  flag         TEXT DEFAULT 'normal',      -- normal / suspicious / blocked
  reported_by  TEXT[] DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 6. 길드
CREATE TABLE IF NOT EXISTS guilds (
  id           TEXT PRIMARY KEY,
  name         TEXT UNIQUE NOT NULL,
  leader_id    UUID NOT NULL,
  level        INT DEFAULT 1,
  exp          BIGINT DEFAULT 0,
  max_members  INT DEFAULT 20,
  notice       TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 7. 길드 멤버
CREATE TABLE IF NOT EXISTS guild_members (
  guild_id     TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role         TEXT DEFAULT 'member',      -- leader / officer / member
  joined_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (guild_id, user_id)
);

-- 8. 채팅 로그 (최근 N건만 유지)
CREATE TABLE IF NOT EXISTS chat_logs (
  id           BIGSERIAL PRIMARY KEY,
  channel      TEXT NOT NULL,              -- global / guild:{id} / dm:{id}
  user_id      UUID NOT NULL,
  user_name    TEXT NOT NULL,
  user_level   INT DEFAULT 1,
  guild_name   TEXT,
  text         TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- =========================================================
-- INDEXES
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_equipped ON items(user_id, equipped) WHERE equipped = true;
CREATE INDEX IF NOT EXISTS idx_materials_user ON materials(user_id);
CREATE INDEX IF NOT EXISTS idx_potions_user ON potions(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_pair ON trade_logs (
  LEAST(user_a::text, user_b::text),
  GREATEST(user_a::text, user_b::text)
);
CREATE INDEX IF NOT EXISTS idx_trade_time ON trade_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_channel ON chat_logs(channel, created_at);
CREATE INDEX IF NOT EXISTS idx_guild_members_user ON guild_members(user_id);

-- =========================================================
-- ROW LEVEL SECURITY (RLS)
-- =========================================================

-- profiles: 누구나 읽기 가능 (프로필 공개), 본인만 수정
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- items: 누구나 읽기 가능 (장비 공개), 본인만 수정
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items_select" ON items FOR SELECT USING (true);
CREATE POLICY "items_insert" ON items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "items_update" ON items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "items_delete" ON items FOR DELETE USING (auth.uid() = user_id);

-- materials: 본인만 접근
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "materials_select" ON materials FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "materials_insert" ON materials FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "materials_update" ON materials FOR UPDATE USING (auth.uid() = user_id);

-- potions: 본인만 접근
ALTER TABLE potions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "potions_select" ON potions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "potions_insert" ON potions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "potions_update" ON potions FOR UPDATE USING (auth.uid() = user_id);

-- trade_logs: 누구나 읽기 (감시 시스템)
ALTER TABLE trade_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trades_select" ON trade_logs FOR SELECT USING (true);
CREATE POLICY "trades_insert" ON trade_logs FOR INSERT WITH CHECK (
  auth.uid() = user_a OR auth.uid() = user_b
);

-- guilds: 누구나 읽기
ALTER TABLE guilds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guilds_select" ON guilds FOR SELECT USING (true);
CREATE POLICY "guilds_insert" ON guilds FOR INSERT WITH CHECK (auth.uid() = leader_id);
CREATE POLICY "guilds_update" ON guilds FOR UPDATE USING (auth.uid() = leader_id);

-- guild_members: 누구나 읽기
ALTER TABLE guild_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gm_select" ON guild_members FOR SELECT USING (true);
CREATE POLICY "gm_insert" ON guild_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gm_delete" ON guild_members FOR DELETE USING (auth.uid() = user_id);

-- chat_logs: 누구나 읽기, 본인만 작성
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_select" ON chat_logs FOR SELECT USING (true);
CREATE POLICY "chat_insert" ON chat_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- 9. 거래소 (장비 거래 등록)
-- =========================================================
CREATE TABLE IF NOT EXISTS trade_listings (
  id           TEXT PRIMARY KEY,
  seller_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_name  TEXT NOT NULL,
  seller_level INT DEFAULT 1,
  item_uid     TEXT NOT NULL,              -- items.uid
  item_name    TEXT NOT NULL,
  item_type    TEXT NOT NULL,              -- weapon, armor, etc.
  item_data    JSONB NOT NULL,             -- Equipment 전체 객체
  price        BIGINT NOT NULL,
  status       TEXT DEFAULT 'active',      -- active | sold | cancelled
  buyer_id     UUID,
  buyer_name   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trade_listings_status ON trade_listings(status, created_at);
CREATE INDEX IF NOT EXISTS idx_trade_listings_seller ON trade_listings(seller_id);

-- trade_listings RLS: 누구나 읽기, 본인만 등록
ALTER TABLE trade_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tl_select" ON trade_listings FOR SELECT USING (true);
CREATE POLICY "tl_insert" ON trade_listings FOR INSERT WITH CHECK (auth.uid() = seller_id);

-- =========================================================
-- 거래 실행 함수 (원자적: 골드 교환 + 아이템 이전)
-- =========================================================
CREATE OR REPLACE FUNCTION execute_trade(p_listing_id TEXT, p_buyer_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_listing RECORD;
  v_buyer   RECORD;
BEGIN
  -- 거래 잠금
  SELECT * INTO v_listing FROM trade_listings
  WHERE id = p_listing_id AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"error":"not_found"}'::JSONB; END IF;

  -- 본인 구매 차단
  IF v_listing.seller_id = p_buyer_id THEN RETURN '{"error":"own_listing"}'::JSONB; END IF;

  -- 구매자 골드 확인
  SELECT * INTO v_buyer FROM profiles WHERE id = p_buyer_id FOR UPDATE;
  IF v_buyer.gold < v_listing.price THEN RETURN '{"error":"insufficient_gold"}'::JSONB; END IF;

  -- 골드 이전
  UPDATE profiles SET gold = gold - v_listing.price WHERE id = p_buyer_id;
  UPDATE profiles SET gold = gold + v_listing.price WHERE id = v_listing.seller_id;

  -- 아이템 소유권 이전
  UPDATE items SET user_id = p_buyer_id, equipped = false, equipped_slot = null
  WHERE uid = v_listing.item_uid;

  -- 거래 완료 처리
  UPDATE trade_listings SET
    status = 'sold',
    buyer_id = p_buyer_id,
    buyer_name = v_buyer.name,
    completed_at = now()
  WHERE id = p_listing_id;

  -- 거래 로그 기록
  INSERT INTO trade_logs (id, user_a, user_b, items_a, gold_b, created_at)
  VALUES (
    'tr_' || gen_random_uuid()::text,
    v_listing.seller_id, p_buyer_id,
    jsonb_build_array(jsonb_build_object(
      'name', v_listing.item_name, 'uid', v_listing.item_uid, 'type', v_listing.item_type
    )),
    v_listing.price,
    now()
  );

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- 거래 취소 함수
-- =========================================================
CREATE OR REPLACE FUNCTION cancel_trade(p_listing_id TEXT, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_listing RECORD;
BEGIN
  SELECT * INTO v_listing FROM trade_listings
  WHERE id = p_listing_id AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"error":"not_found"}'::JSONB; END IF;
  IF v_listing.seller_id != p_user_id THEN RETURN '{"error":"not_owner"}'::JSONB; END IF;

  UPDATE trade_listings SET status = 'cancelled', completed_at = now()
  WHERE id = p_listing_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- Realtime — chat_logs 테이블 실시간 구독 활성화
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE chat_logs;

-- =========================================================
-- 30일 이상 오래된 채팅 자동 삭제 함수
-- =========================================================
CREATE OR REPLACE FUNCTION cleanup_old_chats()
RETURNS void AS $$
BEGIN
  DELETE FROM chat_logs WHERE created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
