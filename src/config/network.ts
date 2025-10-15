// Centralized network configuration for relay queries
// Keep timeouts modest for local-first, longer for remote; tweak per use-case

export const LOCAL_TIMEOUT_MS = 1200
export const REMOTE_TIMEOUT_MS = 6000

// Contacts often need a bit more time on mobile networks
export const CONTACTS_REMOTE_TIMEOUT_MS = 9000

// Future knobs could live here (e.g., max limits per kind)


