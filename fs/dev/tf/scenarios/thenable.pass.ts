// A test that returns a thenable (Promise-like object) that resolves.
// Both sandbox (fjs) and registerModule (node/bun/deno/playwright) should exit 0.
export const thenableResolves = () => ({
    then(resolve: (v: undefined) => void) { resolve(undefined) }
})
