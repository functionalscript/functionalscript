## skip-property. Add a `skip` test marker for tests that cannot run

**Priority:** P3
**Status:** open

### Problem

The proposed `todo` marker ([todo-property](./todo-property.md)) assumes a
test's outcome is the *same on every engine*: expected-throw everywhere today,
expected-return everywhere after the fix. Two classes of captured-but-unfixed
behaviour break that assumption:

- **Engine-dependent bugs.** Bun has different `bigint` limitations than Node:
  the same leaf throws on Bun and returns on Node. Whichever direction a strict
  `todo` marker points, one runner is red. And since proofs are pure data
  trees, the proof cannot branch on the engine — the tree does not know where
  it is running.
- **Harmful-to-run tests.** A captured behaviour may hang, exhaust memory, or
  crash the process. Neither a normal test nor a `todo` test can hold it,
  because both *execute* the leaf.

Today such bugs fall back to the exact anti-patterns `todo` was designed to
eliminate: commented-out tests and markdown-only notes.

### Proposal

Add a third marker, `skip`. Everything under a `skip` key is **collected but
never executed**: leaves appear in the report as skipped and are tallied as
technical debt, but their functions are not called.

```ts
export const proof = {
    bigMath: {
        works: () => assertEq(mulVec(a, b), c),
        // Bun bigint limitation: throws on Bun, passes on Node.
        // Neither expectation is uniform across engines, so don't run it.
        skip: { hugeExponent: () => assertEq(pow(2n, big), expected) },
    },
}
```

#### `skip` is an inherited region, like `throw`

Unlike `todo` (local last-key), `skip` is OR-accumulated along the ancestor
path, exactly like `throws`: skipping a whole subtree (`skip: { …group }`) is
the natural use. Leaves under it are still collected by `collectTests` — so
each skipped path is individually visible in the report — they are just never
called.

Consequences of never executing:

- **`skip` dominates `throw` and `todo`.** Under `skip`, the `expectFailure`
  inversion is moot — there is no result to invert.
- **A skipped generator is one skipped leaf.** Expanding a generator requires
  calling it, so `skip: { gen: () => ({ a, b }) }` reports a single skipped
  leaf `.gen`, not `.gen().a` / `.gen().b`.
- **No static guard needed.** `skip: fn` (one skipped leaf) and `skip: { … }`
  (skipped subtree) are both meaningful, unlike `todo`, which only accepts a
  zero-argument function.

#### Choosing between `todo` and `skip`

Rule of thumb: *can the expectation be stated uniformly across engines, and is
the test safe to execute?* Then use `todo` — it self-removes by flipping red
when the behaviour lands. Otherwise use `skip`.

`skip` deliberately gives up the flip-red signal: nothing ever tells us Bun
fixed bigints. Two conventions compensate:

- **Pair every `skip` with a `todo/{slug}.md` issue** stating the *unskip
  trigger* — the precise condition (an engine release, a dependency fix) that
  allows the marker to come off. This mirrors the **Trigger** requirement of
  `todo/blocked/` issues: a skip without a stated trigger is just a wish.
- **The `skip` tally in the summary** keeps the debt count visible on every
  run.

#### Counting and reporting

Skipped leaves do not execute, so they contribute to neither `pass` nor `fail`
and never affect the exit code. Instead:

- The `fjs t` reporter prints each skipped leaf with a `# SKIP` annotation
  (paired with `# TODO` — TAP has exactly this directive pair) and adds a
  `skip` tally to the summary (`pass / fail / todo / skip`).
- Unlike the `todo` tally, `skip` maps onto external runners **natively**:
  Node `--test` accepts a `skip` option, and Bun and Playwright both have
  `test.skip`. So the `register` path reports skips in the framework's own
  output rather than silently dropping them.

#### Rejected alternative: informational run

