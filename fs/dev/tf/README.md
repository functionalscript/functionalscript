# Test Framework

## Running tests

### `fjs t` (built-in runner)

FunctionalScript's own runner discovers all proof modules automatically — no entry file required:

```sh
fjs t
```

### External runners (Node, Bun, Deno, Playwright)

For external runners, create a file the runner will pick up (e.g. `*.test.ts`, which Node/Bun/Deno/Playwright all load by default):

```ts
import { run } from 'functionalscript/fs/dev/tf/module.js'
await run()
```

Then invoke the runner:

- `node --test`
- `bun test`
- `deno test --allow-read --allow-env`
- `npx playwright test`

## Design: Dependency-Free Tests

Unlike most test frameworks (Jest, Mocha, Vitest, …), test files do **not** import anything from the test framework. A test is just a plain function or object — no `describe`, `it`, `expect`, or assertion library required. This means:

- Tests are **runner-agnostic**: the same test file can be run by any compatible runner without modification.
- Tests have **no framework dependency**: they remain pure FunctionalScript modules and can be imported, composed, or inspected like any other module.

## Writing Tests

### Discovery: the `proof` export

A module is treated as a test module if and only if it exports a property named **`proof`**. Discovery is by value — "does the module export `proof`?" — not by filename alone.

The framework loads modules in two tiers:

| Language | Load gate |
|----------|-----------|
| FunctionalScript (`.f.ts` / `.f.js`) | **all** files are loaded — FS modules have no import side effects by construction |
| Vanilla TypeScript / JavaScript | opt-in by filename: files whose name ends in `proof.ts`, `proof.js`, `proof.mts`, or `proof.mjs` (e.g. `math.proof.ts`, `proof.ts`) |

A loaded file that does not export `proof` is silently skipped; filename alone never causes a file to be executed as a test suite.

This design is intentional: keeping "is this a proof?" as a property of the *module's value* rather than its path means proofs remain self-describing even when files are stored by content hash (no stable filename) in a Merkle DAG.

### The `proof` export

The named export `proof` is the test tree. A **leaf test** is a zero-argument function (`f.length === 0`); functions with parameters are ignored and not called.

```ts
export const proof = {
    myTest: () => 42,                      // passes — returns normally
    failing: () => { throw 'oops' },       // fails — throws
}
```

### Nested objects

Objects (and arrays) are traversed recursively. Each key becomes a path segment in the output:

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

The `throw` key can appear at any depth; all tests reachable through it inherit the throw expectation. For example, `import('proof.ts').proof[5].throw.my()` is considered a throw-test because `throw` appears in its path.

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

## Proof location and scope

A proof's *location* determines what it can see. Three tiers exist:

| Mechanism | Scope | Runs when | Use for |
|-----------|-------|-----------|---------|
| Module-level `assertEq(...)` | public + private | **every module load** | light, cheap, deterministic checks only |
| `export const proof` co-located in module | public + private | under the runner | white-box unit proofs |
| Separate module exporting `proof` | public API only | under the runner | black-box / integration |

**Module-level asserts** (e.g. `assertEq(2 + 2, 4)` at the top level of a module) run on *every import*, not just during a test run. They must be restricted to light, cheap, deterministic checks — never stress tests or benchmarks, as that cost is paid on every module load.

**Co-located `export const proof`** shares the module's lexical scope, including unexported bindings, enabling white-box unit proofs without widening the public API. Note that `proof` itself is a real export and therefore visible in the module's public types and runtime bundle; declaring it as `unknown` (`export const proof: unknown = { … }`) mitigates the type-surface exposure while keeping the runtime value in place.

**A separate `*.proof.f.ts` module** (or any other separately loaded proof file) can only reach the subject module's public exports, making it suitable for black-box and integration proofs that should not depend on internal structure.
