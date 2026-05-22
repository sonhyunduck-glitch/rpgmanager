/* =========================================================
   약관 모달 — 이용약관 및 개인정보처리방침
   ========================================================= */

/* ── 약관 내용 ── */
const TOS_SECTIONS = [
  {
    title: '제1조 (목적)',
    body: '본 약관은 LogDot(로그닷)(이하 "게임")의 이용에 관한 조건 및 절차, 이용자와 운영자 간의 권리·의무를 규정함을 목적으로 합니다.',
  },
  {
    title: '제2조 (용어의 정의)',
    body: '"이용자"란 본 약관에 동의하고 게임 계정을 생성한 자를 말합니다. "계정"이란 이용자 식별 및 서비스 이용을 위해 이메일과 비밀번호로 생성된 고유 정보를 말합니다. "닉네임"이란 게임 내에서 다른 이용자에게 표시되는 이름을 말합니다.',
  },
  {
    title: '제3조 (약관의 효력)',
    body: '본 약관은 이용자가 회원가입 시 동의함으로써 효력이 발생합니다. 운영자는 합리적인 사유가 있을 경우 약관을 변경할 수 있으며, 변경 사항은 게임 내 공지를 통해 안내합니다.',
  },
  {
    title: '제4조 (계정 관리)',
    body: '이용자는 자신의 계정 정보를 안전하게 관리할 책임이 있습니다. 계정 정보의 부정 사용으로 인한 피해에 대해 운영자는 책임을 지지 않습니다. 하나의 이메일당 하나의 계정만 생성할 수 있습니다.',
  },
  {
    title: '제5조 (서비스 이용)',
    body: '게임은 웹 브라우저를 통해 제공되며, 이용자는 게임 내 규칙에 따라 캐릭터 육성, 사냥, 거래, 길드 활동 등의 콘텐츠를 이용할 수 있습니다. 운영자는 서비스 개선, 점검 등의 사유로 사전 공지 후 서비스를 일시 중단할 수 있습니다.',
  },
  {
    title: '제6조 (이용자의 의무)',
    body: '이용자는 다음 행위를 하여서는 안 됩니다: 타인의 계정을 도용하는 행위, 게임의 정상적 운영을 방해하는 행위, 버그 또는 기술적 오류를 악용하는 행위, 다른 이용자에게 불쾌감을 주는 언행, 기타 관련 법령에 위반되는 행위.',
  },
  {
    title: '제7조 (개인정보 보호)',
    body: '운영자는 이용자의 개인정보를 게임 서비스 제공 목적으로만 수집·이용합니다. 수집 항목: 이메일 주소, 닉네임, 게임 플레이 데이터. 수집된 정보는 계정 탈퇴 시 지체 없이 파기합니다. 운영자는 관련 법령에 따라 이용자의 개인정보를 보호하며, 이용자의 동의 없이 제3자에게 제공하지 않습니다.',
  },
  {
    title: '제8조 (서비스 변경 및 종료)',
    body: '운영자는 운영상 필요에 따라 게임 콘텐츠를 추가, 변경, 삭제할 수 있습니다. 서비스 종료 시 최소 30일 전에 공지하며, 이용자의 데이터 백업 기회를 제공합니다.',
  },
  {
    title: '제9조 (면책 조항)',
    body: '운영자는 천재지변, 불가항력적 사유로 인한 서비스 중단에 대해 책임을 지지 않습니다. 이용자 간 분쟁에 대해 운영자는 개입 의무를 지지 않으나, 건전한 게임 환경 유지를 위해 조정할 수 있습니다.',
  },
  {
    title: '제10조 (기타)',
    body: '본 약관에 명시되지 않은 사항은 관련 법령 및 일반 관례에 따릅니다. 본 약관은 대한민국 법률에 따라 해석되고 적용됩니다.',
  },
];

export default function TermsModal({
  show,
  onAgree,
  onClose,
}: {
  show: boolean;
  onAgree: () => void;
  onClose: () => void;
}) {
  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 380,
          maxWidth: '92vw',
          maxHeight: '80vh',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-soft)',
          borderRadius: 'var(--r-md)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-soft)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{
            fontWeight: 700,
            fontSize: 14,
            color: 'var(--text)',
            fontFamily: 'var(--font-ui)',
          }}>
            LogDot 이용약관
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-mute)',
              fontSize: 18,
              cursor: 'pointer',
              lineHeight: 1,
              padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>

        {/* 모달 본문 */}
        <div style={{
          padding: '16px 20px',
          overflowY: 'auto',
          flex: 1,
        }}>
          <div style={{
            fontSize: 11,
            color: 'var(--text-mute)',
            marginBottom: 16,
            lineHeight: 1.5,
          }}>
            시행일: 2025년 1월 1일
          </div>

          {TOS_SECTIONS.map((sec) => (
            <div key={sec.title} style={{ marginBottom: 16 }}>
              <div style={{
                fontWeight: 700,
                fontSize: 12,
                color: 'var(--text)',
                marginBottom: 6,
                fontFamily: 'var(--font-ui)',
              }}>
                {sec.title}
              </div>
              <div style={{
                fontSize: 11,
                color: 'var(--text-dim)',
                lineHeight: 1.7,
              }}>
                {sec.body}
              </div>
            </div>
          ))}
        </div>

        {/* 모달 푸터 */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-soft)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          flexShrink: 0,
        }}>
          <button
            onClick={onAgree}
            style={{
              padding: '8px 20px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--r-sm)',
              color: 'var(--bg-canvas)',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'var(--font-ui)',
              cursor: 'pointer',
            }}
          >
            동의
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              background: 'var(--bg-sunken)',
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--r-sm)',
              color: 'var(--text-dim)',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--font-ui)',
              cursor: 'pointer',
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
