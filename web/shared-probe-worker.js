self.onmessage = event => {
  const cells = new Int32Array(event.data);
  Atomics.store(cells, 0, 42);
  self.postMessage(Atomics.load(cells, 0));
};
