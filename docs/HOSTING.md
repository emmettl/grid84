# Hosting

Grid/84 is dual-hosted from one artifact. Every push to `main` runs the checks, builds `dist/` and deploys it to GitHub Pages at **https://emmettl.github.io/grid84/** (`.github/workflows/pages.yml`). The same artifact is deployed to **https://grid84.app/** as a Cloudflare Worker with static assets (`wrangler.jsonc`): the Worker has no script, only the files, and the domain and `www` are its custom domains, so Cloudflare keeps the DNS records itself. The build uses a relative base (`base: './'` in `vite.config.ts`) and hash routes, so the artifact serves at the root of a domain or under a path without change.

The Motion Studies sub-path edition (`motionstudies.app/grid84`) was retired on 10 September 2026: the atlas has too much of its own identity to be a sub-path of another site. Its `grid84` entry in Motion Studies' `hosting/editions.json` can go when convenient.

## Deploying the Worker

From a machine logged in to wrangler (`npx wrangler login`):

```bash
npm run build && npx wrangler deploy
```

The Pages workflow does the same in its `worker` job when the repository secret `CLOUDFLARE_API_TOKEN` exists; without it the job prints a note and grid84.app keeps its last deployment. The token comes from the Cloudflare dashboard, My Profile → API Tokens → Create Token → the **Edit Cloudflare Workers** template, with Account Resources set to this account and Zone Resources to grid84.app. A wrangler login's OAuth session cannot mint tokens (it lacks the API-tokens scope), so this is a dashboard step. The account id is in `wrangler.jsonc`; it is not a secret.

## Caching

`public/_headers` is honoured by the Worker and ignored by GitHub Pages, and follows the editions' policy: hashed files under `/assets/` are `public, max-age=31536000, immutable`; the HTML and the grids index are `public, max-age=0, must-revalidate`; the study grids under `/data/hyde/` revalidate daily; `/_release.json`, which the workflow writes with the commit and run, is `no-cache`. GitHub Pages applies its own ten-minute policy to everything.

## Checks

```bash
curl -sI https://grid84.app/ | grep -i -E "server|cache-control|x-grid84"
curl -sI https://grid84.app/assets/$(curl -s https://grid84.app/ | grep -o 'assets/index-[^"]*\.js' | head -1 | cut -d/ -f2) | grep -i cache-control
curl -s https://grid84.app/_release.json
curl -sI https://emmettl.github.io/grid84/ | grep -i -E "server|cache-control"
```

Both hosts read the GHSL grids from the R2 bucket named in the grids index, so the studies and WOPR calibrate the same way on either.
