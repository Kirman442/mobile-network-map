# High-Performance Web Visualization of Internet Speed Data

## Overview

This project demonstrates a high-performance approach to visualizing large-scale internet speed data (download speeds in kbps) directly in a web browser. By leveraging modern web technologies like **Parquet**, **Apache Arrow**, **Web Workers**, **TypedArrays**, and **Deck.gl**, we overcome the common performance bottlenecks associated with handling and rendering large geospatial datasets using traditional methods like **GeoJSON**.

## Dataset
This dataset contains performance metrics for global mobile broadband networks in the form of Mercator tiles at scale level 16 (approximately 610.8 meters by 610.8 meters at the equator). Upload and download speeds as well as latency times are recorded with the Speedtest by Ookla apps for Android and iOS and averaged for each tile. The measurements are filtered to obtain results with GPS-quality location accuracy.

## The Challenge with Large Datasets in the Browser

Visualizing millions of data points in a web browser often hits performance limits:

* **Slow Parsing**: Text-based formats like JSON (used in GeoJSON) require significant CPU time to parse and deserialize into JavaScript objects.
* **High Memory Usage**: JSON creates many small, scattered objects, leading to memory bloat and increased garbage collection overhead.
* **Inefficient GPU Uploads**: Data from JavaScript objects needs to be converted into a binary format suitable for the graphics card (**GPU**), which is a slow process.
* **UI Freezing**: CPU-intensive data loading and processing block the main browser thread, making the user interface unresponsive.

## Our High-Performance Approach

To tackle these challenges, we implement a processing pipeline designed for speed and efficiency:

1.  **Binary Data Formats**: We start with data stored in **Parquet**, a columnar binary format efficient for storage and reading subsets of columns.
2.  **Apache Arrow for In-Memory Efficiency**: Crucially, Parquet data is loaded and converted into the **Apache Arrow** in-memory format. Arrow is designed for high-performance data processing and, importantly, facilitates Zero-Copy access.
3.  **Zero-Copy Data Access with TypedArrays**: Once data is in the Arrow format in memory (represented by underlying binary buffers), we use JavaScript **TypedArrays** (`Float32Array`, `Uint16Array`, etc.). This allows us to create direct "views" into the binary data buffer. We can access individual numeric values or sequences of values without ever deserializing into standard JavaScript objects like those created from JSON. The **CPU** can work with data directly in its binary form, minimizing overhead – this is the essence of zero-copy parsing.
4.  **Parallel Processing with Web Workers**: The computationally heavy tasks of:
    * Fetching the binary Parquet file.
    * Decompressing the Parquet data.
    * Parsing the Parquet data into Arrow format.
    * Preparing the final `Float32Array` for **GPU** upload.
    are offloaded to **Web Workers**. This prevents the main browser thread from freezing, keeping the UI smooth and responsive. Using a **Worker Pool** allows these tasks to be processed in parallel across multiple **CPU** cores, significantly accelerating overall data loading time. Error isolation in workers also enhances stability.
5.  **Efficient GPU Uploads with Deck.gl**: **Deck.gl**, a **WebGL**-powered visualization library, is highly optimized for rendering large datasets. It can consume **TypedArrays** directly. This allows for **Direct Memory Access (DMA)** uploads of the binary data from system memory straight to **GPU** buffers, bypassing inefficient intermediate steps required for JavaScript objects. Deck.gl then renders these points/shapes efficiently in batches.
6.  **Memory Efficiency & Cache Locality**: Using **TypedArrays** significantly reduces memory footprint compared to creating numerous small JavaScript objects from JSON. Numbers are stored in their native binary representation (e.g., 4 bytes for a `Float32`) rather than as text strings ("12.345"). Furthermore, storing data contiguously in **TypedArrays** (especially in a columnar-like structure derived from Arrow) improves **CPU** cache utilization (**cache locality**), leading to faster data access during processing.

## Key Performance Optimizations Summarized

Based on the techniques above, here's how performance is achieved:

* **Zero-Copy Parsing**: Direct access to binary data buffers via Arrow and **TypedArrays** bypasses the expensive deserialization and object creation overhead of text formats like JSON. Accessing `data[index * 6 + 3]` is dramatically faster and more direct than `feature.properties.speed`.
* **GPU-Friendly Data Structures**: **TypedArrays** (`Float32Array`, `Uint16Array`) map directly to **GPU** buffer formats, enabling fast Direct Memory Access (**DMA**) uploads and efficient batch rendering by **Deck.gl**.
* **Parallel Processing**: **Web Workers** allow **CPU**-bound data loading and processing to run concurrently, preventing UI freezes and reducing perceived load time.
* **Memory Compactness**: Binary formats and **TypedArrays** are significantly more memory-efficient than JSON, reducing memory consumption and **garbage collection (GC)** pressure. Numbers like 123.45 take a fixed 4 bytes in `Float32Array` vs variable bytes + overhead in JSON.
* **Cache Locality**: Contiguous storage of data in **TypedArrays** improves **CPU** cache hit rates during sequential access.

| Parameter                       | Traditional GeoJSON Approach             | High-Performance Binary Approach (Parquet + Arrow + TypedArrays) |
| :------------------------------ | :--------------------------------------- | :--------------------------------------------------------------- |
| Parsing/Loading                 | High overhead $O(N)$ object creation     | Near Zero-copy $O(1)$ access after initial load/conversion       |
| Data Size                       | Larger (text + structural overhead)      | Compact (binary representation)                                  |
| CPU Data Access                 | Property lookup (indirection, scattered) | Direct memory offset (contiguous, cache-friendly)                |
| GPU Upload                      | Requires conversion/copying              | Direct (DMA) from TypedArrays                                    |
| Memory Model                    | Many small, scattered JS objects (GC)    | Few large binary buffers                                         |
| Parallel Processing             | Limited by main thread JS parsing        | Extensive offloading to Web Workers                              |
| UI Responsiveness               | Can freeze during loading/parsing        | Remains responsive due to offloading                             |

## Implementation Details

The project utilizes a **Worker Pool** architecture to manage parallel data loading tasks. A dedicated **Web Worker** (`parquetWorker.js`) handles the binary data fetching, Parquet-to-Arrow parsing, and extraction of the final `Float32Array`. This binary data is then passed efficiently back to the main thread (using [transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)) and provided to various **Deck.gl** layers (e.g., `ScatterplotLayer`, `HexagonLayer`, `HeatmapLayer`) for visualization. UI components, such as a Legend Panel, are built to dynamically interact with the data and chosen color schemes.

## Results

This approach enables smooth, interactive visualization and exploration of hundreds of thousands of data points representing internet speed directly within a web browser, demonstrating a viable strategy for handling large datasets in demanding web-based data visualization applications.