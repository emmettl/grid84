/**
 * The working briefs, rendered as pages of this site rather than as files on
 * a code host.
 *
 * The briefs in docs/ are the working record: what each study is, what it
 * takes from which source, what it does not model, and where the engine has
 * been checked against a published figure. They were written as markdown and
 * they stay markdown — one copy, edited in one place — but a reader should
 * not have to leave for a repository to read them. This renders each one into
 * the same house style as the research dossiers, so the whole case for the
 * project can be read without leaving it.
 *
 * The converter handles the subset the briefs actually use: headings,
 * paragraphs, bullet and numbered lists, tables, fenced code, and inline
 * emphasis, code and links. It is deliberately small; a brief that needs
 * something else should say so by failing to render it, not by pulling in a
 * parser whose behaviour nobody here has read.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const DOCS = 'docs'
const OUT = 'public/brief'
/** Where a link to a file that is code rather than a page resolves to. */
const REPO = 'https://github.com/emmettl/grid84/blob/main'

/** Where each brief belongs on the index, and the one line that says what it is. A brief with no entry still renders, and is listed last. */
const ABOUT = {
  VALIDATION: { group: 'The engine', lede: 'Every figure the engine computes, set against a published one: what agrees, what does not, and by how much.' },
  DOCTRINE: { group: 'The engine', lede: 'The planning rules the solver applies, and the documents each of them comes from.' },
  STRIKE: { group: 'The engine', lede: 'How a strike on any point on Earth is planned, sized and flown, step by step.' },
  WINTER: { group: 'The engine', lede: 'The chain from the fires to the famine in five coupled models, and what each was fitted to.' },
  INTERCEPT: { group: 'The engine', lede: 'The four phases of interception, the arithmetic of each, and why the endgame is the easy part.' },
  WOPR: { group: 'The engine', lede: 'The optimiser: what it is asked to maximise, what it may spend, and what it cannot trade away.' },
  'SINO-SOVIET-69': { group: 'The studies', lede: 'A Soviet strike on the Chinese nuclear complex in 1969 — the surgery nobody has evidence was planned.' },
  'SIOP-62': { group: 'The studies', lede: 'The Single Integrated Operational Plan of 1962, from the declassified record.' },
  'CUBA-62': { group: 'The studies', lede: 'October 1962, and the forces actually in place on each day of it.' },
  'DEFCON3-73': { group: 'The studies', lede: 'The alert of October 1973: what moved, when, and on whose order.' },
  'ABLE-ARCHER-83': { group: 'The studies', lede: 'The exercise of November 1983, and the question of how close it came.' },
  'WINDOW-83': { group: 'The studies', lede: 'The window of vulnerability, as the forces of 1983 actually stood in it.' },
  '72-MINUTES': { group: 'The studies', lede: 'One missile, one decision, and the seventy-two minutes between them.' },
  'BRITAIN-80': { group: 'The studies', lede: 'Square Leg and the Home Office estimates, against the engine’s own.' },
  THEATRE: { group: 'The studies', lede: 'Tactical and theatre doctrine in Europe, and the five scenarios drawn from it.' },
  'V-FORCE': { group: 'The studies', lede: 'The British bomber force, its profiles and its timings.' },
  ATTRIBUTION: { group: 'The site', lede: 'Every dataset, tile set, font and library this site uses, with its licence.' },
  HOSTING: { group: 'The site', lede: 'How the site is built and served, on both of the hosts it runs on.' },
}
const GROUPS = ['The engine', 'The studies', 'The site']
const GROUP_TITLE = { 'The engine': 'The models', 'The studies': 'The studies', 'The site': 'The site itself', Other: 'Also here' }

