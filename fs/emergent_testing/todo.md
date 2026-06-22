# TODO

## Test Framework Silent Mode

**Priority:** P3
**Status:** open

Simplify default output of the test framework. By default, show only brief progress (for example, a dot per test or a summary) and list failing tests. Provide a `--verbose` flag to enable the current detailed output.

The old blocker, "translate the test framework to Effects", has landed. Layer
silent/verbose modes on the current effect-based runner.

---

## 028-unit-test-examples-api. Distinguish proofs, examples, and public API coverage

**Priority:** P3
**Status:** open

### Problem

FunctionalScript has several related but different validation/documentation
needs:

- cheap deterministic invariants that should run whenever a module is loaded;
- executable proofs that the emergent testing runner discovers and runs;
- public examples that document how exported API values are intended to be used;
- black-box API coverage that should only depend on public exports.

The old `*test.f.ts` / `*example.f.ts` split does not match the current proof
runner conventions. The repository now discovers proof modules by their
`export const proof` value, while examples still lack a clear convention.

### Proposal

Use these conventions:

- **Module-level assertions** are allowed for tiny, deterministic invariants
  that should run on every import.
- **Executable proofs** use `export const proof = ...`.
  - Co-located `proof` values are white-box unit proofs and may test private
    implementation details.
  - Separate `proof.f.ts` modules are black-box/API proofs and should import
    only the public API.
- **Examples** use `export const examples = ...` in the module that defines the
  public API.

Example keys should match the names of exported values. That gives tooling a
simple invariant: every top-level example group describes a real public export,
and renaming an export forces the matching example name to change too.

```ts
import { assertEq } from '../asserts/module.f.ts'

const normalizeRoot = (s: string): string => s === '' ? '.' : s

export const normalize = (path: string): string => normalizeRoot(path)

assertEq(normalizeRoot(''), '.')

export const examples = {
    normalize: {
        emptyPath: () => assertEq(normalize(''), '.'),
        unchangedPath: () => assertEq(normalize('a/b'), 'a/b'),
    },
}

export const proof = {
    normalizeRoot: {
        empty: () => assertEq(normalizeRoot(''), '.'),
        nonEmpty: () => assertEq(normalizeRoot('a'), 'a'),
    },
}
```

In this example:

- `normalize` is public API.
- `examples.normalize` matches the exported `normalize` name and uses only the
  public function.
- `proof.normalizeRoot` is a white-box proof for a private helper.
- The module-level assertion is intentionally tiny because it runs on every
  import.

### Tasks

- [ ] Define the `export const examples = ...` shape.
- [ ] Decide whether examples are executable by the proof runner, extracted by
  documentation tooling, or both.
- [ ] Add tooling that checks top-level example keys against exported names.
- [ ] Document how examples differ from `export const proof`.
- [ ] Update one small module as the reference example.

### Related

- [i664-file-type-conventions](../../issues/664-file-type-conventions.md) — file naming
  conventions for modules and proof modules.
- [i668-emergent-testing-proof-type](todo.md) —
  explicit proof-tree type.

---

## 29. Test in a browser.

**Priority:** P3
**Status:** open

It's important for such browsers as Firefox because we don't have SpiderMonkey as a CLI.

---

## 36. Test framework for a browser.

**Priority:** P3
**Status:** open

We should have an HTML file (e.g., `./dev/test.html`) that can be opened in a browser.

---

## 140. 100% test coverage for all `module.f.ts` files.

**Priority:** P3
**Status:** open

We should have 100% test coverage for all `module.f.ts` files.

---

## 194. Design for test effects:

**Priority:** P3
**Status:** open

```ts
// Register the test for external test-frameworks (Node, Deno)
type RunTest<H, O extends Operation> = (name: TestName, test: (h: H) => Effect<O, void>)
// Register the test for Node, Deno and run the test for Bun and Playwright
type RunSubTest<H> = (h: H, name: TestName, test: () => void) => void
```

---

## 65Z-singleton-effect. Singleton effect to prevent duplicate proof execution

**Priority:** P3
**Status:** open

### Problem

When the same module is reachable under more than one path — due to hard links,
copies, or a test runner discovering both the original and a generated alias —
its `proof` export is executed multiple times in the same process. This wastes
time and can produce confusing duplicate output.

#### Concrete example: scenario runner

`run.sh` hard-links `all.ts` → `_all.test.ts` and a scenario file →
`_scenario.proof.ts`, then runs a test framework (node, bun, deno, playwright)
in the `scenarios/` directory. If the framework scans the directory it may
discover **both** `all.ts` and `_all.test.ts` (both end in `.ts` and both
export a `run()` call). Each discovered file loads and executes the module
independently under its own resolved path — Node.js caches by resolved URL,
not by inode — so the proof suite runs twice.

The same issue would arise if `all.ts` were copied to multiple locations for
use in different test environments.

### Proposal: a `singleton` effect

Add a `singleton` effect operation that a module can call before registering
its proofs. The effect checks whether a given key has already been registered
in the current process and, if so, returns without doing anything.

```ts
// usage in all.ts or any entry-point module
export const run = singleton('./fs/emergent_testing/all')(realRun)
```

#### Semantics

```
singleton(key)(effect) ->
    if key already seen in this process: pure(undefined)
    else: mark key as seen, then run effect
```

#### Implementation sketch

The singleton registry needs to survive across module reloads and be shared
by all instances of the same logical entry point. The natural place is
`globalThis`:

```ts
const registry: Set<string> = (globalThis as any).__fsRegistry ??= new Set()

export const singleton =
    (key: string) =>
    <O, A>(effect: Effect<O, A>): Effect<O, A | undefined> =>
        registry.has(key) ? pure(undefined) : begin
            .step(() => { registry.set(key); return effect })
```

