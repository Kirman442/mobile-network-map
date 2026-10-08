# Four versus eight loading workers

This is an experiment on `codex/workers-4-vs-8`, not a change to the production pool. Normal builds retain the adaptive limit of four workers. Only `vite build --mode workerbench` enables the comparison panel and the `?workers=4` / `?workers=8` overrides. These select exactly four or eight workers regardless of hardware concurrency.

With a reported concurrency of four, the production formula selects three workers. This experiment compares fixed pool sizes four and eight; it does not directly benchmark that adaptive production policy against an adaptive limit of eight.

## Local results, 2026-10-08

Same browser tab, default viewport and initial camera, download-speed layer, first palette, Arrow IPC + HTTP Brotli. No network or CPU throttling. The browser reports four logical processors. Country bodies are served from localhost with `Cache-Control: no-store`; page, worker and basemap resources may be cached. The final series was collected after CLI installation, builds, automated tests and deployment finished, with five runs per setting in order 4, 8, 4, 8, 4, 8, 8, 4, 8, 4. These are repeated visits, not cold page startup measurements.

All ten measured runs completed 42 files and 1,235,099 records without failures or a hidden tab.

| Median, five runs | 4 workers | 8 workers |
| --- | ---: | ---: |
| First points | 243 ms | 261 ms |
| Data ready | 1,560 ms | 1,352 ms |
| First full dataset render callback | 1,680 ms | 1,554 ms |
| Sum of synchronous worker preparation intervals | 774 ms | 1,327 ms |
| Longest animation-frame gap | 150 ms | 150 ms |
| Frame gaps above 50 ms | 7 | 6 |

Full-frame ranges overlap: 1.51–2.03 seconds for four and 1.48–1.59 seconds for eight. Mean full-frame times are 1.72 and 1.54 seconds respectively. Eight workers improve median full-frame time by about 7.5% and data-ready time by about 13%, but the first points appear slightly later and the sum of preparation intervals rises by about 71%. This is an exploratory comparison, not a statistical significance claim.

An earlier local series ran while tooling was being prepared and showed the opposite median result (1.75 versus 2.17 seconds). It is retained separately as exploratory evidence, not used as the final comparison. Background activity and cold startup can materially change results.

Localhost removes internet latency and most bandwidth constraints; these results cannot predict Netlify performance on a faster connection or a device with more processors. Larger pools may overlap downloads better, but also start more workers and compete for CPU. The render work on the main thread and GPU remains shared.

## What the measurements mean

- Timings start at the data-loading React effect, not navigation start. They exclude some page startup costs.
- First points/full frame use deck.gl `onAfterRender`; they do not measure GPU completion or the moment pixels reach the display. Full frame means all expected point records are submitted, not that the basemap has finished loading.
- Data ready includes country download and preparation and scheduling the final React update.
- Worker processing is the sum of synchronous preparation intervals; it is neither elapsed loading time nor a measurement of actual CPU utilization. Browser HTTP decompression and network time are outside that interval.
- Animation-frame gaps and long tasks characterize startup responsiveness; they are not steady-state FPS.
- Sampled main JS heap excludes workers and GPU memory. It is approximate and affected by garbage collection, so it cannot establish total memory consumption.
- Other palettes start after the full dataset render callback, as in the current application.

Final local results are saved in [benchmarks/workers-local-clean-results.json](benchmarks/workers-local-clean-results.json); the earlier exploratory series is in [benchmarks/workers-local-results.json](benchmarks/workers-local-results.json). Measurements were made in the Codex in-app browser; its reported processor count is not a measurement of the physical machine's total CPU capacity.

## Test through Netlify

Draft deployment: https://workers-4-vs-8--mobile-network-map.netlify.app/ (deploy `6ac78dd4bfe95aad3ed156b6`). Use [four workers](https://workers-4-vs-8--mobile-network-map.netlify.app/?workers=4) and [eight workers](https://workers-4-vs-8--mobile-network-map.netlify.app/?workers=8).

The published production deploy was checked after uploading this draft: `6ac64617a5e2b741ecaf69ab`, commit `0dd4d9eb020368f16b33ddab8eb65d668440d2d6`, production branch `production`.

Three repeated runs per setting were collected through Netlify after excluding the initial visit for each setting. All completed the expected dataset without failures or a hidden tab. Actual internet bandwidth was uncontrolled; no browser throttling was applied, and page/worker/basemap resources may be cached. Country responses use the draft deployment's no-store policy.

| Median, three repeated runs | 4 workers | 8 workers |
| --- | ---: | ---: |
| First points | 344 ms | 461 ms |
| Data ready | 6,709 ms | 5,796 ms |
| First full dataset render callback | 6,743 ms | 5,908 ms |
| Sum of synchronous worker preparation intervals | 537 ms | 638 ms |

Full-frame ranges were 4.46–12.42 seconds and 4.69–8.52 seconds. The median improvement is about 12.4%, but the small sample and wide variation prevent attributing that difference confidently to the pool size. First visits were 10.57 seconds for four and 7.66 seconds for eight; their different startup/CDN conditions make them unsuitable as a direct comparison. Raw reports: [benchmarks/workers-netlify-results.json](benchmarks/workers-netlify-results.json).

Recommendation: keep production unchanged while collecting more paired runs on the user's browser and, if available, a faster connection and a device reporting more processors. A possible improvement remains plausible; a universal fixed pool of eight has not been justified.

Use both URLs of the same draft deployment, alternating settings. Keep the tab visible and use the same viewport, layer, palette and cache conditions. Run at least five times per setting; record the first cold page visit separately. Prefer Full frame and First points over DevTools Finish, which also includes unrelated requests.

Use Save results after each run to retain the report. A report is marked invalid if data is missing, a load failed, or the tab was hidden. Test both an unrestricted connection and a slower connection if available. Keep production at its existing limit until these measurements show a consistent benefit.

## Reproduce locally

```sh
npm run build:workerbench
npm run preview -- --mode workerbench --port 4177
```

The local benchmark middleware serves precompressed country files from `public/data` with the correct HTTP content encoding. It is installed only in workerbench mode. On Netlify, the existing data-encoding Edge Function performs that role.
