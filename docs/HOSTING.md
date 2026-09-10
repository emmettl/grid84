# Hosting

Grid/84 is served by GitHub Pages at **https://grid84.app/**. The Pages workflow (`.github/workflows/pages.yml`) builds `dist/` on every push to `main` and deploys it; `public/CNAME` carries the domain into the artifact, and the repository's Pages settings name the same domain, so `https://emmettl.github.io/grid84/` redirects there. The build uses a relative base (`base: './'` in `vite.config.ts`) and hash routes, so the same artifact serves at the root of a domain or under a path.

The Motion Studies sub-path edition (`motionstudies.app/grid84`) was retired on 10 September 2026: the atlas has too much of its own identity to be a sub-path of another site. The edition publisher workflow and its wrangler config were removed from this repository; the `grid84` entry in Motion Studies' `hosting/editions.json` can go when convenient.

## DNS at Cloudflare

The domain is registered at Cloudflare. GitHub Pages needs these records, **DNS only** (grey cloud) at least until GitHub has issued the certificate; the zone can be proxied afterwards with SSL/TLS set to *Full (strict)*.

| Type | Name | Content |
| --- | --- | --- |
| A | `grid84.app` | `185.199.108.153` |
| A | `grid84.app` | `185.199.109.153` |
| A | `grid84.app` | `185.199.110.153` |
| A | `grid84.app` | `185.199.111.153` |
| AAAA | `grid84.app` | `2606:50c0:8000::153` |
| AAAA | `grid84.app` | `2606:50c0:8001::153` |
| AAAA | `grid84.app` | `2606:50c0:8002::153` |
| AAAA | `grid84.app` | `2606:50c0:8003::153` |
| CNAME | `www` | `emmettl.github.io` |

Cloudflare's registrar may have created placeholder records on purchase; remove any A, AAAA or CNAME on the apex that is not in the table. The `www` name redirects to the apex on GitHub's side once both resolve.

## After the records resolve

1. Repository → Settings → Pages shows the domain with a DNS check; once it passes, GitHub requests a Let's Encrypt certificate, usually within the hour.
2. Tick **Enforce HTTPS** when the certificate is issued (the API call `gh api -X PUT repos/emmettl/grid84/pages -F https_enforced=true` does the same).
3. Optional, recommended: verify the domain for the account at GitHub → Settings → Pages → *Add a domain*, which asks for a `TXT` record at `_github-pages-challenge-emmettl.grid84.app`; a verified domain cannot be claimed by another repository.

## Checks

```bash
dig +short grid84.app A
dig +short grid84.app AAAA
dig +short www.grid84.app CNAME
curl -sI https://grid84.app/ | head -5
```

The response should come from GitHub (`server: GitHub.com`) with the `index.html` of the last deployment; `https://grid84.app/#/wopr` should open WOPR.
