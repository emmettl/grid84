import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * A page for a crawler to read.
 *
 * The app is one HTML file and its routes are hash fragments, which a search
 * engine treats as one page: everything in here — thirteen studies, nine
 * laboratories, four modes — is invisible to a search for any of it. So after
 * the build, each entry in data/site/pages.json gets a file of its own with
 * its own title, description and social card, a paragraph of real text, and a
 * link into the app. A browser that runs scripts is sent straight through to
 * the hash route; a crawler, or a reader without scripts, gets the paragraph
 * and the link.
 *
 * The built page uses relative asset paths, because the site is served from
 * the root of grid84.app and from a subdirectory on GitHub Pages. A page one
 * or two directories down has to climb back out, so the asset references are
 * rewritten by depth rather than made absolute.
 */

const site = JSON.parse(readFileSync('data/site/pages.json', 'utf8'))
const shell = readFileSync('dist/index.html', 'utf8')
const today = new Date().toISOString().slice(0, 10)

/** Replace the content of a meta tag, whatever attribute names it in. */
function setMeta(html, attr, name, content) {
  const re = new RegExp(`(<meta\\s+${attr}="${name}"\\s+content=")[^"]*(")`, 's')
  if (re.test(html)) return html.replace(re, `$1${escapeAttr(content)}$2`)
  // Some tags in the shell are written across several lines.
  const multi = new RegExp(`(<meta\\s*\\n\\s*${attr}="${name}"\\s*\\n\\s*content=\\s*")[^"]*(")`, 's')
  return html.replace(multi, `$1${escapeAttr(content)}$2`)
}

const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const written = []
for (const page of site.pages) {
  if (page.path === '') continue
  const depth = page.path.split('/').length
  const up = '../'.repeat(depth)
  const url = `${site.origin}/${page.path}/`
  let html = shell
  // Climb back to the site root for every relative asset.
  html = html.replaceAll('src="./', `src="${up}`).replaceAll('href="./', `href="${up}`)
  // The site name goes in the title tag, where a result listing shows it, but
  // not in the social card, where the site name has a field of its own.
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeText(page.title)} · Grid/84</title>`)
  html = html.replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`)
  html = setMeta(html, 'name', 'description', page.description)
  html = setMeta(html, 'property', 'og:title', page.title)
  html = setMeta(html, 'property', 'og:description', page.description)
  html = setMeta(html, 'property', 'og:url', url)
  html = setMeta(html, 'name', 'twitter:title', page.title)
  html = setMeta(html, 'name', 'twitter:description', page.description)
  // The readable page, and the way through to the app.
  const body = `<div id="root"><main class="prerender">
      <h1>${escapeText(page.title)}</h1>
      <p>${escapeText(page.description)}</p>
      <p>${escapeText(page.summary)}</p>
      <p><a href="${up}${page.hash}">Open it in Grid/84</a></p>
    </main></div>
    <script>window.location.replace(${JSON.stringify(`${up}${page.hash}`)})</script>`
  html = html.replace('<div id="root"></div>', body)
  const file = join('dist', page.path, 'index.html')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, html)
  written.push(url)
}

// Static supporting documents are already files; they need no shell, only a line in the sitemap.
const extras = (site.extras ?? []).map((e) => `${site.origin}/${e.path}`)
const urls = [`${site.origin}/`, ...written, ...extras]
writeFileSync(
  'dist/sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`,
)
writeFileSync('dist/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${site.origin}/sitemap.xml\n`)
console.log(`prerender: ${written.length} pages, ${extras.length} static document(s), a sitemap of ${urls.length} and a robots.txt`)
