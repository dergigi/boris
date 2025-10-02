declare global {
  interface Window {
    nostr?: {
  getPublicKey(): Promise<string>
  signEvent(event: unknown): Promise<unknown>
    }
  }
}

export {}

