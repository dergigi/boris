import type { ArticleMetadata } from './ogStore'

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function generateHtml(naddr: string, meta: ArticleMetadata | null): string {
  const baseUrl = 'https://read.withboris.com'
  const articleUrl = `${baseUrl}/a/${naddr}`
  
  const title = meta?.title || 'Boris – Read, Highlight, Explore'
  const description = meta?.summary || 'Your reading list for the Nostr world. A minimal nostr client for bookmark management with highlights.'
  const image = meta?.image?.startsWith('http') ? meta.image : `${baseUrl}${meta?.image || '/boris-social-1200.png'}`
  const author = meta?.author || 'Boris'

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0f172a" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${articleUrl}" />
    
    <!-- Open Graph / Social Media -->
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${articleUrl}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:site_name" content="Boris" />
    ${meta?.published ? `<meta property="article:published_time" content="${new Date(meta.published * 1000).toISOString()}" />` : ''}
    <meta property="article:author" content="${escapeHtml(author)}" />
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${articleUrl}" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
  </head>
  <body>
    <noscript>
      <p>Redirecting to <a href="/">Boris</a>...</p>
    </noscript>
    <script>
      (function(){
        try {
          var p = '/a/${naddr}';
          if (window.location.pathname !== p) {
            history.replaceState(null, '', p);
          }
          window.location.replace('/');
        } catch (e) {}
      })();
    </script>
  </body>
</html>`
}

