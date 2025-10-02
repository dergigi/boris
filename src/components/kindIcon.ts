import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
  faCircleUser,
  faFeather,
  faRetweet,
  faHeart,
  faImage,
  faVideo,
  faFile,
  faLaptopCode,
  faCodePullRequest,
  faBug,
  faExclamationTriangle,
  faBolt,
  faCloudBolt,
  faHighlighter,
  faNewspaper,
  faEyeSlash,
  faThumbtack,
  faBookmark
} from '@fortawesome/free-solid-svg-icons'

const iconMap: Record<number, IconDefinition> = {
  0: faCircleUser,
  1: faFeather,
  6: faRetweet,
  7: faHeart,
  20: faImage,
  21: faVideo,
  22: faVideo,
  1063: faFile,
  1337: faLaptopCode,
  1617: faCodePullRequest,
  1621: faBug,
  1984: faExclamationTriangle,
  9735: faBolt,
  9321: faCloudBolt,
  9802: faHighlighter,
  30023: faNewspaper,
  10000: faEyeSlash,
  10001: faThumbtack,
  10003: faBookmark
}

export function getKindIcon(kind: number): IconDefinition {
  return iconMap[kind] || faFile
}


