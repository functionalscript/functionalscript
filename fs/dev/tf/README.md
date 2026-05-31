# Test Framework

To enable testing in your project, add a test runner file `all.test.ts` like this:

```ts
import { run } from 'functionalscript/fs/dev/tf/module.js'

await run()
```

And then run it with any supported runner:

- `fjs t` (FunctionalScript's own runner),
- `node --test`,
- `bun test`,
- `deno test --allow-read --allow-env`,
- `npx playwright test`.

## Design: Dependency-Free Tests

Unlike most test frameworks (Jest, Mocha, Vitest, …), test files do **not** import anything from the test framework. A test is just a plain function or object — no `describe`, `it`, `expect`, or assertion library required. This means:

- Tests are **runner-agnostic**: the same test file can be run by any compatible runner without modification.
- Tests have **no framework dependency**: they remain pure FunctionalScript modules and can be imported, composed, or inspected like any other module.

## Writing Tests

### File naming

A test file must export a `proof` property (see below). The framework loads:

- **Any** `.f.ts` / `.f.js` file (FunctionalScript modules are side-effect-free by construction).
- Vanilla TypeScript/JavaScript files whose name ends in `proof.ts`, `proof.js`, `proof.mts`, or `proof.mjs` — e.g. `math.proof.ts` or `proof.ts`.

A loaded file is only executed as a test if it exports a `proof` property; all other files are silently skipped.

### The `proof` export

The named export `proof` is the test tree:

```ts
export const proof = {
    myTest: () => 42,         // passes — returns normally
    failing: () => { throw 'oops' },  // fails — throws unexpectedly
}
```

### Nested objects

Objects are traversed recursively. Each key becomes a path segment in the output:

```ts
export const proof = {
    math: {
        add: () => 1 + 1,
        mul: () => 2 * 2,
    },
}
```

### Throw tests

A node named `throw` (or nested inside one) marks tests that are **expected to throw**. The test passes if the function throws, and fails if it returns normally:

```ts
export const proof = {
    throw: {
        divByZero: () => { throw new Error('division by zero') },  // passes
        noThrow: () => 42,                                          // fails
    },
}
```

A function whose `.name` property is `'throw'` is also recognised as a throw-test regardless of its position in the tree. Because `throw` is a reserved word it cannot be used as a variable name directly; the typical way to obtain such a function is via object property access:

```ts
const t = { throw: () => { throw 'expected' } }.throw
export const proof = { b: t }   // passes — function name triggers throw semantics
```

### Return value as sub-tree

When a non-throw test function returns an object or another function, the return value is walked as a fresh sub-tree. This allows lazy or computed test trees:

```ts
export const proof = {
    computed: () => ({
        nested: () => 99,   // discovered and run after `computed()` returns
    }),
}
```

Only **return values** of non-throw tests are walked as sub-trees, and the `throw` flag always resets to false for the sub-tree. Thrown values are discarded and never traversed, even if they are objects containing zero-parameter functions.

## Convention: only real Promises are awaited

When a test function returns a value, the framework checks `value instanceof Promise` to decide whether to await it. Only genuine `Promise` instances are awaited; plain *thenables* — objects that have a `.then` method but are not `instanceof Promise` — are treated as ordinary return values and walked as sub-trees.

This is intentional. FunctionalScript does not allow direct `Promise` construction; `Promise` objects only arise as the return value of `async` functions (an Effect). A plain `{ then: f }` object in FunctionalScript code is almost certainly a data value, not an async operation, and awaiting it would be surprising.

As a consequence, **exporting a function named `then` from a test module is forbidden**: the module namespace object would become a thenable, corrupting dynamic `import()` resolution. See [issues/lang/3240-export.md](../../issues/lang/3240-export.md).
