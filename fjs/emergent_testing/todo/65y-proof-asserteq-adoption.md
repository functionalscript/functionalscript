## 65Y-proof-assertEq-adoption. Adopt `assert`/`assertEq` across `proof.f.mjs` files

**Priority:** P4
**Status:** open

### Problem

`fjs/asserts/module.f.js` exports two test helpers, `assert` and `assertEq`,
and [`fjs/AGENTS.md`](../../AGENTS.md) §1.3 asks proofs to use them — but some
`proof.f.mjs` files still hand-roll the check per line:

```ts
if (result !== '[1,20,300]') { throw result }
if (cmp('apple')('banana') !== -1) { throw 3 }
if (uint(s) !== 0x68656C6C_6F20776F_726C64n) { throw s }
```

Counts after the 56 sites outside `fjs/compiler/parser/` were converted:

- 10 one-line `if (...) { throw ... }` sites remain across `**/proof.f.mjs`,
  all in `fjs/compiler/parser/proof.f.mjs` (each one compares a
  `JSON.stringify`-ed parse result or error against a string literal). They
  were left out only because another open pull request owns that directory;
  each converts as `assertEq(result, '...')`. Other matches of the pattern in
  `fjs/compiler/parser/grammar/proof.f.mjs` and `fjs/compiler/edag/proof.f.mjs`
  sit inside FunctionalScript source strings under test and are not sites.
- Every tracked `proof.f.mjs` except `fjs/asserts/proof.f.mjs` (which tests
  the helpers themselves) now imports from `fjs/asserts/module.f.js`.
- Two multi-line sites are out of this issue's one-line scope: the `bool`
  case in `todo/proof.f.mjs` and the second `raw` case in
  `fjs/asn.1/proof.f.mjs`, whose message is computed in its own block.

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

Once the pull request that owns `fjs/compiler/parser/` lands, rewrite the
10 remaining sites in `fjs/compiler/parser/proof.f.mjs` to `assertEq`, run
`tsc` and `npm start test` from that folder, and delete this issue. No mixing
the refactor with behaviour changes.

Optional second helper for the remaining shapes:

```ts
// fjs/asserts/module.f.js — adds nothing if you also have `assertEq`,
// but makes intent obvious at the call site for non-`===` comparisons.
export const assertNot = (a: unknown, b: unknown): void => assert(a !== b, ['equal', a, b])
```

If the call site needs a richer message (e.g.
`throw \`lx: ${lx}\``, `throw [actual, expected, context]`), keep the
hand-rolled form — `assertEq` is not a hammer for every assertion.
Aim for the simple `if (x !== expected) { throw x }` pattern first;
it's by far the most common and the lowest-judgement case.

### Why this qualifies

- **DRY at extreme volume.** Even after most proof files adopted
  `assertEq`, dozens of spellings of the same three-token conditional throw
  remain. Continuing adoption (both in the holdout files and the
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
  (retired, resolved: the `Await` effect in `fjs/effects/node/types.ts`)
  and AGENTS.md: keep helpers minimal until a second consumer needs
  more.
- **Import edge.** No longer a question: the helpers live in
  `fjs/asserts/module.f.js`, which `fjs/types` proofs already import from, so
  converting a holdout adds no new module edge.
- **Land in small PRs.** AGENTS.md asks for "one feature/improvement
  with minimal code changes" per PR; a single PR rewriting hundreds of
  lines is not in the spirit of that rule even if each diff is
  trivial. Folder-by-folder keeps reviews proportionate. Nothing to
  declare — these are test-only changes.
- **Coverage delta = zero.** The helper does not change what is
  asserted, only how. Tests must continue to pass without any
  expected-result edits; if they don't, the rewrite caught a
  pre-existing latent bug and that's a separate diff.

### Related

- i65Y-proof-by-export — discovery by exported
  `proof`; defines module-level asserts as the "light proof" tier (runs on every
  load → light, cheap checks only). `assertEq` is the helper that makes that
  tier ergonomic.
- `fjs/dev/module.f.mjs` — no longer defines `assert`/`assertEq` itself; both come from `fjs/asserts/module.f.js`.
- `fjs/sul/id/module.f.mjs:19`, `fjs/sul/id/proof.f.mjs:1`,
  `fjs/sul/proof.f.mjs:1`, `fjs/sul/level/hash/proof.f.mjs:1` — the four
  existing consumers, demonstrating the desired call-site shape.
- i194 (retired; shipped as `Test` and `TestContext` in
  [`fjs/effects/node/types.ts`](../../effects/node/types.ts)),
  `i65X-async-test-functions` (retired, and since shipped) —
  parallel work on the test framework's effect surface. The helper
  story above is intentionally smaller and orthogonal; it does not
  touch the `Reporter`/`TestEntry`/`testAll` path. Both halves of the async
  gap closed: the `registerModule` path gained the `Await` operation
  (`Await` in `fjs/effects/node/types.ts`, threaded through `Test`'s
  signature), and the `sandbox` path was split out as `i65X-sandbox-async`, which
  its own retired file records as done.
- i183 — scenario-style tests
  for the test framework itself. If `assertEq` adoption surfaces a
  meaningful failure-message regression, the scenario tests are the
  right place to lock the new behaviour in.
