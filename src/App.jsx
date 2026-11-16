import { useState, useCallback } from 'react';
import { ServerPanel } from './components/ServerPanel';
import { ClientPanel } from './components/ClientPanel';
import { generateSecretKey } from './utils/totp';
import { Shield, Lock, Radio } from 'lucide-react';
import './App.css';

function App() {
  // 앱 진입 시 CSPRNG 기반 비밀 키 자동 생성
  const [secret, setSecret] = useState(() => generateSecretKey());
  const [issuer, setIssuer] = useState('PolytechSec');
  const [account, setAccount] = useState('student@polytech.ac.kr');
  const [allowTimeDrift, setAllowTimeDrift] = useState(true);
  const [currentClientOtp, setCurrentClientOtp] = useState('');

  // 새 비밀 키 생성 핸들러
  const handleRegenerateSecret = useCallback(() => {
    const newKey = generateSecretKey();
    setSecret(newKey);
  }, []);

  const handleOtpGenerated = useCallback((otp) => {
    setCurrentClientOtp(otp);
  }, []);

  return (
    <div className="studio-container">
      {/* 글로벌 상단 헤더 */}
      <header className="studio-header">
        <div className="header-top">
          <div className="header-badge-list">
            <span className="badge badge-accent">
              <Shield size={13} /> RFC 6238 Standard
            </span>
            <span className="badge badge-success">
              <Lock size={13} /> Zero-Transmission
            </span>
            <span className="badge badge-info">
              <Radio size={13} /> Web Crypto CSPRNG
            </span>
          </div>
        </div>
        <h1 className="studio-title">Zero-Transmission TOTP 체험 스튜디오</h1>
        <p className="studio-description">
          단일 화면에서 <strong>[서비스 서버(QR 발급·검증)]</strong>와 <strong>[인증기 앱(실시간 6자리 OTP)]</strong>을 나란히 비교하고,
          스마트폰 Google/MS Authenticator와 100% 실시간 동기화를 테스트합니다.
        </p>
      </header>

      {/* 좌우 2분할 스튜디오 메인 그리드 */}
      <main className="studio-main-grid">
        {/* [좌측] 서비스 서버 패널 */}
        <ServerPanel
          secret={secret}
          onRegenerateSecret={handleRegenerateSecret}
          issuer={issuer}
          setIssuer={setIssuer}
          account={account}
          setAccount={setAccount}
          allowTimeDrift={allowTimeDrift}
          setAllowTimeDrift={setAllowTimeDrift}
          currentClientOtp={currentClientOtp}
        />

        {/* [우측] 사용자 인증기 시뮬레이터 패널 */}
        <ClientPanel
          secret={secret}
          issuer={issuer}
          account={account}
          onOtpGenerated={handleOtpGenerated}
        />
      </main>

      {/* 푸터 */}
      <footer className="studio-footer">
        <p>
          모든 HMAC-SHA1 연산 및 비밀 키 생성은 브라우저 내장 <code>Web Crypto API</code>를 통해 기기 내부에서만 수행됩니다. (네트워크 요청 0건)
        </p>
      </footer>
    </div>
  );
}

export default App;