The key should be stable across hard links and copies — a logical name
(e.g. the module's canonical import path relative to the repo root), not
`import.meta.url`, which would differ per copy.

#### Alternative: module-level `Set` in a shared registry module

ES modules are **singletons per resolved URL**: a module is evaluated exactly
once and its exports are shared by all importers that resolve to the same URL.
A dedicated registry module can exploit this:

```ts
// ./fs/emergent_testing/registry.f.ts
export const seen = new Set<string>()
```

Any entry-point module imports `seen` from the canonical registry URL. Because
the registry module is loaded once, `seen` is shared across all importers —
even if the entry-point itself is loaded under multiple paths (hard links,
copies). No `globalThis` pollution needed.

```ts
// all.ts
import { seen } from './registry.f.ts'
import { run } from './module.ts'

if (!seen.has('all')) {
    seen.add('all')
    await run()
}
```

This is the simplest approach and requires no new effect type. The trade-off
is that it only works when all copies share the same `registry.f.ts` URL —
which holds for hard links in the same directory tree, but not for copies in
entirely separate trees.

#### Alternative: inode-based deduplication

The effect runner could detect hard-linked files by comparing inodes before
importing them. This requires a `stat()` call per file and is specific to
Unix; it does not generalise to copied files or other runtimes (Deno, Bun,
browsers).

#### Alternative: avoid the problem in run.sh

Instead of hard-linking `all.ts` → `_all.test.ts`, `run.sh` could use a
wrapper file that only imports `_scenario.proof.ts` and does not re-export
`all.ts`. This avoids the duplication for the scenario case but does not
address the general problem.

### Related

- [i65Z-ci-scenario-docker](../ci/todo.md) — CI scenario job; duplicate execution is a latent issue when multiple runners scan the same directory
- i183 — scenario test infrastructure

---

## 65Z-tf-test-tree-walker. `fs/emergent_testing`: share the test-tree walker between `runModule` and `registerModule`

**Priority:** P4
**Status:** open

### Problem

`fs/emergent_testing/module.f.ts` already factors out the static collection step into
`collectTests` (lines 116-128), which walks the export tree and returns a flat
list of `[path, TestEntry]` pairs. Both downstream consumers — `runModule` and
`registerModule` — then independently re-implement the *dynamic* walk of each
test's return value:

```ts
// registerModule (./fs/emergent_testing/module.f.ts:154)
const registerOne = (ctx: TestContext, [path, { fn, throws }]: TestAndPath) =>
    test(ctx, fmtImport(k, path), throws, (t): Effect<Test | All | Await, void> =>
        awaitIfPromise(fn())
        .step(resolved => {
            if (throws) { return pure(undefined) }
            const sub = collectTests([...path, null], false, resolved)
            if (sub.length === 0) { return pure(undefined) }
            return all(...sub.map(e => registerOne(t, e))).step(() => pure(undefined))
        }))

// runModule (./fs/emergent_testing/module.f.ts:175)
const one = ([testPath, set]: TestAndPath): Effect<O | All, TestState> =>
    test(k, testPath, set)
    .step(sr => {
        const { result: [s, r], duration } = sr
        return result(k, testPath, sr)
        .step((): Effect<O | All, TestState> => {
            if (s === 'ok') {
                if (set.throws) { return pure(addPass(duration)(zero)) }
                return walk([...testPath, null], false, r)
                .step(sub => pure(mergeState(addPass(duration)(zero), sub)))
            }
            return pure(addFail(duration)(zero))
        })
    })
const walk = (path: Path, throws: boolean, v: unknown): Effect<O | All, TestState> => {
    const effects = collectTests(path, throws, v).map(one)
    return all(...effects)
    .step(states => pure(states.reduce(mergeState, zero)))
}
```

Both implementations:

1. Take a `TestAndPath` for the current leaf.
2. Execute the leaf (`fn()` directly or via `sandbox` inside `test`).
3. On success-without-`throws`, take the resolved return value, hand it back
   through `collectTests([...path, null], false, resolved)`, recurse into each
   sub-leaf, then `all(...)` the results.
4. Have a "neutral" continuation when the sub-list is empty.

The control flow is the same; the per-leaf reducer differs (build a
`SandboxResult`-aware `TestState` accumulator vs. just register the test with
the framework).

`registerModule` (the Bun/Playwright path) explicitly cannot reuse `runModule`'s
`Reporter<O>` because of the external-framework constraint discussed in the
module doc (lines 144-153). But the *traversal* (collect leaves, recurse into
function-return sub-trees, fan out with `all`) is shared and decouples cleanly
from the per-leaf action.

### Proposal

Lift the traversal into a single `walkTests` combinator parameterized over the
per-leaf action and the accumulator merge:

```ts
// ./fs/emergent_testing/module.f.ts (sketch)

type Walker<O extends Operation, S> = {
    /** What to do at a single leaf. May return a sub-tree value to recurse into. */
    readonly onLeaf: (entry: TestAndPath) =>
        Effect<O, readonly [accumulator: S, subtreeValue: { has: true, v: unknown } | { has: false }]>
    /** Combine sibling accumulators. */
    readonly merge: (a: S, b: S) => S
    readonly zero: S
}

export const walkTests = <O extends Operation, S>(w: Walker<O | All, S>) => {
    const walk = (path: Path, throws: boolean, v: unknown): Effect<O | All, S> =>
        all(...collectTests(path, throws, v).map(entry =>
            w.onLeaf(entry).step(([sAcc, sub]) =>
                sub.has
                    ? walk([...entry[0], null], false, sub.v).step(s2 => pure(w.merge(sAcc, s2)))
                    : pure(sAcc))))
        .step(states => pure(states.reduce(w.merge, w.zero)))
    return walk
}
```

`runModule` instantiates `S = TestState`, threads `Sandbox`/`Reporter` effects
in `onLeaf`, and returns the sub-tree value on success-without-`throws`.

`registerModule` instantiates `S = void`, registers via the `TestContext` in
`onLeaf`, and returns the sub-tree value the same way (the registered callback
itself becomes the recursion driver).

The exact `Walker` shape is open — it may be cleaner to split "should we
recurse?" from "give me the sub-tree value" so the abstraction doesn't force a
boolean discriminator. The point is the recursion shape (collect → fan-out →
merge) lives in one place.

### Why this qualifies

- **DRY at the right altitude.** `collectTests` already names the static walk;
  this names the dynamic one. Two consumers exist today and a third — a
  reporter that produces JSON, a coverage instrumenter, an alternative
  external framework — would otherwise be the third copy.
- **Separation of concerns.** The recursion structure (fan-out, merge, when
  to stop) is one concern; the per-leaf action (sandbox+reporter vs.
  framework registration) is another. Today they're entangled inside two
  near-identical functions.
- **Documents the contract.** The "function-return sub-tree is walked the
  same way as the static export tree, with `throws` reset to `false` and a
  `null` marker appended to the path" rule is currently a comment in
  `runModule` (lines 187-188). Lifting it into a shared `walkTests` makes
  the rule the API, not a convention to be reproduced.

### Caveats

- `registerModule`'s recursion happens *inside* a `test()` callback, so the
  child registration uses `t` (the inner `TestContext`), not `ctx`. The
  walker needs to carry whatever per-recursion context the leaf action
  produced — i.e. `onLeaf` may need to return a "child context" alongside
  the accumulator. This may complicate the signature enough that the
  abstraction stops feeling like a win; a small spike will tell.
- `runModule` measures per-leaf `duration` from `SandboxResult` and folds it
  into `TestState`; `registerModule` doesn't care. The walker must not
  pretend to own this — it stays inside `onLeaf`.
- This is a single-consumer module today (`registerModule` and `runModule`
  are the only two in-repo callers of the pattern). Per `AGENTS.md`'s
  speculative-code rule, ship this only when the abstraction makes the
  *existing* two implementations shorter and clearer, not on the promise of
  a third consumer.

### Related

- i183 — broader work on the `tf`
  framework; this is a structural cleanup that lands cleanly alongside it.
- [i157](../djs/todo.md) — same flavour: two parallel
  walkers over the same static shape, differing in the per-node action.

---

## 65Y-proof-assertEq-adoption. Adopt `assert`/`assertEq` across `proof.f.ts` files

**Priority:** P4
**Status:** open

### Problem

`fs/dev/module.f.ts` exports two test helpers:

```ts
export const assert: (v: boolean, msg?: unknown) => asserts v =
    (v, msg = 'assertion failed') => { if (!v) throw msg }

export const assertEq = <T>(a: T, b: T): void => assert(a === b, [a, b])
```

…but the codebase's `proof.f.ts` files mostly do not use them. The
prevailing pattern is hand-rolled per-line:

```ts
if (result !== '[1,20,300]') { throw result }
if (cmp('apple')('banana') !== -1) { throw 3 }
if (uint(s) !== 0x68656C6C_6F20776F_726C64n) { throw s }
```

Counts in the current tree:

- ~1,623 `if (...) { throw ... }` lines across `fs/**/proof.f.ts` —
  the dominant assertion style.
- Only 4 files import `assertEq`: `fs/sul/proof.f.ts`,
  `fs/sul/level/hash/proof.f.ts`, `fs/sul/id/proof.f.ts`,
  `fs/sul/id/module.f.ts`.
- ~40 of the manual sites throw bare string literals
  (`throw 'error'`, `throw 'Error'`) that carry no actual context —
  worse than `assertEq`'s `[a, b]` pair on failure.

The mechanical translation is one-to-one:

```ts
if (x !== expected) { throw x }                 // before
assertEq(x, expected)                            // after — same failure mode + context
```

The "what was the actual value vs. the expected value" question is
exactly what `assertEq`'s `throw [a, b]` payload answers, and it does
so without each site having to remember to include both in the throw
message.

### Proposal

A migration that proceeds folder-by-folder, not all at once:

1. **Pilot** — pick one moderately-sized `proof.f.ts` (e.g.
   `fs/types/string/proof.f.ts` or `fs/types/array/proof.f.ts`) and
   rewrite every `if (x !== expected) { throw x }` to `assertEq(x, expected)`.
2. **Validate** — run `npx tsc`, `npm test`, and `npm run fst` from
   that folder. Confirm test output is at least as useful on
   intentional failures (intentionally break one assertion to read
   the failure message).
3. **Expand** — propagate to the rest of `fs/types/*`, then `fs/text/*`,
   `fs/json/*`, `fs/djs/*`, etc., one folder per PR. No mixing the
   refactor with behaviour changes.

Optional second helper for the remaining shapes:

```ts
// fs/dev/module.f.ts — adds nothing if you also have `assertEq`,
// but makes intent obvious at the call site for non-`===` comparisons.
export const assertNot = (a: unknown, b: unknown): void => assert(a !== b, ['equal', a, b])
```

If the call site needs a richer message (e.g.
`throw \`lx: ${lx}\``, `throw [actual, expected, context]`), keep the
hand-rolled form — `assertEq` is not a hammer for every assertion.
Aim for the simple `if (x !== expected) { throw x }` pattern first;
it's by far the most common and the lowest-judgement case.

### Why this qualifies

- **DRY at extreme volume.** ~1,623 spellings of the same three-token
  conditional throw. Even partial adoption (e.g. the ~60% that are
  exactly `if (x !== expected) { throw x }`) deletes hundreds of
  redundant patterns and replaces them with a single call.
- **Failure-message quality goes up.** `throw [a, b]` always includes
  both sides of the comparison. Today's `throw 0` / `throw 1` /
  `throw 'error'` sites lose the actual value entirely, which forces
  re-running with `console.log` to debug. The 40 bare-string throws
  in particular are strictly worse than the helper.
- **Separation of concerns.** "How a test asserts equality" is one
  decision and lives in one helper. Today each proof file re-makes
  that decision on every line. The helper already exists — it's just
  under-adopted.
- **Lower bar for new contributors.** A new `proof.f.ts` writer
  copying the local style today copies the hand-rolled pattern; if
  the surrounding file uses `assertEq`, they pick that up by example.
  Adoption is self-reinforcing in either direction, so the first
  folder sets the tone for everything that follows.

### Caveats / why this is an idea, not a mechanical edit

- **Not every site fits.** Some `throw` statements carry context the
  helper cannot easily reproduce (e.g. interpolated strings,
  multi-argument arrays, custom messages). Don't shoehorn those
  through `assertEq`; leave them or extend the helper API
  (`assertEq(a, b, label?)`) once a clear pattern emerges from the
  pilot.
- **`assertEq` uses `===`.** For containers, the codebase routinely
  `JSON.stringify`-ifies both sides first
  (`if (result !== '[1,20,300]') { throw result }`). That stays
  exactly the same: `assertEq(result, '[1,20,300]')`. Don't be
  tempted to add deep-equal support — see [i65X-async-test-functions](./README.md)
  and AGENTS.md: keep helpers minimal until a second consumer needs
  more.
- **Import edge.** `proof.f.ts` files in `fs/types/` currently avoid
  importing from `fs/dev/module.f.ts` (only `fs/types/patricia_trie/proof.f.ts`
  pulls `assert` from there today). Verify there is no module-cycle
  problem before mass-importing from `fs/dev` into the `fs/types`
  subtree. If there is, hoist `assert`/`assertEq` into a small
  `fs/types/proof/module.f.ts` (or co-located leaf) that `fs/dev` can
  re-export. The 4 existing `assertEq` consumers in `fs/sul/` are a
  good existence proof that the import edge works from outside
  `fs/types`.
- **Land in small PRs.** AGENTS.md asks for "one feature/improvement
  with minimal code changes" per PR; a single PR rewriting 1,600 lines
  is not in the spirit of that rule even if each diff is trivial.
  Folder-by-folder keeps reviews proportionate. No CHANGELOG entry per
  PR — these are test-only changes.
- **Coverage delta = zero.** The helper does not change what is
  asserted, only how. Tests must continue to pass without any
  expected-result edits; if they don't, the rewrite caught a
  pre-existing latent bug and that's a separate diff.

### Related

- i65Y-proof-by-export — discovery by exported
  `proof`; defines module-level asserts as the "light proof" tier (runs on every
  load → light, cheap checks only). `assertEq` is the helper that makes that
  tier ergonomic.
- `fs/dev/module.f.ts:36–39` — definitions of `assert` / `assertEq`.
- `fs/sul/id/module.f.ts:19`, `fs/sul/id/proof.f.ts:1`,
  `fs/sul/proof.f.ts:1`, `fs/sul/level/hash/proof.f.ts:1` — the four
  existing consumers, demonstrating the desired call-site shape.
- [i194](todo.md), [i65X-async-test-functions](./README.md) —
  parallel work on the test framework's effect surface. The helper
  story above is intentionally smaller and orthogonal; it does not
  touch the `Reporter`/`TestEntry`/`testAll` path.
- i183 — scenario-style tests
  for the test framework itself. If `assertEq` adoption surfaces a
  meaningful failure-message regression, the scenario tests are the
  right place to lock the new behaviour in.

---

## 661-sample-repo-ts. Sample repo: FunctionalScript test framework for vanilla TypeScript

**Priority:** P3
**Status:** open

### Problem

There is no minimal example repository showing how to use the FunctionalScript test
framework in a plain TypeScript project. New users have no reference for how to
structure tests, what the different proof styles look like, or how to wire up CI.

### Proposal

Create a public sample repository with:

**Test styles demonstrated**

- Module-level asserts
- White-box proofs
- Black-box proofs

**CI** running all of:

- `npx fjs js t`
- Node test runner
- Deno test runner
- Bun test runner

### Tasks

- [ ] Create the sample repository
- [ ] Add examples of module-level asserts
- [ ] Add examples of white-box proofs
- [ ] Add examples of black-box proofs
- [ ] Add CI workflow running `npx fjs js t`, Node, Deno, and Bun runners

### Related

- [i661-test-runner-behavior](todo.md) — documents runner behavior differences relevant to CI setup

---

## 661-sandbox-isolated-test-execution. fjs t runs generated tests in an isolated sandbox

**Priority:** P3
**Status:** open

### Problem

fjs `t` (the FunctionalScript test runner) differs fundamentally from most
popular test runners (Node `node:test`, Deno, Bun, Vitest, Jest) in how it
executes generated and sub-tests:

- **fjs `t`**: each generated test is run in its own **separate sandbox** — an
  isolated execution context. Tests cannot share mutable state with each other
  or with the parent test. Because generated tests are fully independent, they
  are only scheduled **after the parent test succeeds**, and the runner has
  full control over when (and whether) to execute them.
- **Most other runners**: sub-tests and generated tests are executed **inside**
  the parent test, in the same process/context. The parent's scope is directly
  accessible to child tests, and sub-test execution is driven by the parent.

This architectural difference has practical consequences that contributors and
users need to be aware of when comparing behaviour or porting tests between
runners.

### Convention vs. runner

These properties — isolation, independence, deferred scheduling — are not
accidents of implementation. The FunctionalScript **test conventions** are
deliberately designed so that generated tests carry all of them. `fjs t` is
built to honour those conventions and therefore exposes all the benefits.

When the same test suite is run through an older or conventional runner
(Node `node:test`, Deno, Bun, etc.), that runner has no knowledge of the
conventions: it executes generated tests inline, inside the parent, and the
properties are silently lost. The tests still pass or fail, but isolation,
ordering guarantees, and runner-controlled scheduling are no longer in effect.

### Key differences

| Aspect | fjs `t` | Typical runners (Node, Deno, Bun, Vitest…) |
|---|---|---|
| Generated test execution context | Isolated sandbox per test | Inside the parent test |
| Shared mutable state between tests | Not possible by design | Possible (and common) |
| Side-effects from one test leaking to another | Prevented | Must be managed manually |
| Test isolation overhead | Higher (sandbox setup per test) | Lower |
| Parallelism safety | Inherent | Requires explicit care |
| Generated tests are independent top-level tests | Yes — scheduled after parent succeeds | No — always nested inside the parent |
| Runner controls when generated tests run | Yes — runner decides scheduling | No — execution is dictated by the parent test |

### Proposal

Document this distinction clearly in the relevant README or developer guide so
that:

1. Contributors understand why fjs `t` output may differ from other runners for
   the same test suite.
2. Users porting tests know that state shared via closure in other runners must
   be made pure/functional for fjs `t`.
3. The design rationale (functional purity, no shared mutable state) is
   explained alongside the behavioural difference.

### Tasks

- [ ] Identify the right location for this documentation (README, AGENTS.md, or a dedicated doc page)
- [ ] Write a short explanation of the sandbox model and how it contrasts with in-test sub-test execution
- [ ] Add a note in the test-runner comparison table (see [i661](todo.md))

### Related

- [i661](todo.md) — documents other behavioural differences across supported test runners
- i65Y-sandbox-await-overhead — performance work inside the sandbox

---

## 661-test-runner-behavior. Document behavior of supported test runners

**Priority:** P3
**Status:** open

### Problem

Each supported test runner handles generated tests and expected failures differently.
This is not documented anywhere, leaving contributors uncertain about why the framework
behaves differently across Node, Deno, Bun, and Playwright.

### Proposal

Document the following differences in the relevant README or doc page:

**Sub-test handling**

- **Node** and **Deno**: run generated tests as native sub-tests.
- **Deno** caveat: sub-tests are not counted toward the total test count.
- **Bun** and **Playwright**: do not support sub-tests natively; generated tests are
  run inside a parent test using a special wrapper.

**Expected-to-fail tests**

- **Node** and **Deno**: natively understand tests that are expected to fail.
- **Bun** and **Playwright**: have no awareness of expected-to-fail semantics, so
  such tests are wrapped to emulate the behavior.

### Tasks

- [ ] Identify the right location for this documentation
- [ ] Write the documentation describing the differences above

### Related

- i155 — original test runner integration issue
- [i211](todo.md) — reporter modes, including the Node/Bun/Playwright bridge reporter

---

## 664-emergent-testing-module-files. Load `module.js`/`module.ts` files for white-box testing

**Priority:** P4
**Status:** open

### Problem

`shouldLoad` in `fs/dev/module.f.ts:61` currently admits only two categories of files:

1. All FunctionalScript modules — anything ending in `.f.ts` or `.f.js`.
2. Opt-in proof files — anything ending in `proof.ts`, `proof.js`, `proof.mts`, or `proof.mjs`.

```ts
// fs/dev/module.f.ts:61
export const shouldLoad = (s: string): boolean =>
    s.endsWith('.f.ts')    || s.endsWith('.f.js')    ||
    s.endsWith('proof.ts') || s.endsWith('proof.js') ||
    s.endsWith('proof.mts')|| s.endsWith('proof.mjs')
```

Non-FunctionalScript modules — ordinary `.ts` / `.js` files — are invisible to
the test runner unless they are named `proof.*`. This works for black-box tests
(which live in `proof.*` files) but makes **white-box testing** (testing internal
implementation details) awkward: a developer writing tests alongside a plain
`module.ts` must either rename the target file or create a separate proof file
that imports internals just to reach them.

The natural place to put white-box tests for `module.ts` is `module.ts` itself
(or a co-located `module.test.ts`), mirroring how `.f.ts` files are bulk-loaded
regardless of whether they export a `proof` property.

### Proposal

Extend `shouldLoad` to also admit files ending in `module.ts`, `module.js`,
`module.mts`, or `module.mjs`:

```ts
export const shouldLoad = (s: string): boolean =>
    s.endsWith('.f.ts')     || s.endsWith('.f.js')     ||
    s.endsWith('proof.ts')  || s.endsWith('proof.js')  ||
    s.endsWith('proof.mts') || s.endsWith('proof.mjs') ||
    s.endsWith('module.ts') || s.endsWith('module.js') ||
    s.endsWith('module.mts')|| s.endsWith('module.mjs')
```

Whether a loaded `module.*` file actually exports a `proof` property is already
determined at runtime by the existing check in `runModuleMap` /
`registerModuleMap`:

```ts
// fs/emergent_testing/module.f.ts:222,244
.flatMap(([k, v]) => v.proof !== undefined ? [[k, v.proof] as const] : [])
```

So files that do not export `proof` are silently skipped — exactly the same
behaviour as `.f.ts` files without a `proof` export. No changes to the runner
are required.

### Documentation

The JSDoc comment on `shouldLoad` (`fs/dev/module.f.ts:51–60`) and the
`fs/emergent_testing/` module documentation must be updated to reflect the new
loading rules, explaining that `module.*` files are loaded for white-box testing
of non-FunctionalScript modules while the `proof.*` convention remains for
standalone black-box proof files.

### Scope of change

- `fs/dev/module.f.ts` — extend `shouldLoad`; update its JSDoc.
- `fs/emergent_testing/` documentation — update to cover the new file-naming
  convention and its white-box testing use case.
- Tests for `shouldLoad` (if any exist) — add cases for `module.ts`/`module.js`.

### Non-goals

- The `.f.ts` / `.f.js` bulk-load behaviour is unchanged.
- The `proof.*` convention is unchanged and still recommended for standalone
  black-box proof files.
- No changes to the runner logic (`runModuleMap`, `registerModuleMap`,
  `runModule`, `registerModule`).

---

## 665-proof-property-tests. Seed-derived inputs for non-zero-arg proof functions

**Priority:** P3
**Status:** open

### Problem

The proof framework currently treats a function with parameters (`f.length > 0`)
as **not a test case** — it is silently skipped. Functions that declare parameters
are ignored and never called (see `fs/emergent_testing/README.md`).

### Proposal

The test runner calls non-zero-argument proof functions with a **signed 32-bit
integer (`a | 0`) per parameter**, derived deterministically from the seed and
the test's full name. That is the runner's entire contribution — it provides
inputs, nothing more.

```ts
export const proof = {
    // zero-arg: regular test case (unchanged)
    add: () => { if (1 + 1 !== 2) throw '1 + 1 !== 2' },

    // non-zero-arg: called with one signed int32 per parameter
    commutativity: (a: number, b: number) => {
        if (a + b !== b + a) throw [a, b]
    },
}
```

Property-based testing (universally-quantified assertions, shrinking, structured
generators) is not a runner concern — users build that on top using plain helper
libraries, the same way they use `assertEq` today.

#### Seed-based reproducibility

The test runner is initialised with a **seed** that drives all random input
generation. The seed is printed before any test runs, so that:

- A failing run can be reproduced exactly by passing the same seed.
- If the runner itself crashes or hangs, the seed is already visible in the output.

Two modes:

| Mode | Seed | When |
|------|------|------|
| **Deterministic** | Fixed (e.g. `0` or a well-known constant) | Default CI — reproducible across runs |
| **Exploratory** | Fresh random seed each run | Optional; surfaces new failures over time |

`fjs t` would accept a `--seed <n>` flag (deterministic) and a `--fuzz` flag
(exploratory with a new random seed). Without either, it defaults to deterministic.

#### Parallel-safe input generation

Tests may run in parallel, so input values cannot be generated by advancing a
shared sequential RNG state. Instead, each parameter is derived independently by hashing `seed`, the full test name, and the parameter index:

```
param[i] = hash(seed || fullTestPath || i) | 0
```

`i` is the zero-based parameter position. This is:

- **Deterministic** — same seed + same test name + same index → same parameter, always.
- **Parallel-safe** — no shared mutable state; any test can compute its inputs independently.
- **Stable under suite changes** — adding, removing, or reordering other tests does not change the parameters any given test receives, because each test's inputs are tied to its full path, not its position in a list.
- **Reproducible** — the full test name is already part of the failure output, so the exact inputs are recoverable from seed + name alone.

The hash function needs to be deterministic across runs and platforms
(not `Math.random`, not pointer-based). A simple non-cryptographic hash
(e.g. FNV-1a or xxHash over the UTF-8 bytes of the name) is sufficient.

#### Input generation

TypeScript types are erased at runtime — the test runner cannot know what types
a function's parameters expect, only **how many** parameters there are (`f.length`).
Each parameter receives a signed 32-bit integer from the formula above. A function
needing more than 32 bits simply declares more parameters.

#### One set of parameters per run

Since property functions can return sub-trees — which may themselves contain
further property tests — running `N` samples per property test would cause the
number of test cases to grow **exponentially** through nested property sub-trees.

Therefore: the test runner calls each property function **exactly once** per run,
with parameters derived deterministically from the seed. The seed is the only
source of variation. Two runs with the same seed produce identical parameter
values and an identical execution trace through the entire proof tree.

```
seed=12345 → f receives (a=1984661823n, b=−309412771n) — always, for this seed
```

Coverage over time comes from exploratory runs (different seeds), not from
multiple calls within a single run.

A user who wants to exercise many values in a single run can generate sub-tests
from the received parameter, using it as a seed to derive further inputs.
Because proof functions are plain values independent of the test runner, any
helper library works inside property tests exactly as it does in regular zero-arg
tests — including helpers that generate sub-trees from a seed:

```ts
import { assertEq } from 'functionalscript/fs/asserts/module.js'
import { fromSeed } from 'some/helper/module.js'

// fromSeed(n)(seed)(f) → sub-tree of n zero-arg tests, each calling f with a
// value derived from seed
const manyValues = (seed: number) =>
    fromSeed(100)(seed)(a => assertEq(a + 0, a))
```

The runner receives `seed`, the helper builds the sub-tree, and the framework
walks it — strong separation of concerns: the runner provides inputs, helper
libraries transform them, the proof tree is plain data.

#### Failure output

The seed is printed once before any test runs. Individual test paths then show
only the generated parameter values:

```
seed: 42
import("./fs/math/proof.f.ts").proof.commutativity(3879392, 39002): error, 0.12 ms
```

Running with `--seed 42` reproduces the exact failure.

#### Reproducing a specific failed test

Running with `--seed 42` re-runs **the entire suite** with the same inputs. When
only one test failed, re-running everything is wasteful. A lighter option: pass
the **complete path including parameter values** as they appear in the failure
output, and let the runner call that function with those exact values directly —
bypassing the hash formula entirely.

For `fjs t` this could be a positional argument or a `--filter` flag accepting
the full test path string (parameters included).

For framework adapters (Node `--test`, Bun, Playwright), where the runner
controls test registration, an environment variable provides the same escape
hatch:

```
FJS_TEST_ARGS='import("./fs/math/proof.f.ts").proof.commutativity(3879392, 39002)'
```

The adapter parses the path and arguments from the string and calls the
function directly with those literal values, skipping seed-derived generation.
This is one option; the exact interface is an open question.

#### Shrinking (future)

Shrinking (finding the minimal failing input) is explicitly out of scope for the
first iteration. Record the raw failing input; a follow-up can add shrinking
driven by the rtti schema.

#### Seed visibility in external runners

For `fjs t`, the seed is printed to stdout as a plain line before any test output.

For external runners (Node `--test`, Bun, Playwright), we have no control over
what is printed before the runner starts. Instead, **register a synthetic
always-passing test named `seed: ${seed}`** as the very first test:

```
✔ seed: 42 (0.00ms)
✔ import("./fs/math/proof.f.ts").proof.commutativity(3879392, 39002) (0.12ms)
```

This appears at the top of the runner's own output in whatever format it uses,
requires no special stdout handling, and is visible even if a later test crashes
the process. The seed test always passes (its body is a no-op).

### Integration with the existing proof tree

- The sub-tree walk and `throw`-key semantics apply as today.
- A non-zero-arg function under a `throw` key is expected to throw for the input
  it receives — the same inversion applies. Unusual in practice but consistent.
- Return-value sub-trees: if the function returns an object or function after
  being called, the return value is walked as a sub-tree (same as zero-arg tests
  today). This is how users build multi-value or data-driven tests from a seed.
- For Bun/Playwright inline runners, each non-zero-arg function registers as a
  single named entry and is called once with its derived inputs.

### Open questions

- **Hash function.** `hash(seed || testName)` → parameter bits. Must be
  deterministic across platforms, fast, and produce well-distributed output.
  FNV-1a or xxHash over UTF-8 bytes are candidates; alternatively reuse
  `fs/crypto/sha2` if cross-platform consistency is critical. The hash output
  width determines how many parameters can be independently drawn per test.
- **Edge cases.** Should a few fixed values (0, −1, `MAX_INT32 = 2147483647`,
  `MIN_INT32 = −2147483648`) always be included regardless of seed, so they are
  never accidentally skipped?
- **`fjs t` vs external runners.** External runners (Bun, Playwright) run
  everything under their scheduler. Printing the seed and ensuring it is
  visible before any test output needs care.
- **`f.length > 0` detection.** Today `f.length === 0` is the gate for "is a
  test case." Changing to "is a property test" for `f.length > 0` is backward-
  compatible (skipped → now runs). Curried functions (`f.length === 1` regardless
  of depth) need no special handling: the runner calls `f` with one int32, and if
  the return value is another function it is walked as a sub-tree — the existing
  return-value mechanism covers it naturally.

### Related

- `fs/emergent_testing/README.md` — current definition of test case (zero-arg only)
- `fs/emergent_testing/module.f.ts` — `runModule`, `registerModule` — the entry points to extend

---

## 668-emergent-testing-proof-type. Add an explicit `Proof` type

**Priority:** P3
**Status:** open

### Problem

Emergent testing documentation describes proofs as ordinary values, but the code
does not expose a named `Proof` type for modules to use. This makes the expected
recursive shape implicit in runner code and prose instead of available as a
type-level contract.

### Proposal

Add and export a `Proof` type near the emergent testing runner API. The type
should model the recursive proof tree accepted by the runner:

```ts
export type Proof =
    | Readonly<Record<string, Proof>>
    | readonly Proof[]
    | (() => Proof | undefined)
```

Confirm whether returning a nested `Proof` from a function is intended runner
behaviour. If proof functions are only test leaves today, use a narrower
function branch and document the choice in JSDoc.

An alternative is to define the proof shape as RTTI and derive the TypeScript
type from it. That would keep runtime validation and the public type in sync,
but proof leaves are functions, so this requires extern RTTI support for
function values before it can model the full proof tree.

### Tasks

- [ ] Decide whether `Proof` should be a direct TypeScript type or derived from
  RTTI.
- [ ] Add the `Proof` type in the natural emergent testing module.
- [ ] Use the type in runner/registering APIs where it reflects existing
  behaviour.
- [ ] Document proof-tree invariants in JSDoc and keep the README definition in
  sync.
- [ ] Add or update proof coverage for accepted object, array, and function
  proof shapes.

### Related

- [i65Z-tf-test-tree-walker](todo.md) — planned shared
  proof-tree traversal.
- [i668-rtti-function-types](../types/todo.md) — extern RTTI for
  function-valued proof leaves.
- [i665-proof-property-tests](todo.md) — future proof
  shape extension.

---

## 66A-emergent-add-result. Merge `addPass` / `addFail` into one `TestState` updater

**Priority:** P5
**Status:** open

### Problem

`fs/emergent_testing/module.f.ts` defines two `TestState` updaters that are
identical except for the counter field they increment:

```ts
// fs/emergent_testing/module.f.ts:43-47
const addPass = (delta: number) => (ts: TestState): TestState =>
    ({ ...ts, time: ts.time + delta, pass: ts.pass + 1 })

const addFail = (delta: number) => (ts: TestState): TestState =>
    ({ ...ts, time: ts.time + delta, fail: ts.fail + 1 })
```

where

```ts
// :37-41
type TestState = {
    readonly time: number,
    readonly pass: number,
    readonly fail: number,
}
```

The two bodies share the spread, the `time: ts.time + delta` accumulation, and
the `+ 1` increment; they differ only in whether `pass` or `fail` is the
incremented key. This is the "same algorithm, one varying constant" shape that
DRY targets — and if a third outcome counter were ever added (e.g. `skip`), the
copy would multiply.

Both helpers are real, exercised code: `addPass(duration)(zero)` /
`addFail(duration)(zero)` feed the `runModule` walk
(`fs/emergent_testing/module.f.ts:199-205`).

### Proposal

Parameterize over the counter key with a typed computed property, keeping the
type checker's exhaustiveness (`'pass' | 'fail'` is a closed union, so a typo
is a compile error):

