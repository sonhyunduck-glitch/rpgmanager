/* =========================================================
   AUTH — Supabase 인증 래퍼
   ========================================================= */
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

/** 이메일 회원가입 (닉네임/프로필은 CharacterCreateScreen에서 처리) */
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) return { error };
  if (!data.user) return { error: { message: '회원가입 실패' } };
  return { data: data.user, error: null };
}

/** 이메일 로그인 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error };
  return { data: data.user, error: null };
}

/** 로그아웃 */
export async function signOut() {
  await supabase.auth.signOut();
}

/** 현재 유저 가져오기 */
export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** 세션 변경 구독 */
export function onAuthStateChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}
