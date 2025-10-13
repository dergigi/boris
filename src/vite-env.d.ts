/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEFAULT_ARTICLE_NADDR: string
}

declare module '*.svg?raw' {
  const content: string
  export default content
}
