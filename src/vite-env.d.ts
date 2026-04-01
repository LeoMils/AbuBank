/// <reference types="vite/client" />

// C2-FIX: Custom env var type MUST be declared here
interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