```ts
const addResult = (key: 'pass' | 'fail') => (delta: number) => (ts: TestState): TestState =>
    ({ ...ts, time: ts.time + delta, [key]: ts[key] + 1 })

const addPass = addResult('pass')
const addFail = addResult('fail')
```

The two named helpers are kept as point-free derivations so every call site
(`addPass(duration)(zero)`, `addFail(duration)(zero)`) is unchanged and still
reads at the grammar level. No `as` cast is needed — `ts[key]` is `number` for
both members of the union, and the computed-key literal is checked against the
`TestState` shape.

This is a small, single-module change. It is borderline against the AGENTS.md
DRY-vs-readability guidance (the originals are short and clear), which is why
it is filed at **P5** — worth doing if the file is being touched anyway, or as
a prerequisite if a third counter is introduced, but not on its own.

### Tasks

- [ ] Replace `addPass` / `addFail` with the `addResult` factory + two
      derivations in `fs/emergent_testing/module.f.ts`.
- [ ] Confirm `fs/emergent_testing` proofs still pass (`fjs t`) with full
      branch coverage and `npx tsc` is clean.

### Related

- [i65Z-tf-test-tree-walker](todo.md) — adjacent
  `fs/emergent_testing` DRY cleanup (sharing the dynamic test-tree walk between
  `runModule` and `registerModule`). Same module; independent change. Note that
  walker also consumes `addPass`/`mergeState`, so landing this first keeps the
  updater surface stable for that refactor.

