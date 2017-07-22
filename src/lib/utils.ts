export function promiseFromCallback<T>(next: (next: (err: Error | null, value?: T) => any) => any): Promise<T> {
  return new Promise<T>(function(resolve, reject) {
    next(function(err, value) {
      if(err) {
        return reject(err);
      }
      resolve(value);
    });
  });
}