# Mobile performance measurements

**Measured 26 October 2026** against the production build of `40bf630`. These are mobile-emulated browser measurements, not physical-phone results.

## Method

The harness uses Chromium 156, a 390 × 844 viewport at DPR 3, touch/mobile emulation, normal motion, 4× main-page CPU slowdown, 4 Mbps download, 1 Mbps upload and 150 ms latency. Each scenario starts in a fresh browser context; tile caching remains enabled within the scenario. Rendering uses headless SwiftShader on the host, so frame gaps are diagnostics for this setup, not a phone frame-rate claim. CPU and network emulation on the main target do not prove identical throttling inside every worker.

Local production assets are served with gzip over HTTP. Map, terrain, population-bucket and other external services are live. Photon alone is replayed inside the page from the real Zürich HB response recorded on 11 September 2026; its latency and transfer are excluded. The page's real ranking, descent, terrain loading and population profile still run. This avoids changing HTTP-cache behaviour through browser request interception.

Three runs cover each view:

- Front page: wait for the page, then observe for 15 seconds.
- Atlas orbit: wait for standby controls, then observe for 20 seconds.
- Descent: acquire Zürich HB, hold the strike console, and observe for 25 seconds from target entry. Transfer figures for this row are additional to the orbit, not another cold navigation.
- SIOP//62 alert option 2: cold navigation, RUN at 60×, then observe for 60 seconds. The early 20-second samples still had four dense-grid downloads pending and are not the complete-study baseline.

Request totals include dedicated-worker requests. Bytes are completed encoded response bodies plus response headers, in decimal MB below; request/upload bytes and bytes from cancelled or still-pending responses are excluded. Consequently descent totals are lower bounds, especially during the animated zoom. Cancelled requests are reported separately from failures. LCP comes from the browser's paint observer and is not a measure of map completeness. UI readiness means the relevant controls appeared, not that every tile or population result was ready.

The initial front/orbit/descent samples used `no-store` for local app assets; remote tile caching was normal. The longer study samples use `public, max-age=86400, must-revalidate` for local grid binaries, matching the published grid headers. Both serve gzip app assets; the published site currently uses zstd, so these are not exact CDN wire measurements. Raw data records the conditions of each pass.

## Results

Median, with the three-run range in parentheses. Transfer is decimal MB. Descent adds to the orbit; the other rows start cold.

| View | Controls/acquisition (s) | Completed responses (MB) | Terrain subset (MB) | Pending at snapshot |
| --- | --- | --- | --- | --- |
| Front page | 0.68 (0.67–0.70) | 0.14 (0.14–0.14) | 0.00 (0.00–0.00) | 0 |
| Opening orbit | 1.95 (1.94–2.25) | 4.04 (4.04–4.04) | 3.08 (3.08–3.08) | 0 |
| Descent, additional traffic | 8.28 (7.94–8.33) | 4.79 (4.78–4.89) | 1.05 (1.05–1.15) | 0 |
| SIOP//62, 60 s playback | 2.49 (2.49–3.23) | 8.66 (8.66–8.66) | 2.68 (2.68–2.68) | 0 |

The front-page LCP was 0.68 (0.68–1.74) seconds. Opening-orbit terrain was about 76% of completed transfer. All sampled pages stayed within the viewport width and reported no uncaught page errors.

The four exposure workers held 149.34 (149.34–149.34) MB of backing storage in the complete-study samples. Population responses totalled 5.10 (5.10–5.10) MB: the browser cache avoided four separate wire copies, but not four decoded arrays. Page JS heap is recorded separately in the data and must not be read as total memory.

During descent, many basemap and DEM requests were cancelled as zoom levels changed. The completed-response figures therefore do not establish the full bytes transferred during the animation.

| View | p95 animation-frame gap (ms), median (range) |
| --- | --- |
| Front page | 16.8 (16.7–16.8) |
| Opening orbit | 283.4 (283.3–283.4) |
| Descent, additional traffic | 66.7 (66.7–66.7) |
| SIOP//62, 60 s playback | 400.0 (383.4–400.0) |