A middle ground — execute skipped tests but ignore the verdict, reporting
`skip: 3 (1 now passing)` — would partially restore the fixed-signal. Rejected
as the primary mode: some skips exist precisely because executing the leaf is
harmful (hang, OOM, process crash), so a true never-execute mode must exist
anyway, and one marker with one meaning is simpler. Revisit only if unskip
triggers prove too weak in practice.

### Implementation

Mirrors the `throws` plumbing in `fjs/emergent_testing/module.f.ts` plus one
option on the `test` effect:

- **`TestEntry`** — add `readonly skip: boolean` next to `throws`.
- **`parseTestSet` / `collectTests`** — inherit `skip` exactly like `throws`
  (`skip || ck === 'skip'`). When `skip` is set, a non-leaf value that is a
  zero-arg function is still a leaf; generators are not expanded (they are
  leaves that never run).
- **`runModule`** — when `entry.skip`, do not call `test`; report a skipped
  result and increment the `skip` counter in `TestState` (no `pass`/`fail`
  change, no return-value walk).
- **`registerModule`** — register skipped leaves with a `skip` flag instead of
  a test body; no subtest registration, no ` ...` star suffix.
- **`TestFn` / `Test` effect (`fjs/effects/node/module.f.ts`)** — extend the
  options record `{ expectFailure }` with `skip`; the Node implementation
  passes `{ skip: true }` through to `node:test` natively; the Bun/Playwright
  inline wrappers delegate to the framework's `test.skip`.
- **Reporter** — print `# SKIP` lines via `Reporter.result` (or a dedicated
  `skipped` event) and extend `Reporter.summary` with the `skip` count;
  `defaultReporter` prints `pass / fail / todo / skip`.
- **No `fn.name === 'skip'` check** — structural-key-only, matching `throw`
  and `todo` guidance.

### Migration

No existing proof uses a `skip` key (verified by grep over `fjs/**/*.f.ts`), so
this marker reinterprets nothing.

### Open questions

- Should the summary line omit `skip: 0` / `todo: 0` when zero, to keep the
  common case short?
- Skip reasons: the `skip` key cannot carry a reason string (its value is the
  test itself). Is the paired `todo/{slug}.md` issue sufficient, or should a
  convention like `skip: { 'bun-bigint-limit': fn }` (descriptive child key)
  be encouraged in docs?

### Tasks

- [ ] Add `skip` to `TestEntry`; inherit it in `parseTestSet` / `collectTests`
      like `throws`.
- [ ] Short-circuit skipped leaves in `runModule` (no execution, no walk) and
      count them in a new `TestState.skip`.
- [ ] Extend the `test` effect options with `skip`; map to `node:test`'s
      native `skip` option and to `test.skip` in the Bun/Playwright wrappers;
      use it in `registerModule`.
- [ ] Print `# SKIP` per leaf and `pass / fail / todo / skip` in
      `defaultReporter` (`fjs t`).
- [ ] Add proofs in `fjs/emergent_testing/proof.f.ts`: skipped leaf not
      executed, skipped subtree collected as individual paths, skipped
      generator reported as one leaf, `skip` dominating `throw`/`todo`,
      counters unaffected by skips.
- [ ] Document `skip` in `fjs/emergent_testing/README.md` next to the `todo`
      marker: the choosing rule, the unskip-trigger pairing convention, and
      the rejected informational-run alternative.
- [ ] Update `AGENTS.md`: a `skip` marker must be paired with a
      `todo/{slug}.md` stating its unskip trigger.
- [ ] Confirm `fjs t` proofs pass with full branch coverage and `npx tsc` is
      clean.

### Related

- [todo-property](./todo-property.md) — `todo` covers engine-independent
  captured bugs and self-removes by flipping red; `skip` covers what `todo`
  structurally cannot: engine-dependent outcomes and harmful-to-run tests.
- `todo/README.md` "Blocked by third parties" — the unskip-trigger convention
  mirrors the **Trigger** requirement of `todo/blocked/` issues.
- `fjs/effects/node/module.f.ts` `TestFn` — the options record extended with
  `skip` for native framework skipping.
