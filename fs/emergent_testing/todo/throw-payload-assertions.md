## throw-payload-assertions. Recover thrown-value checks lost by the `throw` marker

**Priority:** P3
**Status:** open

### Problem

[PR #1295](https://github.com/functionalscript/functionalscript/pull/1295) replaced every
hand-rolled `try`/`catch` throw-test with the structural [`throw`](../README.md#throw-tests)
marker, and [AGENTS.md](../../../AGENTS.md) now flatly bans `try`/`catch` in `.f.ts` files
(FunctionalScript itself has no `try`/`catch` and isn't planning one soon). Codex flagged the
regression this causes on that PR
([`fs/asserts/proof.f.ts:17`](../../asserts/proof.f.ts#L17)): `defaultTest` in
[`module.f.ts`](../module.f.ts) treats *any* caught exception under `throw` as a pass — it
never inspects *what* was thrown. The `try`/`catch` versions it replaced did:

```ts
// before (fs/asserts/proof.f.ts, pre-#1295)
assertThrowsCustomMsg: () => { throws(() => assert(false, 'oops'), 'oops') },
assertEqThrowsOnUnequal: () => {
    try { assertEq(1, 2) } catch (e) {
        const arr = e as readonly [unknown, unknown]
        if (arr[0] !== 1 || arr[1] !== 2) { throw ['wrong throw value', e] }
    }
},
```

Under the plain `throw` key, `assert(false, 'oops')` throwing `'anything'` instead of `'oops'`,
`assertEq(1, 2)` throwing the wrong tuple, or `todo()` throwing the wrong sentinel would all
still pass. The same gap exists in `fs/types/result/proof.f.ts`'s `unwrapError` (dropped the
check that `unwrap(error('oops'))` throws exactly `'oops'`, not some wrapped value) and
`fs/cas/cli/proof.f.ts`'s `mainListCorruptStore` (only checks *that* the storage error
surfaces, which was already all it checked). `fs/asserts/proof.f.ts` is the sharpest case
because it is the self-test of `assert`/`assertEq` themselves — the file that must catch a
regression where, say, `assert` degrades to swallowing its message.

There is currently no supported way in a proof to assert on a thrown *value*, only on whether a
throw happened.

### Proposal

Two alternatives; not mutually exclusive.

#### A. Move payload-checking cases to a sibling vanilla `proof.ts`

No new rule or framework change needed — the distinction already exists and is documented in
[fs/todo/document-file-type-naming-conventions.md](../../todo/document-file-type-naming-conventions.md#proof--a-module-that-proves-other-modules):
`proof.f.ts` is FunctionalScript (no `try`/`catch`, ever), `proof.ts` is vanilla TS and is
already exempt from that rule — [`fs/effects/node/memory/proof.ts`](../../effects/node/memory/proof.ts)
is a live example (it isn't the shape we need here, since it captures a rejected `Promise` via
`.then(onFulfilled, onRejected)` rather than `try`/`catch`, but it proves the file-type split
already works and is already discovered by `fjs t` — `shouldLoad` in
[`fs/dev/module.f.ts`](../../dev/module.f.ts#L41) matches any `*proof.ts` filename alongside
`*.f.ts`). AGENTS.md's `.f.ts` rule needs no change: it never applied to `proof.ts` in the first
place. The fix for `fs/asserts/proof.f.ts` and `fs/types/result/proof.f.ts` is simply to move
just the payload-checking cases (`assertThrowsCustomMsg`, `assertEqThrowsOnUnequal`,
`assertEqThrowsOnUnequal3`, `todoThrows`, `unwrapError`) into a sibling `proof.ts` in the same
directory, using ordinary `try`/`catch`, while the rest of each module's coverage stays in
`proof.f.ts`. `loadModuleMap` treats the two files as independent module-map entries, so both
`proof` exports run.

#### B. A `try`/`catch` structural leaf pair

Extend the marker vocabulary (`throw` / [`todo`](./todo-property.md) /
[`skip`](./skip-property.md)) with a leaf shape recognized by `parseTestSet`: an object with
exactly the two keys `try` and `catch`, instead of a bare zero-argument function:

```ts
export const proof = {
    assertThrowsCustomMsg: { try: () => assert(false, 'oops'), catch: e => assertEq(e, 'oops') },
    unwrapError: { try: () => unwrap(error('oops')), catch: e => assertEq(e, 'oops') },
}
```

- `try` is called first. If it returns normally, the leaf fails (an expected throw didn't
  happen) — same failure mode as a plain `throw` leaf today.
- If `try` throws, `catch` is called with the thrown value. `catch` is ordinary proof code —
  it can call `assert`/`assertEq`, and throwing (i.e. an assertion failing) is the leaf's real
  failure signal.
- No raw `try`/`catch` is needed in `module.f.ts` to implement this: the module already routes
  every leaf call through the `sandbox` effect (`fs/effects/node/module.f.ts`), which is
  implemented in the host runtime (not `.f.ts`) and already exposes the thrown value as
  `SandboxResult.result`'s `error` case. `defaultTest` can sandbox `try`, and on an `error`
  result sandbox `() => catchFn(thrownValue)` as the leaf's real verdict — two effect calls,
  no bare `try`/`catch` written in FunctionalScript.
- Interacts with `throw`: a `{ try, catch }` leaf doesn't need to sit under `throw` — the pair
  already encodes "expected to throw" on its own. Nesting one under `throw` should probably be
  a static error (redundant/contradictory expectation) rather than silently accepted.

This keeps the flat "`.f.ts` never uses `try`/`catch`" rule intact and gives every proof author
a supported way to check a thrown payload, not just the three sites this issue is about.

### Open questions

- Is A sufficient on its own? It requires a whole extra file per directory that needs even one
  payload check, which is heavier than a single `{ try, catch }` leaf inline in the existing
  `proof.f.ts` — worth revisiting once A is tried on the sites below to see whether the extra
  file is annoying enough in practice to justify B.
- Exact discriminator in `parseTestSet` for B: matching on `{ try, catch }` two-key objects
  works as long as no real sub-tree of tests is ever named with keys `try` and `catch`
  together. Worth a quick grep before committing to the shape.
- Should `catch`'s own return value be walked as a sub-tree (like a normal test), or treated as
  a pure leaf (like `todo`)? Leaning toward leaf-only — `catch` exists to assert, not to
  generate further cases.
- Reporter/CLI wording: today a passing `throw` leaf prints `# EXPECTED TO THROW`; a `{ try,
  catch }` leaf needs its own annotation (e.g. `# EXPECTED TO THROW (checked)`) so the two are
  distinguishable in output.

### Tasks

- [ ] Move `assertThrowsCustomMsg`, `assertEqThrowsOnUnequal`, `assertEqThrowsOnUnequal3`,
      `todoThrows` (`fs/asserts/`) and `unwrapError` (`fs/types/result/`) into a sibling
      `proof.ts` per directory (Proposal A), restoring the dropped payload checks with
      `try`/`catch`.
- [ ] Decide, after using A for a while, whether B's inline `{ try, catch }` marker is still
      worth building, or whether A's file-per-directory cost is acceptable.
- [ ] If B: add the `{ try, catch }` leaf shape to `parseTestSet`/`collectTests`/`TestEntry` in
      `fs/emergent_testing/module.f.ts`, wire `defaultTest` to sandbox `catch` on a caught
      throw, and extend `registerModule` for the external-framework path (Node `--test`,
      Bun, Playwright).
- [ ] If B lands and simplifies things, consider migrating the `proof.ts` siblings from A back
      into their `proof.f.ts`.
- [ ] Document whichever marker/pattern is chosen in `fs/emergent_testing/README.md` next to
      [Throw tests](../README.md#throw-tests).
- [ ] Confirm `fjs t` proofs pass with full branch coverage and `npx tsc` is clean.

### Related

- [PR #1295](https://github.com/functionalscript/functionalscript/pull/1295) — introduced the
  `.f.ts` `try`/`catch` ban and, as a side effect, dropped the payload checks this issue
  proposes to restore.
- [todo-property](./todo-property.md), [skip-property](./skip-property.md) — the same
  structural-marker mechanism this proposal extends.
- `fs/asserts/proof.f.ts`, `fs/types/result/proof.f.ts` — the sites that lost payload checks.
