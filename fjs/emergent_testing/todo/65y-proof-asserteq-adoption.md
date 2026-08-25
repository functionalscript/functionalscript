## 65Y-proof-assertEq-adoption. Adopt `assert`/`assertEq` across `proof.f.mjs` files

**Priority:** P4
**Status:** open

### Problem

`fjs/dev/module.f.mjs` exports two test helpers:

```ts
export const assert: (v: boolean, msg?: unknown) => asserts v =
    (v, msg = 'assertion failed') => { if (!v) throw msg }

export const assertEq = <T>(a: T, b: T): void => assert(a === b, [a, b])
```

…but the codebase's `proof.f.mjs` files mostly do not use them. The
prevailing pattern is hand-rolled per-line:

```ts
if (result !== '[1,20,300]') { throw result }
if (cmp('apple')('banana') !== -1) { throw 3 }
if (uint(s) !== 0x68656C6C_6F20776F_726C64n) { throw s }
```

Counts in the current tree (re-verified 2026-08-14):

- ~494 `if (...) { throw ... }` lines remain across `**/proof.f.mjs` —
  down from the original count, but still a real chunk of the manual
  pattern.
- 109 of 118 `proof.f.mjs` files now import `assertEq` — adoption is
  well underway. The 9 remaining holdouts: `fjs/basen/base128/proof.f.mjs`,
  `fjs/js/tokenizer/proof.f.mjs`, `fjs/media/json/tokenizer/proof.f.mjs`,
  `fjs/types/nominal/proof.f.mjs`,
  `fjs/types/object/structurally_same/proof.f.mjs`,
  `fjs/types/range/proof.f.mjs`, `fjs/types/range_set/proof.f.mjs`,
  `fjs/types/rtti/proof.f.mjs`, `todo/proof.f.mjs`.
- A number of files already using `assertEq` still carry leftover
  manual `if (...) { throw ... }` sites alongside it (the 494 count
  above is not confined to the 9 holdout files) — full adoption within
  an already-migrated file is still incomplete in places.

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

1. **Pilot** — pick one moderately-sized `proof.f.mjs` (e.g.
   `fjs/types/string/proof.f.mjs` or `fjs/types/array/proof.f.mjs`) and
   rewrite every `if (x !== expected) { throw x }` to `assertEq(x, expected)`.
2. **Validate** — run `npx tsc`, `npm test`, and `npm run fst` from
   that folder. Confirm test output is at least as useful on
   intentional failures (intentionally break one assertion to read
   the failure message).
3. **Expand** — propagate to the rest of `fjs/types/*`, then `fjs/text/*`,
   `fjs/media/json/*`, `fjs/djs/*`, etc., one folder per PR. No mixing the
   refactor with behaviour changes.

Optional second helper for the remaining shapes:

```ts
// fjs/dev/module.f.mjs — adds nothing if you also have `assertEq`,
// but makes intent obvious at the call site for non-`===` comparisons.
export const assertNot = (a: unknown, b: unknown): void => assert(a !== b, ['equal', a, b])
```

If the call site needs a richer message (e.g.
`throw \`lx: ${lx}\``, `throw [actual, expected, context]`), keep the
hand-rolled form — `assertEq` is not a hammer for every assertion.
Aim for the simple `if (x !== expected) { throw x }` pattern first;
it's by far the most common and the lowest-judgement case.

### Why this qualifies

- **DRY at extreme volume.** Even after 109 of 118 files adopted
  `assertEq`, ~494 spellings of the same three-token conditional throw
  remain. Continuing adoption (both in the 9 holdout files and the
  leftover manual sites within already-migrated files) keeps deleting
  redundant patterns in favour of a single call.
- **Failure-message quality goes up.** `throw [a, b]` always includes
  both sides of the comparison. Manual `throw 0` / `throw 1` /
  `throw 'error'` sites lose the actual value entirely, which forces
  re-running with `console.log` to debug.
- **Separation of concerns.** "How a test asserts equality" is one
  decision and lives in one helper. Today each proof file re-makes
  that decision on every line. The helper already exists — it's just
  under-adopted.
- **Lower bar for new contributors.** A new `proof.f.mjs` writer
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
  tempted to add deep-equal support — see `i65X-async-test-functions`
  (retired, resolved: the `Await` effect at `fjs/effects/node/types.ts:306`)
  and AGENTS.md: keep helpers minimal until a second consumer needs
  more.
- **Import edge.** `proof.f.mjs` files in `fjs/types/` currently avoid
  importing from `fjs/dev/module.f.mjs` (only `fjs/types/patricia_trie/proof.f.mjs`
  pulls `assert` from there today). Verify there is no module-cycle
  problem before mass-importing from `fjs/dev` into the `fjs/types`
  subtree. If there is, hoist `assert`/`assertEq` into a small
  `fjs/types/proof/module.f.mjs` (or co-located leaf) that `fjs/dev` can
  re-export. The 109 existing `assertEq` consumers across the tree are a
  good existence proof that the import edge works from outside
  `fjs/types`.
- **Land in small PRs.** AGENTS.md asks for "one feature/improvement
  with minimal code changes" per PR; a single PR rewriting hundreds of
  lines is not in the spirit of that rule even if each diff is
  trivial. Folder-by-folder keeps reviews proportionate. No CHANGELOG
  entry per PR — these are test-only changes.
- **Coverage delta = zero.** The helper does not change what is
  asserted, only how. Tests must continue to pass without any
  expected-result edits; if they don't, the rewrite caught a
  pre-existing latent bug and that's a separate diff.

### Related

- i65Y-proof-by-export — discovery by exported
  `proof`; defines module-level asserts as the "light proof" tier (runs on every
  load → light, cheap checks only). `assertEq` is the helper that makes that
  tier ergonomic.
- `fjs/dev/module.f.mjs` — no longer defines `assert`/`assertEq` itself; both come from `fjs/asserts/module.f.mjs`.
- `fjs/sul/id/module.f.mjs:19`, `fjs/sul/id/proof.f.mjs:1`,
  `fjs/sul/proof.f.mjs:1`, `fjs/sul/level/hash/proof.f.mjs:1` — the four
  existing consumers, demonstrating the desired call-site shape.
- [i194](./194.md), `i65X-async-test-functions` (retired, and since shipped) —
  parallel work on the test framework's effect surface. The helper
  story above is intentionally smaller and orthogonal; it does not
  touch the `Reporter`/`TestEntry`/`testAll` path. Both halves of the async
  gap closed: the `registerModule` path gained the `Await` operation
  (`fjs/effects/node/types.ts:306`, threaded through `Test`'s signature at
  `:340`), and the `sandbox` path was split out as `i65X-sandbox-async`, which
  its own retired file records as done.
- i183 — scenario-style tests
  for the test framework itself. If `assertEq` adoption surfaces a
  meaningful failure-message regression, the scenario tests are the
  right place to lock the new behaviour in.
