import { describe, it, expect } from 'vitest'
import { isIOS, shouldUseWebSpeechPrimary, LISTEN_WATCHDOG_MS } from './sttStrategy'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPAD_OS13 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const DESKTOP_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'

describe('sttStrategy — iOS uses Whisper primary (not the flaky Web Speech)', () => {
  it('detects iPhone as iOS', () => {
    expect(isIOS(IPHONE)).toBe(true)
  })
  it('detects iPadOS 13+ (masquerades as Macintosh, touch-capable)', () => {
    expect(isIOS(IPAD_OS13, 'MacIntel', 5)).toBe(true)
    // a real desktop Mac (no touch) is NOT iOS
    expect(isIOS(IPAD_OS13, 'MacIntel', 0)).toBe(false)
  })
  it('desktop and Android are not iOS', () => {
    expect(isIOS(DESKTOP_CHROME)).toBe(false)
    expect(isIOS(ANDROID)).toBe(false)
  })

  it('Web Speech is NOT primary on iOS (→ Whisper), but IS primary elsewhere', () => {
    expect(shouldUseWebSpeechPrimary(IPHONE)).toBe(false)
    expect(shouldUseWebSpeechPrimary(IPAD_OS13, 'MacIntel', 5)).toBe(false)
    expect(shouldUseWebSpeechPrimary(DESKTOP_CHROME)).toBe(true)
    expect(shouldUseWebSpeechPrimary(ANDROID)).toBe(true)
  })

  it('the listening watchdog is bounded (never Infinity)', () => {
    expect(LISTEN_WATCHDOG_MS).toBeGreaterThan(0)
    expect(Number.isFinite(LISTEN_WATCHDOG_MS)).toBe(true)
    expect(LISTEN_WATCHDOG_MS).toBeLessThanOrEqual(15000)
  })
})
