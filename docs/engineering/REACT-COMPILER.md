# Targeted React Compiler adoption

Only `src/studies/StudyView.tsx` is compiled. `vite.config.ts` uses the native
`@vitejs/plugin-react` compiler with an explicit `sources` filter and the matching
`oxc-transform-react@0.152.0` dependency. Other modules retain their existing build.

Three alternating production samples on an Apple M4 Max, Chromium/ANGLE Metal
and 4× CPU throttling measured 120 consecutive timeline steps. Median JavaScript
CPU fell from 1,756.57 ms to 1,682.54 ms (−4.2%); component render counts fell
from 854 to 497 (−41.8%). Each candidate CPU sample beat its paired baseline.
Total emitted JavaScript grows by 3,308 gzipped bytes (+0.35%). This is a seeking
result, not an FPS or playback-throughput claim.

Compiling the whole application added 35,201 gzipped bytes, so the one-file
setting retains the useful reduction with substantially less overhead. Existing
manual memoization and compiler bailouts are retained. The native integration is
experimental; broaden its source filter only with new measurements.

[Full cross-study report and raw evidence](https://github.com/emmettl/motionstudies/blob/main/docs/REACT-COMPILER.md).

Validation: typecheck, lint, 366 unit tests, full build/prerender, and all eight
production-browser route, worker, readout and interaction tests passed.