---

## 205. Rename `all.test.ts` entry point

**Priority:** P3
**Status:** open

### Problem

The `fs/emergetn-testing/scenarios/all.ts` file (renamed to `all.test.ts` by `run.sh` at test
time) is named `all`, which suggests "run all tests" rather than "register tests with
an external framework".

The `.test.ts` suffix **must be kept** — bun, node `--test`, and Playwright
auto-discover files ending in `.test.ts`. A name like `register.ts` (without the
`.test.ts` suffix) would not be found by any framework.

### Options

#### Option A — `register.test.ts`

Rename `all.ts` → `register.ts` (at rest); `run.sh` links it as `register.test.ts`.
The `.test.ts` suffix preserves auto-discovery; the `register` prefix communicates
the file's role.

Note: `loadModuleMap` only matches `*.test.f.ts` / `*.test.f.js`, so `register.test.ts`
would not be loaded as a test module — no double-load risk, even if plain
`*.test.ts` support is added (since the guard would need to explicitly exclude
`register.test.ts` or use a different mechanism).

#### Option B — keep `all.ts` / `all.test.ts`

Accept the current name. `all` is short and familiar; the entry-point role is clear
from context.

### Related

- i204 — new suffix for plain TS/JS FunctionalScript convention files;
  `all.test.ts` must stay `.test.ts` for framework discovery
