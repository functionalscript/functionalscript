// A test that returns a thenable (Promise-like object, not a real Promise).
// Per FunctionalScript convention, thenables are treated as plain values —
// not awaited. Both sandbox (fjs) and registerModule (node/bun/deno/playwright)
// must exit 0: the thenable object is walked as a sub-tree whose only key
// `then` is a function with parameters, so no leaf tests are found and the
// test trivially passes.
export const thenableResolves = () => ({
    then(resolve: (v: undefined) => void) { resolve(undefined) }
})
