# 202. Playwright test context

## Problem

The `iteration2` rewrite of `fs/dev/tf/module.ts` (i200) removed the Playwright
bridge that existed in the `playwright-node-default` branch. Playwright is now
silently broken: when `PLAYWRIGHT_TEST` is set, the runner still uses `nodeTest`
(from `node:test`) instead of `@playwright/test`, which produces wrong results.

The old bridge detected Playwright via `process.env.PLAYWRIGHT_TEST` and
dynamically imported `@playwright/test`:

```ts
const isPlaywright = typeof process !== 'undefined' && process?.env?.PLAYWRIGHT_TEST !== undefined

const createPlaywrightFramework = async (): Promise<CommonFramework> => {
    const pwTest = (await asyncImport('@playwright/test') as any).test
    return (prefix, f) => f((name, v) => pwTest(`${prefix}: ${name}`, v))
}
```

Like Bun, Playwright does not support nested `test()` calls inside a test
callback. The old bridge used the same flat-registration workaround (prefixed
names). The new architecture uses `inlineContext` for this; Playwright needs the
same treatment as Bun ([i201](./201-bun-inline-context.md)).

## Design

### `Engine`

Add `'playwright'` to the `Engine` union:

```ts
export type Engine = 'node' | 'bun' | 'playwright'
```

### `playwrightTestContext`

Define in `fs/io/module.ts` alongside `bunTestContext`. Playwright's `test()` is
imported dynamically (it requires `@playwright/test` to be installed, which is
not always the case). Detection via `process.env.PLAYWRIGHT_TEST`:

```ts
const isPlaywright = 'PLAYWRIGHT_TEST' in (process?.env ?? {})

const pwTest = isPlaywright
    ? (await import('@playwright/test') as any).test
    : undefined

const playwrightTestContext: TestContext = {
    test: (name, opts, fn) => pwTest!(name, () => inlineTest(name, opts, fn))
}
```

`inlineTest` (already defined in `module.ts`) handles `expectFailure` and
passes `inlineContext` to the thunk — identical to `bunTestContext`.

### `Io` and `NodeProgramOptions`

Add `playwrightTestContext` alongside `bunTestContext`:

```ts
// Io and NodeProgramOptions gain:
readonly playwrightTestContext: TestContext
```

### Detection

```ts
engine: isPlaywright ? 'playwright' : 'Bun' in globalThis ? 'bun' : 'node',
```

### `register`

```ts
export const register: NodeProgram = o => {
    const ctx =
        o.engine === 'bun' ? o.bunTestContext :
        o.engine === 'playwright' ? o.playwrightTestContext :
        o.testContext
    return loadModuleMap(o.env)
        .step(m => registerModuleMap(ctx, m))
        .step(() => pure(0))
}
```

## Scenario test

Add `fs/dev/tf/scenarios/run.sh` support for `playwright`:

```sh
playwright) cmd="PLAYWRIGHT_TEST=1 npx playwright test $repo/fs/dev/tf/all.test.ts" ;;
```

And add a `playwright` column to the scenario matrix in CI.

## Related

- [i201](./201-bun-inline-context.md) — same pattern; `playwrightTestContext`
  reuses `inlineTest` from that implementation
- [i183](./183-tf-framework-scenario-tests.md) — scenario runner; needs a
  `playwright` runner entry
- [i200](./200-register-module.md) — the rewrite that introduced the regression
