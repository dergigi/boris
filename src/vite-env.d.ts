/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEFAULT_ARTICLE_NADDR: string
}

declare module '*.svg?raw' {
  const content: string
  export default content
}

// Build-time defines injected by Vite in vite.config.ts
declare const __APP_VERSION__: string
declare const __GIT_COMMIT__: string
declare const __GIT_BRANCH__: string
declare const __BUILD_TIME__: string
declare const __GIT_COMMIT_URL__: string
