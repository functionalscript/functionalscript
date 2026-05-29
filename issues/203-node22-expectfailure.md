# 203. Node 22: `expectFailure` and `--experimental-strip-types`

## Problem

Node 22 has two issues with the current test infrastructure:

1. **`expectFailure` not handled.** The native `testContext` passes `{ expectFailure }` as
   an options object to `node:test`'s `test()`. Node 22 ignores unknown options, so tests
   marked `throws: true` run normally — if they throw, the node runner records them as
   failures instead of passes. Bun and Playwright avoid this because they go through
   `inlineTest`, which handles `expectFailure` manually. The native `testContext` has no
   such wrapper.

2. **`--experimental-strip-types` required.** Node 22 does not natively strip TypeScript
   types; the flag is needed in `package.json`'s `test` and `index-html` scripts. Node 24+
   strips types without any flag.

## Solutions

### Option A — Drop Node 22

Bump `engines.node` to `>=24` and remove `--experimental-strip-types` from all scripts.
Node 24 and Node 26 are the only supported targets; no code changes to the test framework
are needed.

Cloudflare Pages runs the build command (`npm run website` → `node ./fs/fjs/module.ts …`)
in its own Node.js environment. Dropping Node 22 requires pinning that environment to
Node 24+ via a `.node-version` file in the repo root.

**Pros:** no additional complexity; `--experimental-strip-types` disappears entirely.  
**Cons:** users still on Node 22 get a hard engine mismatch on install; Cloudflare build
environment must be explicitly pinned.

### Option B — Fix `expectFailure` for Node 22

Wrap `testContext` with `inlineTest` the same way `bunTestContext` does:

```ts
const nodeTestContext: TestContext = {
    test: (name, opts, fn) => testContext.test(name, () => inlineTest(name, opts, fn))
}
```

Keep `--experimental-strip-types` in the scripts and `engines.node` at `>=22`.

**Pros:** Node 22 users can still run tests correctly.  
**Cons:** `nodeTestContext` becomes a third special case alongside `bunTestContext` and
`playwrightTestContext`; `--experimental-strip-types` stays in the scripts permanently
until Node 22 falls out of use.

## Related

- [i201](./201-bun-inline-context.md) — `inlineTest` / `bunTestContext` pattern that
  Option B would replicate for Node
- [i202](./202-playwright-context.md) — same pattern applied to Playwright
