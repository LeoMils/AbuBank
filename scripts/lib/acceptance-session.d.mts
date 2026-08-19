// Types for the plain-JS CI/acceptance session minter (used by TS tests).
export function acceptanceSecret(): string
export function mintSessionToken(
  secret: string,
  opts?: { deviceId?: string; ttlMs?: number; now?: number },
): string
export function installNodeFetchAuth(): boolean
export function playwrightSessionCookie(
  rcUrl: string,
  opts?: { deviceId?: string },
): {
  name: string
  value: string
  domain: string
  path: string
  httpOnly: boolean
  secure: boolean
  sameSite: string
} | null
