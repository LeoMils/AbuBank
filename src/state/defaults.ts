// IMMUTABLE_DEFAULTS derives from src/services/serviceCatalog.ts (single
// source of truth). Persisted IndexedDB rows use the same `id` shape, so
// existing local user data round-trips with no migration.
//
// Field mapping: catalog → ServiceConfig
//   id       → id      (canonical, e.g. 'postalbank', 'water-ks')
//   label    → label
//   url      → url
//   (none)   → iconPath (left empty — Home renders logos via the catalog
//                        directly; iconPath is preserved only for the
//                        ServiceConfig type contract used by Settings/Admin.)

import type { ServiceConfig } from './types'
import { LAUNCHER_SERVICES } from '../services/serviceCatalog'

const derived: ServiceConfig[] = LAUNCHER_SERVICES.map((s) => ({
  id:       s.id,
  label:    s.label,
  url:      s.url,
  iconPath: '',
}))

export const IMMUTABLE_DEFAULTS: readonly ServiceConfig[] = Object.freeze(derived)