- i183 — scenario runner that uses this file

---

## 206. Investigate workers as a sandbox

**Priority:** P3
**Status:** open

### Problem

The current `sandbox` operation runs a synchronous function inside a try/catch with
`performance.now()` timing:

```ts
export type Sandbox = readonly['sandbox', <T>(f: () => T) => SandboxResult<T>]
```

This provides error isolation but no resource limits — a test that spins forever,
allocates unbounded memory, or calls `process.exit()` can crash the entire runner.

### Proposal

Investigate Node.js Worker Threads (`node:worker_threads`) as a stronger sandbox:

- **Hard timeout** — `worker.terminate()` after a configurable deadline; the worker
  cannot escape it.
- **Memory isolation** — each worker has its own V8 heap; a runaway allocation does
  not OOM the host.
- **`process.exit()` safety** — a `process.exit()` inside a worker kills only the
  worker, not the host.

The `SandboxResult<T>` return type is already designed to carry a `Result<T, unknown>`
so timeout and termination can be surfaced as `error` values without API changes.

### Open questions

1. **Startup cost** — spawning a worker per test call may be too slow for a large
   test suite. A worker pool (reuse workers across calls) reduces amortized cost but
   complicates state isolation between tests.
2. **Serialisation** — `SandboxResult<T>` requires `T` to be transferable across the
   worker message channel (structured clone). Pure FunctionalScript values are plain
   objects/arrays/primitives, so this should hold in practice.
