// Временно: Minimal parquetWorker.js for testing
self.onerror = function (e) {
    console.error('--- Minimal Worker: Error caught by onerror:', e);
};
console.log('--- Minimal Worker: Script started!');

self.onmessage = function (e) {
    console.log('--- Minimal Worker: Received message in minimal worker:', e.data);
    // Не делаем ничего сложного, не импортируем библиотеки, не фетчим
    self.postMessage({ success: true, message: 'Minimal worker received message' });
};
// Конец Minimal parquetWorker.js