The large map gaps were measured with software rendering and page CPU emulation. They identify views worth profiling; they cannot be translated into real-phone FPS.

[Machine-readable measurements](../docs/measurements/mobile-2026-10-26.json) retain per-run transfer categories, cancellations, long-task excess over 50 ms, page heap and worker heap/backing-storage samples. Per-run summaries are retained in the linked data; detailed raw traces and screenshots from these passes are not retained. Future measurements use `.cache/mobile-performance/`, separate from the browser regression runner's disposable output directory.

## 27 October: defer orbital relief

The hillshade layer now uses the same zoom-9 threshold as 3D terrain. At orbital zoom the globe keeps its vector geometry and atmosphere, with no DEM downloads; hillshade and terrain return on descent. This is a change from the baseline's visible mountain relief in orbit.

Three further mobile-emulated atlas runs used the same viewport, throttling, recorded target and live tile services. The source was `40bf630` plus the `src/map/style.ts` change, recorded in the [follow-up data](../docs/measurements/mobile-terrain-2026-10-27.json).

| Opening orbit | Before, median | After, median |
| --- | --- | --- |
| Completed responses | 4.04 MB | 0.96 MB |
| Terrain subset | 3.08 MB | 0 MB |
| Requests | 76 | 37 |

Completed opening transfer fell by 76.2%. All three opening samples made zero terrain requests. All three descents still acquired the station and fetched DEM tiles; median acquisition took 8.45 seconds. Additional descent traffic remained about 4.79 MB of completed responses, with cancellations still making this a lower bound. This change removes distant relief from the opening view; it does not remove close-view terrain or elevation readings.

Two follow-up descents recorded live external-service failures; an observed Overpass response was HTTP 502. The failure counts are retained in the data rather than counted as terrain regressions. The physical-phone and total-wire-byte limitations above still apply.

## 27 October: one worker per dense grid

Dense grids now load into the first exposure worker only. Once its response identifies the grid as dense, the service retires the idle spare workers; tiled grids still load the requested pool and share tile downloads. Exposure requests, polygon sums, union updates and cell queries wait for the same load promise. Failed downloads can retry; destroyed services and failed workers reject waiting work. The numerical exposure and union models are unchanged.

Three more 60-second SIOP//62 samples confirmed one exposure worker, no unfinished downloads at the snapshot and no uncaught page errors. [Per-run measurements](../docs/measurements/mobile-dense-2026-10-27.json) retain the worker-memory inspection and transfer counts.

| SIOP//62 exposure memory | Original baseline | Single dense worker |
| --- | --- | --- |
| Exposure workers retained | 4 | 1 |
| Worker backing storage, median | 149.34 MB | 37.34 MB |
| Population responses, median | 5.10 MB | 5.10 MB |

This is a 75% reduction in exposure-worker backing storage, not a 75% reduction in total browser memory. Network transfer is essentially unchanged because the browser cache already avoided four wire copies. Total completed responses were about 5.98 MB in these samples; the reduction from the original 8.66 MB also includes the separate orbital-relief change.

The tradeoff is deliberate: dense grids have one computation worker instead of four, on desktop as well as mobile. An isolated [real-worker benchmark](../docs/measurements/dense-worker-batch-2026-10-27.json) ran 2,610 exposure jobs over all 870 transcribed SAC targets at 100, 1,100 and 9,000 kt, with eight requests outstanding and the same 1961 grid. Three repetitions alternated pool order, excluded grid-load time and compared all result fields exactly. On the host, median batch time rose from 75.8 ms with four workers to 254.6 ms with one—about 3.4×, or 178.8 ms more for that batch. All six result digests matched. This benchmark uses no map rendering, CPU/network emulation, unions or fallout; it quantifies the single-exposure tradeoff, not full-study completion time or phone throughput. The mobile-emulated samples establish memory savings and functioning early playback, not end-to-end throughput equivalence for every study. The browser regression also loads a synthetic dense historical grid, checks one binary download and one exposure worker, scrubs to the end and verifies that outcome computation advances. Existing model tests remain the check on the arithmetic. Tiled-grid parallelism is retained.

