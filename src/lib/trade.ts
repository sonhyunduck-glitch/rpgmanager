/* =========================================================
   TRADE SERVICE — Supabase 기반 장비 거래소
   ========================================================= */
import { supabase } from './supabase';
import type { TradeListing, Equipment } from '../types';

/** 거래 등록 — 장비를 거래소에 올림 */
export async function createListing(
  sellerId: string,
  sellerName: string,
  sellerLevel: number,
  item: Equipment,
  price: number,
): Promise<TradeListing | null> {
  const id = `tl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const row = {
    id,
    seller_id: sellerId,
    seller_name: sellerName,
    seller_level: sellerLevel,
    item_uid: item.uid,
    item_name: item.name,
    item_type: item.type,
    item_data: item as unknown as Record<string, unknown>,
    price,
    status: 'active',
  };

  const { data, error } = await supabase
    .from('trade_listings')
    .insert(row)
    .select()
    .single();

  if (error) { console.error('[trade] createListing error', error); return null; }
  return data as unknown as TradeListing;
}

/** 활성 거래 목록 조회 */
export async function getActiveListings(
  filter?: { itemType?: string },
  limit = 50,
): Promise<TradeListing[]> {
  let q = supabase
    .from('trade_listings')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filter?.itemType) q = q.eq('item_type', filter.itemType);

  const { data, error } = await q;
  if (error) { console.error('[trade] getActiveListings error', error); return []; }
  return (data ?? []) as unknown as TradeListing[];
}

/** 내 거래 목록 (활성 + 최근 완료) */
export async function getMyListings(userId: string, limit = 30): Promise<TradeListing[]> {
  const { data, error } = await supabase
    .from('trade_listings')
    .select('*')
    .eq('seller_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) { console.error('[trade] getMyListings error', error); return []; }
  return (data ?? []) as unknown as TradeListing[];
}


/** 거래 구매 — DB 함수 호출 (원자적 골드/아이템 교환) */
export async function buyListing(
  listingId: string,
  buyerId: string,
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase
    .rpc('execute_trade', { p_listing_id: listingId, p_buyer_id: buyerId });

  if (error) {
    console.error('[trade] buyListing RPC error', error);
    return { success: false, error: error.message };
  }

  const result = data as { success?: boolean; error?: string };
  if (result?.error) return { success: false, error: result.error };
  return { success: true };
}

/** 거래 취소 — DB 함수 호출 */
export async function cancelListing(
  listingId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase
    .rpc('cancel_trade', { p_listing_id: listingId, p_user_id: userId });

  if (error) {
    console.error('[trade] cancelListing RPC error', error);
    return { success: false, error: error.message };
  }

  const result = data as { success?: boolean; error?: string };
  if (result?.error) return { success: false, error: result.error };
  return { success: true };
}

/** 해당 유저의 활성 거래 아이템 UID 목록 (인벤토리 필터링용) */
export async function getListedItemUids(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('trade_listings')
    .select('item_uid')
    .eq('seller_id', userId)
    .eq('status', 'active');

  if (error) { console.error('[trade] getListedItemUids error', error); return []; }
  return (data ?? []).map(d => d.item_uid);
}
