import { create } from 'zustand'
import { Screen } from './types'
import type { AppState, Actions } from './types'
import { IMMUTABLE_DEFAULTS } from './defaults'

export const useAppStore = create<AppState & Actions>((set) => ({
  // State
  currentScreen:     Screen.Home,
  isNavigating:      false,
  activeServiceId:   null,
  navCancelled:      false,
  isMoreModalOpen:   false,
  adminUnlocked:     false,
  adminFirstBoot:    true,              // overwritten in §9 init
  adminInitComplete: false,             // H1-FIX: false until init
  storageMode:       'persistent' as const,
  services:          [...IMMUTABLE_DEFAULTS],  // mutable spread copy
  installDismissed:  false,
  isOnline:          navigator.onLine,  // NOT hardcoded
  appVersion:        import.meta.env.VITE_APP_VERSION ?? '',
  lastError:         null,

  // Actions
  setScreen:            (screen) =>  set({ currentScreen: screen }),
  setNavigating:        (v) =>       set({ isNavigating: v }),
  setNavCancelled:      (v) =>       set({ navCancelled: v }),
  setActiveServiceId:   (id) =>      set({ activeServiceId: id }),
  setMoreModalOpen:     (v) =>       set({ isMoreModalOpen: v }),
  unlockAdmin:          () =>        set({ adminUnlocked: true }),
  lockAdmin:            () =>        set({ adminUnlocked: false }),  // ONLY this effect
  setAdminFirstBoot:    (v) =>       set({ adminFirstBoot: v }),
  setAdminInitComplete: (v) =>       set({ adminInitComplete: v }),
  setStorageMode:       (mode) =>    set({ storageMode: mode }),
  setServices:          (services) => set({ services }),
  setInstallDismissed:  (v) =>       set({ installDismissed: v }),
  setOnline:            (v) =>       set({ isOnline: v }),
  setError:             (screen, message) => set({ lastError: { screen, message, timestamp: Date.now() } }),
  clearError:           () =>        set({ lastError: null }),
}))
