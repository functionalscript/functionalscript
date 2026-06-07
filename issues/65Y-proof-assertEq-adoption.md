# 65Y-proof-assertEq-adoption. Adopt `assert`/`assertEq` across `proof.f.ts` files

**Priority:** P4
**Status:** open

## Problem

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

## Proposal

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

## Why this qualifies

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

## Caveats / why this is an idea, not a mechanical edit

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

## Related

- i65Y-proof-by-export — discovery by exported
  `proof`; defines module-level asserts as the "light proof" tier (runs on every
  load → light, cheap checks only). `assertEq` is the helper that makes that
  tier ergonomic.
- `fs/dev/module.f.ts:36–39` — definitions of `assert` / `assertEq`.
- `fs/sul/id/module.f.ts:19`, `fs/sul/id/proof.f.ts:1`,
  `fs/sul/proof.f.ts:1`, `fs/sul/level/hash/proof.f.ts:1` — the four
  existing consumers, demonstrating the desired call-site shape.
- [i194](./194-test-effects.md), [i65X-async-test-functions](./README.md) —
  parallel work on the test framework's effect surface. The helper
  story above is intentionally smaller and orthogonal; it does not
  touch the `Reporter`/`TestEntry`/`testAll` path.
- i183 — scenario-style tests
  for the test framework itself. If `assertEq` adoption surfaces a
  meaningful failure-message regression, the scenario tests are the
  right place to lock the new behaviour in.