3. **Bun/Deno compatibility** — both support `node:worker_threads`; verify that the
   same implementation works across all three runtimes.

### Additional motivation: infinite waits and loops

The current sandbox has no way to detect or recover from tests that never terminate:

- **Infinite loops** — `while (true) {}` in a `proof.js` test locks the sandbox
  thread permanently; no other tests run, the runner hangs, and the process must be
  killed externally.
- **Non-resolvable Promises** — `await new Promise(() => {})` in a `proof.js` test
  produces a Promise whose executor never calls `resolve` or `reject`; the async
  sandbox waits forever and the suite never completes.

A worker with a hard timeout terminates the worker thread after the deadline and
reports a failure (timeout exceeded), keeping the rest of the test suite running.

### Related

- i149 — original `sandbox` design
- i183 — scenario tests that would exercise
  timeout/OOM behaviour

---

## 211. Reporter modes for the test framework

**Priority:** P3
**Status:** open

The `Reporter<O>` interface (`moduleStart` / `enter` / `pass` / `fail` / `summary`,
each an `Effect<NodeOp, void>`) makes the walker reporter-agnostic. Several concrete
reporter implementations follow naturally.

### GitHub Actions reporter

`module.f.ts` currently reads `options.env['GITHUB_ACTIONS']` at startup and switches
output format for the entire run:

