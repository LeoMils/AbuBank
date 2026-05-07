/*
 * AbuBank — single source of truth for the 9 launcher services.
 *
 * CONTRACT
 * --------
 * 1. This file is the ONLY canonical source for the launcher services.
 *    `src/screens/Home/data.ts` and `src/state/defaults.ts` derive from this
 *    module. Do not duplicate the list anywhere else (no Settings/Admin/
 *    storage shadow copy).
 *
 * 2. Ids must remain compatible with the IndexedDB persisted shape
 *    (`abu-bank-db.services`, keyed by id). Existing local user data therefore
 *    round-trips with no migration. Examples of canonical ids:
 *    `postalbank`, `water-ks`, `arnona-ks`, `hot-mobile`.
 *
 * 3. Visible order is launcher order (top-left → bottom-right of the 3×3
 *    grid). The visible order is the canonical order; do not reorder for
 *    storage or any other reason.
 *
 * 4. Every entry in `LAUNCHER_SERVICES` is a normal launcher tile — there is
 *    NO "more" / overflow / 9th-special slot. The 9th service is exactly as
 *    important as the 1st. Do not add `services[8]`-style index logic.
 *
 * 5. URLs are external entry points only. AbuBank does NOT autofill, store,
 *    transmit, or remember any third-party credentials, passwords, or login
 *    tokens. Adding any such field here is forbidden.
 */

export type LauncherServiceId =
  | 'mizrahi'
  | 'postalbank'
  | 'max'
  | 'water-ks'
  | 'iec'
  | 'arnona-ks'
  | 'hot-mobile'
  | 'partner'
  | 'yes'

export interface LauncherService {
  /** Stable id; matches IndexedDB persisted shape. */
  id: LauncherServiceId
  /** Hebrew title shown under the bubble in the launcher. */
  label: string
  /** External service URL the launcher navigates to (same-tab). */
  url: string
  /** Path under /public to the official service logo. */
  logo: string
  /** Brand accent colour used by the launcher gradient. */
  color: string
  /** Background colour used by older fallback logo rendering. */
  bgColor: string
}

export const LAUNCHER_SERVICES: readonly LauncherService[] = Object.freeze([
  { id: 'mizrahi',    label: 'מזרחי טפחות', url: 'https://www.mizrahi-tefahot.co.il/login/',  color: '#f97316', logo: '/logos/mizrahi.png',    bgColor: '#fff'    },
  { id: 'postalbank', label: 'דואר ישראל',  url: 'https://www.postalfinance.co.il/',          color: '#3b82f6', logo: '/logos/postalbank.png', bgColor: '#fff'    },
  { id: 'max',        label: 'MAX',          url: 'https://www.max.co.il/login',               color: '#a855f7', logo: '/logos/max.png',        bgColor: '#1a2f6b' },
  { id: 'water-ks',   label: 'מפעל המים',   url: 'https://www.city4u.co.il/water/kfar-saba',  color: '#06b6d4', logo: '/logos/WATER.jpg',      bgColor: '#fff'    },
  { id: 'iec',        label: 'חברת החשמל', url: 'https://enes.iec.co.il/LoginBZ1.aspx',      color: '#eab308', logo: '/logos/iec.png',        bgColor: '#fff'    },
  { id: 'arnona-ks',  label: 'ארנונה כ"ס', url: 'https://www.city4u.co.il/arnona/kfar-saba', color: '#22c55e', logo: '/logos/arnona.png',     bgColor: '#fff'    },
  { id: 'hot-mobile', label: 'HOT mobile',   url: 'https://www.hotmobile.co.il',               color: '#ef4444', logo: '/logos/hot.png',        bgColor: '#1a1a2e' },
  { id: 'partner',    label: 'פרטנר',       url: 'https://www.partner.co.il/n/login/',        color: '#8b5cf6', logo: '/logos/partner.png',    bgColor: '#0A4A45' },
  { id: 'yes',        label: 'yes',          url: 'https://www.yes.co.il/personal-account/',   color: '#0ea5e9', logo: '/logos/yes.png',        bgColor: '#1a1a2e' },
])
