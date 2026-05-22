/* =========================================================
   PROFILE MODAL — 다른 유저 프로필 조회 오버레이
   이름 클릭 → 장비/스탯/길드 확인
   ========================================================= */
import { useEffect, useState } from 'react';
import { useGameStore, equipDisplayName } from '../../store/gameStore';
import { getPlayerProfile, getPlayerEquipment } from '../../lib/profile';
import type { PlayerProfile, PlayerEquipment } from '../../lib/profile';
import type { Equipment, EquipType } from '../../types';
import { LABEL, STAT_VALUE } from '../../styles/shared';
import { timeAgo, dateFmt } from '../../lib/utils';

/* ── 장비 슬롯 순서 ── */
const EQUIP_SLOTS: { type: EquipType; label: string }[] = [
  { type: 'weapon', label: '무기' },
  { type: 'tshirt', label: '티셔츠' },
  { type: 'helmet', label: '투구' },
  { type: 'armor', label: '갑옷' },
  { type: 'cloak', label: '망토' },
  { type: 'gloves', label: '장갑' },
  { type: 'boots', label: '부츠' },
  { type: 'shield', label: '방패' },
  { type: 'necklace', label: '목걸이' },
  { type: 'ring', label: '반지' },
  { type: 'belt', label: '벨트' },
];


export default function ProfileModal() {
  const viewingProfileId = useGameStore(s => s.viewingProfileId);
  const closeProfile = useGameStore(s => s.closeProfile);
  const myId = useGameStore(s => s.authUserId);

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [equip, setEquip] = useState<PlayerEquipment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!viewingProfileId) return;
    setLoading(true);
    setProfile(null);
    setEquip(null);

    Promise.all([
      getPlayerProfile(viewingProfileId),
      getPlayerEquipment(viewingProfileId),
    ]).then(([p, e]) => {
      setProfile(p);
      setEquip(e);
      setLoading(false);
    }).catch((err) => {
      console.error('[ProfileModal] load error:', err);
      setLoading(false);
    });
  }, [viewingProfileId]);

  if (!viewingProfileId) return null;

  const isMe = viewingProfileId === myId;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={closeProfile}
    >
      <div
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-soft)',
          borderRadius: 'var(--r-md)',
          padding: 'var(--s-4)',
          width: 360, maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
          gap: 'var(--s-3)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div style={{
            textAlign: 'center', padding: 'var(--s-6)',
            color: 'var(--text-mute)', fontSize: 11,
          }}>
            Loading...
          </div>
        ) : !profile ? (
          <div style={{
            textAlign: 'center', padding: 'var(--s-6)',
            color: 'var(--text-mute)', fontSize: 11,
          }}>
            프로필을 찾을 수 없습니다.
          </div>
        ) : (
          <>
            {/* ── 헤더: 이름 + 레벨 + 칭호 ── */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
                <span style={{
                  fontSize: 16, fontWeight: 700,
                  color: isMe ? 'var(--accent)' : 'var(--info)',
                  fontFamily: 'var(--font-display)',
                }}>
                  {profile.name}
                </span>
                <span style={{
                  ...LABEL, fontSize: 10, marginBottom: 0,
                  color: 'var(--text-dim)',
                }}>
                  Lv.{profile.level}
                </span>
              </div>
              {profile.title && (
                <div style={{
                  fontSize: 9, color: 'var(--accent)',
                  fontFamily: 'var(--font-mono)', marginTop: 2,
                }}>
                  {profile.title}
                </div>
              )}
              <div style={{
                fontSize: 8, color: 'var(--text-mute)',
                fontFamily: 'var(--font-mono)', marginTop: 4,
                display: 'flex', gap: 8,
              }}>
                {profile.guild_name && (
                  <span>길드: <span style={{ color: 'var(--info)' }}>{profile.guild_name}</span></span>
                )}
                <span>접속: {timeAgo(profile.last_active_at)}</span>
                <span>가입: {dateFmt(profile.created_at)}</span>
              </div>
            </div>

            {/* ── 스탯 ── */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
              gap: 'var(--s-1)',
            }}>
              <StatBox label="STR" value={profile.stat_str} color="var(--danger)" />
              <StatBox label="DEX" value={profile.stat_dex} color="var(--success)" />
              <StatBox label="CON" value={profile.stat_con} color="var(--info)" />
              <StatBox label="WIS" value={profile.stat_wis} color="var(--warning)" />
            </div>

            {/* ── 장비 ── */}
            <div>
              <div style={{ ...LABEL, fontSize: 8, marginBottom: 'var(--s-1)' }}>
                Equipment
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                {EQUIP_SLOTS.map(slot => {
                  const item = equip?.equipped.find(e => e.type === slot.type);
                  return (
                    <EquipSlotRow key={slot.type} label={slot.label} item={item ?? null} />
                  );
                })}
              </div>
              {equip && (
                <div style={{
                  fontSize: 8, color: 'var(--text-mute)',
                  fontFamily: 'var(--font-mono)', marginTop: 'var(--s-1)',
                }}>
                  인벤토리: {equip.inventoryCount}개
                </div>
              )}
            </div>

            {/* ── 닫기 버튼 ── */}
            <button
              onClick={closeProfile}
              style={{
                padding: '6px 0',
                border: '1px solid var(--border-soft)',
                borderRadius: 'var(--r-sm)',
                background: 'var(--bg-sunken)',
                color: 'var(--text-mute)',
                fontSize: 10, fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
              }}
            >
              닫기
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── 스탯 박스 ── */
function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'var(--bg-sunken)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--r-sm)',
      padding: '4px',
      textAlign: 'center',
    }}>
      <div style={{ ...LABEL, fontSize: 7, marginBottom: 1 }}>{label}</div>
      <div style={{ ...STAT_VALUE, fontSize: 14, color }}>{value}</div>
    </div>
  );
}

/* ── 장비 슬롯 행 ── */
function EquipSlotRow({ label, item }: { label: string; item: Equipment | null }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '3px 6px',
      borderRadius: 'var(--r-xs)',
      background: item ? 'color-mix(in oklch, var(--accent) 4%, transparent)' : 'transparent',
    }}>
      <span style={{
        ...LABEL, fontSize: 7, marginBottom: 0,
        minWidth: 36, textAlign: 'right',
        color: item ? 'var(--text-mute)' : 'var(--border-soft)',
      }}>
        {label}
      </span>
      {item ? (
        <>
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: item.enhanceLevel >= 7 ? 'var(--warning)'
              : item.enhanceLevel > 0 ? 'var(--accent)'
              : 'var(--text)',
            fontFamily: 'var(--font-display)',
            flex: 1, minWidth: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {equipDisplayName(item)}
          </span>
          <span style={{
            fontSize: 8, color: 'var(--text-mute)',
            fontFamily: 'var(--font-mono)', flexShrink: 0,
          }}>
            {item.baseAtk > 0 ? `ATK ${item.baseAtk}` : `AC ${item.baseDef}`}
          </span>
        </>
      ) : (
        <span style={{
          fontSize: 9, fontStyle: 'italic',
          color: 'var(--border-soft)',
        }}>
          비어있음
        </span>
      )}
    </div>
  );
}
