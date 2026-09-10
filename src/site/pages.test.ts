import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseRoute } from '../route.ts'

/**
 * The pages a search engine is given have to be pages this app actually has.
 * A hash route that no longer exists would still be prerendered, indexed and
 * linked to, and would land the reader on the atlas with no explanation.
 */
const site = JSON.parse(readFileSync('data/site/pages.json', 'utf8')) as {
  origin: string
  pages: Array<{ path: string; hash: string; title: string; description: string; summary: string }>
}

describe('the pages given to a crawler', () => {
  it('every one of them is a route this app has', () => {
    for (const page of site.pages) {
      const route = parseRoute(page.hash)
      // parseRoute falls back to the atlas for anything it does not know, so a
      // hash that is not the atlas and comes back as the atlas is a dead route.
      if (page.hash !== '#/atlas') expect(route.kind, `${page.hash} is not routed`).not.toBe('atlas')
      if (page.hash.startsWith('#/study/')) expect(route.kind).toBe('study')
      if (page.hash.startsWith('#/lab/')) expect(route.kind).toBe('lab')
    }
  })

  it('gives each page a title and a description a listing can show, and no duplicates', () => {
    const paths = new Set<string>()
    for (const page of site.pages) {
      expect(paths.has(page.path), `${page.path} twice`).toBe(false)
      paths.add(page.path)
      expect(page.title.length).toBeGreaterThan(12)
      expect(page.title.length).toBeLessThan(75)
      // Long enough to be worth showing, short enough that a listing does not cut it.
      expect(page.description.length).toBeGreaterThan(60)
      expect(page.description.length).toBeLessThan(320)
      expect(page.summary.length).toBeGreaterThan(20)
      expect(/^[a-z0-9/-]*$/.test(page.path), `${page.path} is not a clean path`).toBe(true)
    }
  })

  it('names the origin the canonical links and the sitemap are built from', () => {
    expect(site.origin).toBe('https://grid84.app')
    expect(site.pages.some((p) => p.path === '')).toBe(true)
  })
})
