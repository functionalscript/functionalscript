# Emergent Testing Framework

This framework discovers and runs **proofs**: plain FunctionalScript values that
verify behaviour. There is no `describe`/`it`/`expect` API — a proof is just a
function or an object tree, so it can be imported, composed, and inspected like
any other value.

## Concepts

Three terms are used precisely throughout this document:

- **Proof** — the value a module exports under the name **`proof`**. It is a
  tree whose leaves are test cases: either a single zero-argument function, or
  an object/array containing more such trees.
- **Test case** (or just *test*) — a single zero-argument function (`f.length === 0`)
  inside a proof. It is the unit that passes or fails: it **passes** if it
  returns normally and **fails** if it throws (inverted for [throw tests](#throw-tests)).
- **Proof module** — a module that exports `proof`. This is the unit of
  *discovery*: the framework decides what to run by asking "does this module
  export a `proof`?", never by filename alone.

## Installation

Install from npm:

```sh
npm install functionalscript
```

or from JSR (Deno):

```sh
deno add jsr:@functionalscript/functionalscript
```

## Running proofs

### `fjs t` (built-in runner)

FunctionalScript's own runner discovers all proof modules automatically — no
entry file required:

```sh
fjs t
```

### External runners (Node, Bun, Deno, Playwright)

External runners need an entry file that, when loaded, discovers every proof
module and registers each test case with the active runner. The package ships a
ready-made one — re-export it with a bare side-effect import:

```ts
// all.test.ts
import 'functionalscript/fs/emergent_testing/all.test.js'
```

`all.test.ts` is the recommended name, but any name works as long as the runner
loads it — most pick up `*.test.ts` / `*.test.js` by default.

Then invoke the runner:

- `node --test`
- `bun test`
- `deno test --allow-read --allow-env`
- `npx playwright test`

You can also implement your own runner, as long as it follows the proof-tree
conventions described below.

## Design: dependency-free proofs

Unlike most test frameworks (Jest, Mocha, Vitest, …), a proof does **not** import
anything from the test framework (though it may import the module under test or
other helpers). Because a proof is an ordinary value, it is:

- **runner-agnostic** — the same proof runs under any compatible runner without
  modification;
- **dependency-free** — it stays a pure FunctionalScript module with no
  test-framework imports.

## Discovery: the `proof` export

A module is a proof module **if and only if it exports `proof`**. Discovery is by
*value* — the framework asks "does this module export a `proof`?" — so a filename
alone never causes a module to be executed as a proof.

To answer that question the framework must first load the module. It does so in
two tiers:

| Language | Load gate |
|----------|-----------|
| FunctionalScript (`.f.ts` / `.f.js`) | **all** files are loaded — FS modules have no import side effects by construction |
| Vanilla TypeScript / JavaScript | opt-in by filename: names ending in `proof.ts`, `proof.js`, `proof.mts`, or `proof.mjs` (e.g. `math.proof.ts`) |

A loaded module that does not export `proof` is silently skipped.

This split is intentional: keeping "is this a proof module?" a property of the
module's *value* rather than its *path* means proofs stay self-describing even
when files are stored by content hash (no stable filename) in a Merkle DAG, or
when source is published and copied as text. The filename gate exists only for
vanilla JS/TS, which — unlike FunctionalScript — may run side effects at import
time and so cannot be loaded indiscriminately.

## Writing proofs

The `proof` export is the proof tree. It is a plain value — no framework import
required. The simplest proof is a single test case:

```ts
export const proof = {
    myTest: () => 42,                  // passes — returns normally
    failing: () => { throw 'oops' },   // fails — throws
}
```

A zero-argument function is a test case. Functions that declare parameters are
ignored and never called.

### Nested objects

Objects and arrays are traversed recursively. Each key becomes a path segment in
the output. Only **own enumerable keys** are visited (as returned by
`Object.entries`); prototype properties are excluded.

```ts
export const proof = {
    math: {
        add: () => { if (1 + 1 !== 2) throw '1 + 1 !== 2' },
        mul: () => { if (2 * 2 !== 4) throw '2 * 2 !== 4' },
    },
    suite: [
        () => { if (typeof '' !== 'string') throw 'expected string' },  // path: suite[0]
        () => { if (typeof 0  !== 'number') throw 'expected number' },  // path: suite[1]
    ],
}
```

### Throw tests

A node named `throw` (or nested inside one) marks test cases that are **expected
to throw**: such a case passes if the function throws and fails if it returns
normally.

```ts
export const proof = {
    throw: {
        divByZero: () => { throw new Error('division by zero') },  // passes
        noThrow: () => 42,                                          // fails
    },
}
```

The `throw` key can appear at any depth; every test case reachable through it
inherits the throw expectation. For example,
`import('proof.ts').proof[5].throw.my()` is a throw test because `throw` appears
in its path. Because the expectation is encoded in the path, no separate marker
is needed in the output — `fjs t` appends `# EXPECTED TO THROW` to such a case
when it passes.

### Return value as a sub-tree

When a non-throw test case returns an object or another function, the return
value is walked as a fresh proof sub-tree. This allows lazy or computed trees:

```ts
export const proof = {
    computed: () => ({
        nested: () => 99,   // discovered and run after `computed()` returns
    }),
}
```

This is how tests are generated dynamically — one named case per input:

```ts
const cases: readonly [number, number, number][] = [[1, 1, 2], [0, 0, 0], [2, 3, 5]]

export const proof = {
    add: () => Object.fromEntries(
        cases.map(([a, b, expected]) => [
            `${a}+${b}`,
            () => { if (a + b !== expected) throw `${a}+${b} !== ${expected}` },
        ])
    ),
}
```

Only **return values** of non-throw test cases are walked. Thrown values are
discarded and never traversed, even if they are objects containing zero-parameter
functions.

### Async tests

A test case may be `async`. The framework awaits the returned `Promise`: the case
passes if it resolves and fails if it rejects. The resolved value is then walked
as a sub-tree, exactly like a synchronous return value:

```ts
import { readFile } from 'node:fs/promises'

export const proof = {
    readSelf: async () => {
        const text = await readFile('package.json', 'utf8')
        if (!text.includes('"name"')) throw text
    },
}
```

## Convention: only real Promises are awaited

When a test case returns a value, the framework checks `value instanceof Promise`
to decide whether to await it. Only genuine `Promise` instances are awaited;
plain *thenables* — objects with a `.then` method that are not `instanceof Promise`
— are treated as ordinary return values and walked as sub-trees.

This is intentional. FunctionalScript does not allow direct `Promise`
construction; `Promise` objects only arise as the return value of `async`
functions (an Effect). A plain `{ then: f }` object in FunctionalScript is almost
certainly a data value, not an async operation, and awaiting it would be
surprising.

As a consequence, **exporting a function named `then` from a proof module is
forbidden**: the module namespace object would become a thenable, corrupting
dynamic `import()` resolution. See
[issues/lang/3240-export.md](../../issues/lang/3240-export.md).

## Proof location and scope

A proof's *location* determines what it can see. Three tiers exist:

| Mechanism | Scope | Runs when | Use for |
|-----------|-------|-----------|---------|
| Module-level `assertEq(...)` | public + private | **every module load** | light, cheap, deterministic checks only |
| `export const proof` co-located in a module | public + private | under the runner | [white-box](https://en.wikipedia.org/wiki/White-box_testing) unit proofs |
| Separate module exporting `proof` | public API only | under the runner | [black-box](https://en.wikipedia.org/wiki/Black-box_testing) / integration |

**Module-level asserts** (e.g. `assertEq(2 + 2, 4)` at the top level of a module)
run on *every import*, not just during a proof run. Restrict them to light, cheap,
deterministic checks — never stress tests or benchmarks, since that cost is paid
on every module load.

**Co-located `export const proof`** shares the module's lexical scope, including
unexported bindings, enabling white-box unit proofs without widening the public
API. Note that `proof` is itself a real export and therefore visible in the
module's public types and runtime bundle; declaring it `unknown`
(`export const proof: unknown = …`) hides the type surface while keeping the
runtime value in place.

**A separate proof module** can reach only the subject module's public exports,
making it suitable for black-box and integration proofs that should not depend on
internal structure.