const slugOf = (name) => name.replace(/\.md$/, '').toLowerCase()
/** An id for a heading, so that a brief's own cross-references land on it. */
const anchorOf = (text) =>
  text
    .replace(/<[^>]+>/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Inline markup. Code spans are lifted out first and put back last, so a
 * backtick around two asterisks is left alone. Links are rewritten so that a
 * hash route leaves the brief and enters the app, and a reference to another
 * brief lands on the rendered page rather than on a file in a repository.
 */
function inline(text) {
  const code = []
  // A private-use codepoint stands in for each code span while the rest of the
  // line is marked up; nothing in the briefs contains one.
  const MARK = '\uE000'
  let s = escape(text).replace(/`([^`]+)`/g, (_, c) => `${MARK}${code.push(c) - 1}${MARK}`)
  // The URL may itself contain a balanced pair of brackets, as several of the
  // encyclopaedia's article names do; one level of nesting is enough for these.
  s = s.replace(/\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g, (_, label, href) => {
    let to = href
    if (/^#\//.test(to)) {
      // A hash route leaves the brief and enters the app.
      to = `/${to}`
    } else if (/^#/.test(to)) {
      // A fragment stays a fragment: it points within this page.
    } else if (/^(?:\.\/)?(?:docs\/)?[A-Za-z0-9-]+\.md(#.*)?$/.test(to)) {
      // A sibling brief, written either bare or with the docs/ prefix.
      const [file, fragment = ''] = to.split('#')
      to = `./${slugOf(file.replace(/^.*\//, ''))}.html${fragment ? `#${fragment}` : ''}`
    } else if (!/^https?:/.test(to) && !/^\//.test(to)) {
      // Anything else in the repository — the roadmap, a test, a model — is
      // code rather than a published page, and honestly belongs where it is.
      to = `${REPO}/${to.replace(/^(?:\.\.\/)+/, '')}`
    }
    const external = /^https?:/.test(to)
    return `<a href="${to}"${external ? ' rel="noreferrer"' : ''}>${label}</a>`
  })
  // Bold may contain italics — a book title inside a citation does, constantly —
  // so the content admits a single asterisk but never a pair.
  s = s.replace(/\*\*((?:[^*]|\*(?!\*))+)\*\*/g, '<strong>$1</strong>')
  // Emphasis may open or close hard against a tag this function has already
  // written — an italicised title inside a link label does exactly that — so a
  // tag boundary counts as a word boundary on both sides.
  s = s.replace(/(^|[\s(>])\*([^*]+)\*(?=$|[\s.,;:)<])/g, '$1<em>$2</em>')
  s = s.replace(/(^|[\s(>])_([^_]+)_(?=$|[\s.,;:)<])/g, '$1<em>$2</em>')
  return s.replace(new RegExp(`${MARK}(\\d+)${MARK}`, 'g'), (_, i) => `<code>${code[Number(i)]}</code>`)
}

const cells = (row) => row.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim())
/** A column of figures is set in the mono face and ranged right, as the dossiers set theirs. */
const numeric = (c) => c === '—' || /^[\s−+-]*[\d.,]+\s*(%|km|m|kt|Mt|Tg|s|h|hr|K|°C|psi|rad|rads\/hr)?$/.test(c)

/** Markdown to HTML for the subset the briefs use; returns the body, the H1 and the standfirst. */
function render(md) {
  const lines = md.split('\n')
  const out = []
  let title = ''
  let dek = ''
  let paragraph = []
  let list = null
  let section = 0
  let inCode = false
  let codeLines = []

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    const text = paragraph.join(' ')
    paragraph = []
    // The first bold-led paragraph of the file is the standfirst, not body copy.
    if (!dek && out.length === 0 && /^\*\*/.test(text)) {
      dek = inline(text)
      return
    }
    out.push(`<p>${inline(text)}</p>`)
  }
  const flushList = () => {
    if (!list) return
    out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`)
    list = null
  }
  const closeSection = () => {
    flushParagraph()
    flushList()
    if (section > 0) out.push('</section>')
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (/^```/.test(line)) {
      if (inCode) {
        out.push(`<pre><code>${escape(codeLines.join('\n'))}</code></pre>`)
        codeLines = []
        inCode = false
      } else {
        flushParagraph()
        flushList()
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeLines.push(line)
      continue
    }
    if (/^# /.test(line)) {
      title = line.slice(2).trim()
      continue
    }
    if (/^## /.test(line)) {
      closeSection()
      section += 1
      const h2 = inline(line.slice(3).trim())
      out.push(`<section id="${anchorOf(h2)}"><div class="sec-head"><span class="sec-num">${String(section).padStart(2, '0')}</span><h2 class="sec-title">${h2}</h2></div>`)
      continue
    }
    if (/^### /.test(line)) {
      flushParagraph()
      flushList()
      const h3 = inline(line.slice(4).trim())
      out.push(`<h3 id="${anchorOf(h3)}">${h3}</h3>`)
      continue
    }
    if (/^#### /.test(line)) {
      flushParagraph()
      flushList()
      out.push(`<h4>${inline(line.slice(5).trim())}</h4>`)
      continue
    }
    if (/^\s*\|/.test(line)) {
      flushParagraph()
      flushList()
      const rows = []
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        rows.push(lines[i])
        i += 1
      }
      i -= 1
      const head = cells(rows[0])
      const body = rows.slice(2).map(cells)
      const isNum = head.map((_, c) => body.length > 0 && body.every((r) => !r[c] || numeric(r[c])))
      out.push(
        `<div class="tw"><table><thead><tr>${head.map((h, c) => `<th${isNum[c] ? ' class="num"' : ''}>${inline(h)}</th>`).join('')}</tr></thead><tbody>` +
          body.map((r) => `<tr>${head.map((_, c) => `<td${isNum[c] ? ' class="num"' : ''}>${inline(r[c] ?? '')}</td>`).join('')}</tr>`).join('') +
          '</tbody></table></div>',
      )
      continue
    }
    if (/^\s*[-*] /.test(line)) {
      flushParagraph()
      if (!list || list.tag !== 'ul') {
        flushList()
        list = { tag: 'ul', items: [] }
      }
      list.items.push(line.replace(/^\s*[-*] /, ''))
      continue
    }
    if (/^\s*\d+\. /.test(line)) {
      flushParagraph()
      if (!list || list.tag !== 'ol') {
        flushList()
        list = { tag: 'ol', items: [] }
      }
      list.items.push(line.replace(/^\s*\d+\. /, ''))
      continue
    }
    if (line.trim() === '') {
      flushParagraph()
      flushList()
      continue
    }
    // An indented continuation line belongs to the list item above it.
    if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`
      continue
    }
    flushList()
    paragraph.push(line.trim())
  }
  closeSection()
  return { body: out.join('\n'), title, dek }
}

const page = ({ title, dek, body, slug, about }) => `<!-- Generated from docs/${slug.toUpperCase()}.md by scripts/briefs.mjs. Edit the markdown, not this file. -->
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(about?.lede ?? `A working brief of Grid/84: ${title}.`)}">
<link rel="canonical" href="https://grid84.app/brief/${slug}">
<link rel="stylesheet" href="../dossier/dossier.css">
<link rel="stylesheet" href="./brief.css">
</head><body>

