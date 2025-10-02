export const formatDate = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleDateString()
}

// Extract pubkeys from nprofile strings in content
export const extractNprofilePubkeys = (content: string): string[] => {
  const nprofileRegex = /nprofile1[a-z0-9]+/gi
  const matches = content.match(nprofileRegex) || []
  const unique = new Set<string>(matches)
  return Array.from(unique)
}


