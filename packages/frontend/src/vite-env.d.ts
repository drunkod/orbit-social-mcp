/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_CAFE_PREVIEW?: string
  readonly VITE_MCP_PLUGINS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
