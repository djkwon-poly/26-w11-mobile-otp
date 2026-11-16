import { useState, useEffect, useRef } from 'react';
import { 
  Smartphone, 
  Clock, 
  Copy, 
  Check, 
  ShieldCheck, 
  WifiOff, 
  Activity,
  Layers
} from 'lucide-react';
import { generateTOTP, getRemainingSeconds } from '../utils/totp';

export function ClientPanel({
  secret,
  issuer,
  account,
  onOtpGenerated
}) {
  const [otp, setOtp] = useState('------');
  const [remainingSeconds, setRemainingSeconds] = useState(30);
  const [currentStep, setCurrentStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  
  const lastStepRef = useRef(null);

  // 250ms 간격으로 타이머 및 OTP 동기화
  useEffect(() => {
    let isMounted = true;

    const tick = async () => {
      const nowMs = Date.now();
      const nowSec = Math.floor(nowMs / 1000);
      const step = Math.floor(nowSec / 30);
      const remaining = getRemainingSeconds(30);

      if (isMounted) {
        setRemainingSeconds(remaining);
        setCurrentStep(step);
        
        // 현재 시각 포맷 (HH:mm:ss)
        const date = new Date(nowMs);
        const timeFormatted = date.toLocaleTimeString('ko-KR', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        setCurrentTimeStr(timeFormatted);
      }

      // 스텝이 바뀌었거나 최초 실행 시 OTP 재계산
      if (lastStepRef.current !== step) {
        lastStepRef.current = step;
        try {
          const newOtp = await generateTOTP(secret, 0, 30);
          if (isMounted) {
            setOtp(newOtp);
            if (onOtpGenerated) {
              onOtpGenerated(newOtp);
            }
          }
        } catch (err) {
          console.error('Failed to generate OTP:', err);
        }
      }
    };

    tick();
    const interval = setInterval(tick, 250);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [secret, onOtpGenerated]);

  // OTP 번호 복사
  const handleCopyOtp = async () => {
    if (!otp || otp === '------') return;
    try {
      await navigator.clipboard.writeText(otp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = otp;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 진행률 (30초 기준 백분율)
  const progressPercent = (remainingSeconds / 30) * 100;
  const isExpiringSoon = remainingSeconds <= 5;

  return (
    <div className="panel client-panel">
      {/* 헤더 */}
      <div className="panel-header">
        <div className="panel-title-group">
          <div className="icon-wrapper client-icon">
            <Smartphone size={22} />
          </div>
          <div>
            <h2 className="panel-title">인증기 앱 (스마트폰 시뮬레이터)</h2>
            <p className="panel-subtitle">Google / MS Authenticator 연동 실시간 시뮬레이션</p>
          </div>
        </div>
        <span className="badge client-badge">클라이언트 영역</span>
      </div>

      {/* 스마트폰 목업 프레임 */}
      <div className="authenticator-card">
        {/* 앱 상단 바 */}
        <div className="auth-card-header">
          <div className="auth-account-info">
            <span className="auth-issuer-badge">{issuer || 'Service'}</span>
            <span className="auth-account-name">{account || 'user'}</span>
          </div>
          <div className="auth-clock">
            <Clock size={14} />
            <span className="font-mono">{currentTimeStr}</span>
          </div>
        </div>

        {/* 6자리 OTP 표시 영역 */}
        <div className="otp-display-container">
          <div className="otp-code-box">
            <div className={`otp-code font-mono ${isExpiringSoon ? 'expiring-text' : ''}`}>
              <span className="otp-half">{otp.slice(0, 3)}</span>
              <span className="otp-separator"> </span>
              <span className="otp-half">{otp.slice(3, 6)}</span>
            </div>
            <button
              type="button"
              className="otp-copy-btn"
              onClick={handleCopyOtp}
              title="OTP 코드 복사"
              aria-label="OTP 코드 복사"
            >
              {copied ? <Check size={18} className="text-success" /> : <Copy size={18} />}
            </button>
          </div>

          {/* 원형 / 바 형태 카운트다운 게이지 */}
          <div className="countdown-container">
            <div className="countdown-info">
              <span className="countdown-label">남은 유효 시간</span>
              <span className={`countdown-seconds font-mono ${isExpiringSoon ? 'expiring-text' : ''}`}>
                {remainingSeconds}초
              </span>
            </div>
            <div className="progress-bar-track">
              <div
                className={`progress-bar-fill ${isExpiringSoon ? 'progress-expiring' : ''}`}
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* 알고리즘 동작 현황 */}
        <div className="algo-meta-grid">
          <div className="meta-item">
            <span className="meta-label">시간 주기</span>
            <span className="meta-value font-mono">30초 (T0=0)</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">현재 스텝 카운터</span>
            <span className="meta-value font-mono">{currentStep}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">해시 알고리즘</span>
            <span className="meta-value font-mono">HMAC-SHA1</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">자릿수</span>
            <span className="meta-value font-mono">6 Digits</span>
          </div>
        </div>
      </div>

      {/* 보안 원칙 검증 카드 */}
      <div className="security-check-card">
        <h3 className="security-title">
          <ShieldCheck size={18} className="text-success" />
          핵심 보안 원칙 준수 확인
        </h3>
        
        <div className="security-item">
          <div className="sec-icon-box">
            <WifiOff size={16} />
          </div>
          <div className="sec-desc">
            <strong>Zero-Transmission 원칙</strong>
            <p>비밀 키 및 OTP 번호는 서버로 전송되지 않으며, 오직 브라우저 <code>crypto.subtle</code>에서만 연산됩니다.</p>
          </div>
        </div>

        <div className="security-item">
          <div className="sec-icon-box">
            <Layers size={16} />
          </div>
          <div className="sec-desc">
            <strong>RFC 6238 64-bit Big-Endian 연산</strong>
            <p><code>DataView.setBigUint64</code>로 8바이트 카운터를 조합하여 스마트폰 Authenticator 앱과 100% 일치합니다.</p>
          </div>
        </div>

        <div className="security-item">
          <div className="sec-icon-box">
            <Activity size={16} />
          </div>
          <div className="sec-desc">
            <strong>CSPRNG 안전 키 생성</strong>
            <p>취약한 <code>Math.random()</code> 대신 <code>window.crypto.getRandomValues()</code>로 160-bit 엔트로피를 보장합니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