```ts
const isGitHub = options.env['GITHUB_ACTIONS'] !== undefined
if (isGitHub) {
    return csiError(`::error file=${k},line=1,title=${i}()::${r}`)
} else {
    return csiError(`${i}() ${fgRed}error${reset}, ...`)
}
```

This hardcodes knowledge of a specific CI environment inside the test walker. The
GitHub output path should be extracted into a `githubReporter` factory so it is
testable via the virtual runner and the walker stays environment-agnostic.

### Quiet reporter

A reporter where `enter` and `pass` are no-ops (`pure()`); only `moduleStart`,
`fail`, and `summary` produce output. Useful for CI logs where passing tests are noise.
Selected via a CLI flag or env. See [i21](todo.md).

### Dynamic progress reporter

When stdout is a TTY, a reporter that shows a running counter and the currently-executing
test path, overwritten on each event. Falls back to the verbose reporter on a non-TTY
destination. Corresponds to the "colored progress bar" item in
[i21](todo.md).

### Node / Bun / Playwright bridge reporter

A reporter that converts walker events into the corresponding framework's `subTest`
calls, allowing `module.ts` to reuse the Effects walker instead of maintaining its own
scan loop. The landed i163 work added `test(throws, f)`
to `Reporter<O>` that enables this.

### Related

