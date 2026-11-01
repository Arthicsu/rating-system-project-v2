// Воркер pdf.js (legacy-сборка) вызывает Promise.withResolvers, а его нет до Safari 17.4 и Chrome 119.
// В основном потоке тот же полифил - lib/promiseWithResolvers.ts.
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}
