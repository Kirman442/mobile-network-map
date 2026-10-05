# Mobile network performance map

A React / MapLibre / deck.gl map of preprocessed Ookla mobile network performance records in 42 countries. The published site is https://mobile-network-map.netlify.app/.

## Run and verify

Use Node.js 20 or later.

```sh
npm ci
npm run dev
npm run lint
npm run test
npm run build
npm run preview
```

The tests cover multi-batch and multi-row Arrow input, buffer ownership transfer, numeric colour mapping, invalid data, and worker failures.

## What the map means

- **Download speed** colours tile locations by the average download speed in Mbps. Hover or tap a point for download and upload values.
- **Record density** is a relative density of loaded tile records in the current view. It does not represent speed, test counts, or coverage.
- The counter reports loaded **tile records**, not individual Speedtest measurements.
- Points derive from zoom-level-16 tiles (about 610.8 metres across at the equator). Circle size is a display choice, not the tile footprint.
- The map does not distinguish operators or 4G/5G. Missing records do not imply missing coverage.
- The source period is not documented in the prepared files. Do not interpret these as current network speeds.

Ookla source: https://github.com/teamookla/ookla-open-data.
Prepared files: https://github.com/Kirman442/deckgl/tree/main/ookla.
The preparation script and source period should be documented before updating the dataset.

## Data contract

Each Parquet file contains a `binary_data: List<Float32>` column with schema metadata:

- `stride: 6`
- `columns: x,y,id,avg_d_kbps,avg_u_kbps,country_code`

Packed records contain longitude, latitude, record ID, download kbps, upload kbps, and numeric country code. All list rows and all Arrow record batches are processed. Incompatible layouts, null data, invalid coordinates, or negative/non-finite speeds are reported as file failures.

## Processing and memory

1. A pool of 1–4 module Web Workers, sized by hardware concurrency, fetches the Parquet files.
2. The app fetches and compiles the WASM asset once, then shares the compiled WebAssembly.Module with the Workers. Each Worker instantiates it with its own memory, decompresses and decodes Parquet, and converts the result to Arrow IPC. Parquet decoding never runs on the UI thread. This avoids separate WASM downloads per Worker on a cold visit.
3. Workers retain views into the existing Arrow numeric buffers rather than repacking six-field records. They validate the values and prepare four RGBA colour buffers.
4. Unique ArrayBuffers are transferred to the UI thread, moving ownership without structured-clone copies.
5. Each chunk remains independent. ScatterplotLayer receives interleaved binary positions (24-byte stride) and binary colours. Loaded source arrays are never repeatedly concatenated.
6. Density mode uses one logical chunk index across all files to aggregate records together. It generates position attributes through deck.gl accessors; separate country heatmaps would give incorrect overlapping densities.

This is **not end-to-end zero-copy**. Parquet decompression allocates data in WASM memory. `intoIPCStream()` serializes/copies data into JavaScript memory, colours require new arrays, and WebGL uploads data to GPU memory. The zero-copy parts are the Arrow numeric views and Worker-to-UI ownership transfer. A future Arrow FFI implementation could remove IPC serialization, but WASM memory lifetime and transfer constraints need separate validation; no SharedArrayBuffer or cross-origin isolation is required here.

Final CPU data uses approximately 40 bytes per record: 24 for source values and 16 for four colour palettes, excluding IPC metadata, WASM memory, temporary decoding allocations, and GPU buffers.

Download colours interpolate through 0, 50, 100, 250, 500, and 2000 Mbps. Each stop has one colour; values above the maximum clamp to the final colour. The legend uses the same non-uniform stop positions. There is no speed multiplier.

Point radius is 200 metres, with no minimum screen-pixel radius. An overview therefore retains small points instead of painting every record as a full-pixel disc. Point size and colour contrast are separate controls; multiplying speed values to reduce clutter would make the numeric legend misleading.

## Performance comparison

Compare the production site with the deploy **permalink**, not just the pull-request preview URL. Netlify's Deploy Preview URL adds its collaboration drawer and related requests; the deploy permalink does not. Keep cache settings, viewport, layer, map style and network throttling identical. Repeat runs and measure dataset/render readiness as well as navigation events: DOMContentLoaded and Load do not mean the asynchronous dataset has finished loading. Resource size is a network/decompressed-resource metric, not a measurement of application RAM.

## Failure handling

Progress counts processed files, including failures. Failed files remain visible in an error panel; successfully loaded data stays available. Retry reloads the dataset. Fetches and worker tasks have time limits; fatal worker errors reject queued work rather than leaving the loader hanging. Workers terminate after loading and on component cleanup.

## Deployment

Netlify is linked to `Kirman442/mobile-network-map`:

- production branch: `main`;
- pull requests against `main`: Deploy Preview;
- other branches are not deployed independently;
- build command: `npm run build`;
- publish directory: `dist`.

Use a feature branch and pull request, validate its Netlify preview, then merge only after approval. Pushing/merging to `main` triggers production deployment.

`npm run deploy` is a legacy GitHub Pages command, not the Netlify deployment command. The legacy workflow under `.github_res/workflows` is inactive. `src/components/dev` contains local ignored experiments and is not part of the application.

Hashed assets have immutable caching. Netlify headers assign the correct JS/CSS/WASM content types; no blanket WASM content type is applied to all assets.
