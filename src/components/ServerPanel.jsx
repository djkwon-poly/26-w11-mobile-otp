import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Server, 
  Key, 
  RefreshCw, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  XCircle, 
  ArrowRight
} from 'lucide-react';
import { verifyTOTP } from '../utils/totp';

export function ServerPanel({
  secret,
  onRegenerateSecret,
  issuer,
  setIssuer,
  account,
  setAccount,
  allowTimeDrift,
  setAllowTimeDrift,
  currentClientOtp
}) {
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inputOtp, setInputOtp] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // otpauth URI 생성
  const encodedIssuer = encodeURIComponent(issuer.trim() || 'Service');
  const encodedAccount = encodeURIComponent(account.trim() || 'user');
  const otpauthUri = `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}`;

  // 비밀 키 복사
  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 복사 권한 오류 fallback
      const textArea = document.createElement('textarea');
      textArea.value = secret;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // OTP 검증
  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    if (!inputOtp || inputOtp.length !== 6) return;

    setIsVerifying(true);
    try {
      const result = await verifyTOTP(inputOtp, secret, allowTimeDrift);
      setVerificationResult(result);
    } catch (err) {
      setVerificationResult({ valid: false, reason: err.message });
    } finally {
      setIsVerifying(false);
    }
  };

  // 시뮬레이터 번호 자동 채우기 버튼
  const handleFillSimulatorOtp = () => {
    if (currentClientOtp) {
      setInputOtp(currentClientOtp);
      setVerificationResult(null);
    }
  };

  return (
    <div className="panel server-panel">
      {/* 헤더 */}
      <div className="panel-header">
        <div className="panel-title-group">
          <div className="icon-wrapper server-icon">
            <Server size={22} />
          </div>
          <div>
            <h2 className="panel-title">서비스 서버 (인증 제공자)</h2>
            <p className="panel-subtitle">비밀 키 발급, QR 코드 등록 및 OTP 검증</p>
          </div>
        </div>
        <span className="badge server-badge">서버 영역</span>
      </div>

      {/* 1. 발급자 & 계정명 설정 */}
      <div className="section-card">
        <div className="card-header">
          <span className="step-tag">Step 1</span>
          <span className="card-title">서비스 및 계정 설정</span>
        </div>
        <div className="input-grid">
          <div className="input-field">
            <label htmlFor="issuer-input">발급자 (Issuer)</label>
            <input
              id="issuer-input"
              type="text"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="예: PolytechSec"
              maxLength={30}
            />
          </div>
          <div className="input-field">
            <label htmlFor="account-input">계정명 (Account)</label>
            <input
              id="account-input"
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="예: student@polytech.ac.kr"
              maxLength={50}
            />
          </div>
        </div>
      </div>

      {/* 2. Base32 비밀 키 관리 */}
      <div className="section-card">
        <div className="card-header flex-between">
          <div className="flex-row">
            <span className="step-tag">Step 2</span>
            <span className="card-title">CSPRNG 표준 비밀 키 (Base32)</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onRegenerateSecret}
            title="새 비밀 키를 생성합니다"
          >
            <RefreshCw size={14} />
            <span>새 비밀 키 발급</span>
          </button>
        </div>

        <div className="secret-display-box">
          <Key size={16} className="secret-icon" />
          <div className="secret-text-wrapper">
            <span className="secret-text font-mono">
              {showSecret ? secret : '•'.repeat(32)}
            </span>
          </div>
          <div className="secret-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setShowSecret(!showSecret)}
              title={showSecret ? '비밀 키 숨기기' : '비밀 키 보기'}
              aria-label={showSecret ? '비밀 키 숨기기' : '비밀 키 보기'}
            >
              {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={handleCopySecret}
              title="비밀 키 복사"
              aria-label="비밀 키 복사"
            >
              {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
            </button>
          </div>
        </div>
        <p className="field-hint">
          * <code>window.crypto.getRandomValues()</code>로 생성된 160-bit 암호학적 안전 난수(CSPRNG)입니다.
        </p>
      </div>

      {/* 3. 표준 QR 코드 연동 */}
      <div className="section-card qr-card">
        <div className="card-header">
          <span className="step-tag">Step 3</span>
          <span className="card-title">스마트폰 인증기 등록 (RFC 6238 QR)</span>
        </div>
        <div className="qr-container">
          <div className="qr-wrapper">
            <QRCodeSVG
              value={otpauthUri}
              size={180}
              level="M"
              includeMargin={true}
            />
          </div>
          <div className="qr-info">
            <p className="qr-guide-text">
              스마트폰의 <strong>Google Authenticator</strong> 또는 <strong>Microsoft Authenticator</strong> 앱으로 스캔하면 실시간 OTP가 자동 연동됩니다.
            </p>
            <div className="uri-preview-box">
              <span className="uri-label">URI 규격:</span>
              <code className="uri-text">{otpauthUri}</code>
            </div>
          </div>
        </div>
      </div>

      {/* 4. 6자리 OTP 코드 검증 */}
      <div className="section-card verify-card">
        <div className="card-header flex-between">
          <div className="flex-row">
            <span className="step-tag">Step 4</span>
            <span className="card-title">6자리 OTP 코드 검증</span>
          </div>
          {/* 시간 오차 토글 */}
          <label className="drift-toggle-label" title="기기간 시계 오차(±30초)를 보정하기 위해 직전/직후 스텝 코드도 통과시킵니다.">
            <input
              type="checkbox"
              checked={allowTimeDrift}
              onChange={(e) => setAllowTimeDrift(e.target.checked)}
            />
            <span className="toggle-custom"></span>
            <span className="toggle-text">±1 스텝(±30초) 오차 허용</span>
          </label>
        </div>

        <form onSubmit={handleVerify} className="verify-form">
          <div className="verify-input-group">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={inputOtp}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setInputOtp(val);
                if (verificationResult) setVerificationResult(null);
              }}
              placeholder="000000"
              className="otp-verify-input font-mono"
            />
            <button
              type="submit"
              className="btn btn-primary verify-btn"
              disabled={inputOtp.length !== 6 || isVerifying}
            >
              {isVerifying ? '검증 중...' : '인증하기'}
            </button>
          </div>

          {currentClientOtp && (
            <div className="fill-helper-row">
              <button
                type="button"
                className="btn-text-link"
                onClick={handleFillSimulatorOtp}
              >
                우측 시뮬레이터 번호({currentClientOtp}) 자동 입력 <ArrowRight size={13} />
              </button>
            </div>
          )}
        </form>

        {/* 검증 결과 배너 */}
        {verificationResult && (
          <div className={`verification-banner ${verificationResult.valid ? 'success' : 'failure'}`}>
            <div className="banner-icon">
              {verificationResult.valid ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
            </div>
            <div className="banner-content">
              <div className="banner-title">
                {verificationResult.valid ? '인증 성공: 유효한 OTP 코드입니다' : '인증 실패: 코드가 일치하지 않습니다'}
              </div>
              <div className="banner-desc">
                {verificationResult.valid ? (
                  <span>
                    서버 검증 완료 (
                    {verificationResult.delta === 0 ? '현재 30초 구간과 정확히 일치' :
                     verificationResult.delta === -1 ? '직전(-30초) 스텝 코드로 보정 인정' : '직후(+30초) 스텝 코드로 보정 인정'}
                    )
                  </span>
                ) : (
                  <span>
                    스마트폰 시계 동기화 여부나 비밀 키 일치 여부를 확인해 주세요.
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