Raw data and screenshots from this pass are retained locally under `.cache/mobile-dense-single/`, outside the browser test runner's disposable directory.

## Budgets and next technical work

These are provisional regression ceilings for this harness, not physical-device acceptance criteria or new CI gates:

| Measurement | Ceiling | Basis |
| --- | --- | --- |
| Cold front-page completed responses | 160 KiB | Margin over the three-run compressed baseline |
| Opening orbit completed responses | 1.25 MiB | Margin over the post-change live-service baseline |
| Opening orbit terrain requests | 0 below zoom 9 | Hillshade and 3D terrain both deferred; checked in the browser acquisition regression |
| Dense 1961 exposure-worker backing storage | 40 MiB | One 37.34 MB grid plus headroom; excludes page, renderer, unions and GPU |
| Initial front-page JavaScript | 350,000 uncompressed bytes | Existing browser regression check |

No absolute descent-transfer ceiling is set from completed responses while so many requests are cancelled. A physical-device/network trace that includes partial responses is needed first. Likewise, these samples do not establish a phone GPU, total memory or thermal budget.

Orbital relief is now deferred, as measured above. Keep the two DEM sources separate for rendering quality; the baseline did not establish duplicate downloads between them. Dense-grid duplication has also been removed, as measured above. Further performance work should compare full-study completion latency and real-device memory pressure before changing the worker policy again.

The original dense-grid memory investigation found the following cost: The 1961 grid has 4,320 × 2,160 float32 counts: 37,324,800 bytes per worker, or 149,299,200 bytes for four decoded count arrays, before windows, unions and renderer memory. This count-array calculation agrees with the worker backing-storage measurements below; neither measures total browser memory. The tile download cache does not eliminate dense arrays; the new single-worker policy retains just one of them.

## Published-site check

At the start of measurement, `https://grid84.app/_release.json` identified `5e1e165153ce06218c2be8a77eeab06e37876090`, not the current local `40bf630` build. That exploratory pass is excluded from the current-build results. Its live Zürich search did not reach the acquired state within 45 seconds; one Photon request was cancelled and another returned HTTP 200. The response body was not retained, so this does not establish a Photon outage. No deployment was changed as part of measurement.

## Repeat the measurement

Run `npm run perf:dense-workers` to repeat the isolated pool-size comparison; it builds the production worker, serves it on port 4187 and writes `.cache/mobile-dense-single/batch.json`.

Run `npm run perf:mobile` after installing Chromium with `npx playwright install chromium`. The command builds, starts a gzip static server on port 4186, runs three samples and writes raw data, a summary and screenshots to the ignored `.cache/mobile-performance/` directory. It is manual and depends on live services; it is not a deterministic CI test.

Environment overrides:

- `PERF_RUNS=1` for a shorter exploratory pass.
- `PERF_SCENARIOS=study` to measure only the large study.
- `PERF_STUDY_SECONDS=60` sets the study observation window.
- `PERF_OUT=.cache/another-run` keeps separate raw results.
- `PERF_URL=https://grid84.app/` measures a remote release instead of the local build; inspect the saved release marker before comparing results.
- `PERF_LIVE_GEOCODER=1` uses live Photon and includes the actual search dependency.

For physical-phone completion, record the device, OS/browser and connection; repeat cold front, orbit, descent and study samples with hardware rendering and without CPU emulation; capture whole-browser/worker memory and partial network transfers. Check acquisition and map completeness as well as controls, and repeat after sustained use to expose thermal limits. The roadmap's real-phone item remains open.
