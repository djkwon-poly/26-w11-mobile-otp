/**
 * RFC 6238 Time-Based One-Time Password (TOTP) 순수 모듈
 * 
 * 보안 원칙 준수:
 * 1. CSPRNG: window.crypto.getRandomValues()만 사용 (Math.random 사용 금지)
 * 2. Zero-Transmission: 브라우저 내장 Web Crypto API (crypto.subtle)로만 연산
 * 3. 64-bit Big-Endian 카운터: DataView.prototype.setBigUint64(0, BigInt(counter), false) 필수
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Uint8Array 바이트 배열을 RFC 4648 Base32 문자열로 인코딩합니다.
 * @param {Uint8Array} bytes 
 * @returns {string}
 */
export function encodeBase32(bytes) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * RFC 4648 Base32 문자열을 Uint8Array 바이트 배열로 디코딩합니다.
 * 공백 제거, 대문자 변환, 패딩('=') 처리를 지원합니다.
 * @param {string} base32Str 
 * @returns {Uint8Array}
 */
export function decodeBase32(base32Str) {
  const cleanInput = base32Str.toUpperCase().replace(/[\s=]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < cleanInput.length; i++) {
    const char = cleanInput[i];
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid Base32 character: ${char}`);
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * CSPRNG(window.crypto.getRandomValues) 기반 160-bit (20바이트) 난수를 생성하여
 * 32자리 RFC 4648 Base32 비밀 키 문자열을 반환합니다.
 * @returns {string} 32자리 Base32 비밀 키
 */
export function generateSecretKey() {
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
  const bytes = new Uint8Array(20);
  cryptoObj.getRandomValues(bytes);
  return encodeBase32(bytes);
}

/**
 * RFC 6238 표준에 따라 지정된 시간 오차 스텝의 6자리 TOTP 코드를 계산합니다.
 * 
 * @param {string} secret Base32 인코딩된 비밀 키
 * @param {number} stepOffset 시간 스텝 오프셋 (기본값: 0, -1: 이전 30초, +1: 다음 30초)
 * @param {number} timeStep 시간 주기 (기본값: 30초)
 * @returns {Promise<string>} 6자리 숫자 문자열
 */
export async function generateTOTP(secret, stepOffset = 0, timeStep = 30) {
  if (!secret) return '';

  const keyBytes = decodeBase32(secret);
  const now = Math.floor(Date.now() / 1000);
  const currentStep = Math.floor(now / timeStep);
  const counter = BigInt(currentStep + stepOffset);

  // RFC 6238: 8바이트 (64비트) Big-Endian 정수 카운터 버퍼 생성
  const counterBuffer = new ArrayBuffer(8);
  const view = new DataView(counterBuffer);
  view.setBigUint64(0, counter, false); // false = Big-Endian

  const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;

  // Web Crypto API HMAC-SHA1 키 임포트
  const cryptoKey = await cryptoObj.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign']
  );

  // HMAC-SHA1 서명 연산 (외부 전송 없이 브라우저 내부에서 수행)
  const signature = await cryptoObj.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hash = new Uint8Array(signature);

  // 동적 절단 (Dynamic Truncation)
  const offset = hash[19] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  // 6자리 십진수 코드 생성
  const otp = (binary % 1000000).toString().padStart(6, '0');
  return otp;
}

/**
 * 클라이언트가 제공한 6자리 OTP 코드를 검증합니다.
 * 
 * @param {string} token 사용자가 입력한 6자리 코드
 * @param {string} secret Base32 인코딩된 비밀 키
 * @param {boolean} allowTimeDrift ±1 스텝(이전/현재/다음 30초) 허용 여부
 * @param {number} timeStep 주기 (기본값: 30초)
 * @returns {Promise<{ valid: boolean, delta?: number, reason?: string }>}
 */
export async function verifyTOTP(token, secret, allowTimeDrift = true, timeStep = 30) {
  const cleanToken = (token || '').trim();
  if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
    return { valid: false, reason: 'INVALID_FORMAT' };
  }

  const offsets = allowTimeDrift ? [0, -1, 1] : [0];
  for (const offset of offsets) {
    const expectedOtp = await generateTOTP(secret, offset, timeStep);
    if (cleanToken === expectedOtp) {
      return { valid: true, delta: offset };
    }
  }

  return { valid: false, reason: 'MISMATCH' };
}

/**
 * 현재 30초 주기에서 남은 시간(초)을 반환합니다.
 * @param {number} timeStep 
 * @returns {number} 1 ~ timeStep 사이의 정수
 */
export function getRemainingSeconds(timeStep = 30) {
  const now = Math.floor(Date.now() / 1000);
  const remaining = timeStep - (now % timeStep);
  return remaining === 0 ? timeStep : remaining;
}