- [i21](todo.md) — silent/verbose mode and progress bar
- i155 — original issue; reporter modes extracted here
- i163 — `test(throws, f)` on `Reporter<O>` enabling the bridge reporter

---

## Scenario Testing

**Priority:** P3
**Status:** open

A scenario is an extended unit test: a declarative description of an initial system state, an effect to run, and an expected result. The same scenario can be executed in two ways:

1. **As a unit test** — a mock effect interpreter runs the effect against a pure in-memory initial state. No real files, network, or processes. Fast, portable, runs anywhere.
2. **As an integration test** — the initial state is materialised on a real machine, the actual command is executed, and the result is checked. This is what CI integration jobs do (see [669-ci-integration-tests.md](669-ci-integration-tests.md)).

### Design

The scenario type will evolve as more complex cases are encountered rather than being designed upfront for all possible scenarios. A starting shape:

```ts
type Scenario<O extends Operation, R> = {
    readonly state: InitialState        // pure data description of files, env vars, etc.
    readonly effect: Effect<O, R>
    readonly expected: Effect<O, void>  // reads resulting state and checks hypotheses
}
```

`InitialState` is a pure data description of the starting conditions. The test and scenario runners read it and apply it to either a virtual or real system — the scenario itself has no knowledge of which.

`expected` is an effect rather than a plain value so it can read the resulting state after `effect` has been applied, allowing complex post-condition checks (e.g. assert a file was written with specific contents).

The two interpreters test different things:
- The mock tells you the logic is correct.
- The real run tells you the platform, install, and environment work.

Both failure modes are distinct and complementary — a scenario that passes both gives high confidence.

### Key constraint

The mock interpreter must be faithful to the real one. If they drift (e.g. file path casing differences on Windows), scenarios pass locally but fail in CI — the exact problem this design is meant to prevent. Ideally the mock is derived from the same spec as the real interpreter.

### Migration path

Existing proof tests that use the virtual filesystem interpreter are already implicit scenarios — they have a state (`emptyState + root: dir`), an effect (`testAll(reporter)(options(...))`), and an expected result (exit code + events). Once the formal `Scenario` type is defined, these tests can be lifted into it directly, replacing the ad-hoc `run()` / `runMain()` helpers in `proof.f.ts` with typed scenario declarations.

### Plan

- [ ] Define the `Scenario` type and `InitialState` effect in `fs/testing/scenario/module.f.ts`.
- [ ] Implement a mock interpreter for the scenario effect system.
- [ ] Integrate scenarios with the existing unit test runner (`node --test`).
- [ ] Define how CI integration jobs consume scenario modules (see [669-ci-integration-tests.md](669-ci-integration-tests.md)).

---

