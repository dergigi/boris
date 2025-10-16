import { useEffect } from 'react'
import { useLocation, useMatch } from 'react-router-dom'

export default function RouteDebug() {
  const location = useLocation()
  const matchArticle = useMatch('/a/:naddr')

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('debug') !== '1') return

    const info: Record<string, unknown> = {
      pathname: location.pathname,
      search: location.search || null,
      matchedArticleRoute: Boolean(matchArticle),
      referrer: document.referrer || null
    }

    if (location.pathname === '/') {
      // Unexpected during deep-link refresh tests
      console.warn('[RouteDebug] unexpected root redirect', info)
    } else {
      console.debug('[RouteDebug]', info)
    }
  }, [location, matchArticle])

  return null
}


