// Воркер pdf.js для FileViewer: модули выполняются по порядку импорта - сначала полифил, потом сам воркер.
import './promise-with-resolvers.mjs';
import './pdf.worker.min.mjs';