<div class="wrap">

<header class="mast">
  <div class="stamp">
    <span>Working brief</span>
    <b>${escape(about?.group ?? 'Grid/84')}</b>
  </div>
  <h1>${escape(title)}</h1>
  ${dek ? `<p class="dek">${dek}</p>` : ''}
  <div class="mast-meta">
    <span><a href="./">All the briefs</a></span>
    <span><a href="/">Return to the atlas</a></span>
  </div>
</header>

<main class="brief">
${body}
</main>

<footer>
  A working brief of <a href="/">Grid/84</a> &middot; the record of what the engine does and what it is set against<br>
  Written as the work was done, corrections included &middot; the research dossiers behind the models are <a href="/dossier/">here</a>
</footer>

</div>
</body></html>
`

mkdirSync(OUT, { recursive: true })
const files = readdirSync(DOCS).filter((f) => f.endsWith('.md')).sort()
const written = []
for (const file of files) {
  const slug = slugOf(file)
  const { body, title, dek } = render(readFileSync(join(DOCS, file), 'utf8'))
  const about = ABOUT[file.replace(/\.md$/, '')]
  writeFileSync(join(OUT, `${slug}.html`), page({ title: title || slug, dek, body, slug, about }))
  written.push({ slug, title: title || slug, about })
}

const card = (b) => `    <li><a class="card" href="./${b.slug}.html">
      <span class="idx">${escape(b.about?.group ?? 'Grid/84')}</span>
      <h3>${escape(b.title)}</h3>
      <p>${escape(b.about?.lede ?? '')}</p>
    </a></li>`
const groups = GROUPS.map((g) => ({ g, items: written.filter((b) => b.about?.group === g) }))
  .concat([{ g: 'Other', items: written.filter((b) => !b.about) }])
  .filter((x) => x.items.length > 0)

writeFileSync(
  join(OUT, 'index.html'),
  `<!-- Generated by scripts/briefs.mjs from the briefs in docs/. Edit that script, not this file. -->
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The working briefs &mdash; Grid/84</title>
<meta name="description" content="The working record of Grid/84: what each model does, what it takes from which source, what it does not model, and where it has been checked against a published figure.">
<link rel="canonical" href="https://grid84.app/brief/">
<link rel="stylesheet" href="../dossier/dossier.css">
<link rel="stylesheet" href="./brief.css">
</head><body>

<div class="wrap">

<header class="mast">
  <div class="stamp"><span>Grid/84</span><b>Working briefs</b></div>
  <h1>What the engine does</h1>
  <p class="dek">One brief for each model and each study: what it computes, which document or dataset every figure comes from, what it deliberately does not model, and where its output has been set against a published one.</p>
  <div class="mast-meta">
    <span><a href="/">Return to the atlas</a></span>
    <span><a href="/dossier/">The research dossiers</a></span>
  </div>
</header>

<div class="legend" style="margin-top:1.6rem">
  <h2>Briefs and dossiers</h2>
  <p style="margin:0 0 0.8rem;max-width:70ch">These are not the same thing as the <a href="/dossier/">research dossiers</a>, and the difference is worth stating. A dossier is about the literature: what has been published on a subject, who disagrees with whom, and which widely repeated figures do not survive checking. A brief is about this instrument: what it computes, how, and what it leaves out.</p>
  <p style="margin:0;max-width:70ch">They are rendered from the working files the project keeps, so what is here is the working record itself &mdash; including the passages recording that something was got wrong and corrected.</p>
</div>

${groups
  .map(
    (x) => `<section style="margin-top:clamp(2.4rem,5vw,3.4rem)">
  <div class="sec-head">
    <span class="sec-num">${escape(x.g.toUpperCase())}</span>
    <h2 class="sec-title">${GROUP_TITLE[x.g] ?? x.g}</h2>
  </div>
  <ul class="series">
${x.items.map(card).join('\n')}
  </ul>
</section>`,
  )
  .join('\n')}

<footer>
  Working briefs of <a href="/">Grid/84</a> &middot; impractical, never fake<br>
  The research dossiers behind the models are <a href="/dossier/">here</a>
</footer>

</div>
</body></html>
`,
)

console.log(`briefs: ${written.length} pages and an index in ${OUT}`)
