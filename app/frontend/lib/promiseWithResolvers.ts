// pdf.js (и его legacy-сборка) вызывает Promise.withResolvers, а его нет до Safari 17.4 и Chrome 119.
// Для воркера pdf.js тот же полифил - public/promise-with-resolvers.mjs.
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

export {};
