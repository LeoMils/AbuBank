// MoreModal = overlay flag in AppState, not a screen.
// InstallGuidance = conditional bar inside Shell, not a screen.
export enum Screen {
  Home     = 'Home',
  Opening  = 'Opening',
  Offline  = 'Offline',
  Error    = 'Error',
  Admin    = 'Admin',
  AbuAI       = 'AbuAI',
  AbuWhatsApp = 'AbuWhatsApp',
  Settings    = 'Settings',
  AbuGames    = 'AbuGames',
  AbuWeather  = 'AbuWeather',
  AbuCalendar = 'AbuCalendar',
  FamilyGallery = 'FamilyGallery',
}

// Co-located with enum — used by aria-live announcer in App.tsx
export const SCREEN_LABELS: Record<Screen, string> = {
  [Screen.Home]:    'מסך הבית',
  [Screen.Opening]: 'פותחת שירות',
  [Screen.Offline]: 'אין חיבור לאינטרנט',
  [Screen.Error]:   'שגיאה',
  [Screen.Admin]:   'הגדרות',
  [Screen.AbuAI]:       'מרטיטה שואלת',
  [Screen.AbuWhatsApp]: 'הודעות למשפחה',
  [Screen.Settings]:    'הגדרות',
  [Screen.AbuGames]:    'משחקים',
  [Screen.AbuWeather]:  'מזג האוויר',
  [Screen.AbuCalendar]: 'יומן פגישות',
  [Screen.FamilyGallery]: 'אלבום משפחתי',
}

export interface ServiceConfig {
  id:       string   // non-empty
  label:    string   // non-empty, displayed to user
  url:      string   // "https://replace-me.invalid" until provided
  iconPath: string   // empty string "" is valid — triggers fallback logo
}

// noUncheckedIndexedAccess: services[N] returns ServiceConfig|undefined
// Always guard: const s = services[8]; if (!s) return null;

export type Result<T, E = string> =
  | { ok: true;  data: T }
  | { ok: false; error: E }

// Timer IDs are module-level in navigationService.ts — NOT here.
export interface AppState {
  currentScreen:     Screen
  isNavigating:      boolean
  activeServiceId:   string | null  // last tapped id · null when idle
  navCancelled:      boolean
  isMoreModalOpen:   boolean
  adminUnlocked:     boolean
  adminFirstBoot:    boolean        // true = no PIN set yet
  adminInitComplete: boolean        // H1-FIX: false until readAdminFirstBoot resolves
  storageMode:       'persistent' | 'volatile'
  services:          ServiceConfig[]
  installDismissed:  boolean
  isOnline:          boolean
  appVersion:        string
}

// appVersion: set ONCE at store creation via Vite define in initial state.
// No setAppVersion action. No setAppVersion call anywhere.

// lockAdmin(): sets adminUnlocked = false. That is its entire effect.
// lockAdmin() does NOT cancel navigation — those are independent concerns.

// H1-FIX: adminInitComplete prevents triple-tap reaching Admin UI before
// readAdminFirstBoot() resolves. Admin screen renders loading skeleton
// until adminInitComplete = true.

export interface Actions {
  setScreen:             (screen: Screen) => void
  setNavigating:         (v: boolean) => void
  setNavCancelled:       (v: boolean) => void
  setActiveServiceId:    (id: string | null) => void
  setMoreModalOpen:      (v: boolean) => void
  unlockAdmin:           () => void
  lockAdmin:             () => void
  setAdminFirstBoot:     (v: boolean) => void
  setAdminInitComplete:  (v: boolean) => void
  setStorageMode:        (mode: 'persistent' | 'volatile') => void
  setServices:           (services: ServiceConfig[]) => void
  setInstallDismissed:   (v: boolean) => void
  setOnline:             (v: boolean) => void
}
