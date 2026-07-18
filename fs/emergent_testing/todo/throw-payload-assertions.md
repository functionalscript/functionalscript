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

Two alternatives; pick one (or both, for different situations):

#### A. Narrow `try`/`catch` exception for payload-checking proofs

Carve out an explicit, narrow exception in AGENTS.md: `try`/`catch` is allowed in a `proof.f.ts`
leaf **only** when the test's entire purpose is to inspect the thrown value, and only paired
with a comment stating why the `throw` marker isn't enough (mirroring the existing
"self-test independence" comment `fs/asserts/proof.f.ts` used to carry). This is the smallest
change — it reverts the three sites above — but re-opens the door AGENTS.md just closed, and
gives every future proof author a judgement call ("is my case one of the exceptions?") instead
of a flat rule.

#### B. A `try`/`catch` structural leaf pair (preferred)

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

- Exact discriminator in `parseTestSet`: matching on `{ try, catch }` two-key objects works as
  long as no real sub-tree of tests is ever named with keys `try` and `catch` together. Worth a
  quick grep before committing to the shape.
- Should `catch`'s own return value be walked as a sub-tree (like a normal test), or treated as
  a pure leaf (like `todo`)? Leaning toward leaf-only — `catch` exists to assert, not to
  generate further cases.
- Reporter/CLI wording: today a passing `throw` leaf prints `# EXPECTED TO THROW`; a `{ try,
  catch }` leaf needs its own annotation (e.g. `# EXPECTED TO THROW (checked)`) so the two are
  distinguishable in output.

### Tasks

- [ ] Decide between Proposal A and Proposal B (or land B and treat A as unnecessary once B
      exists).
- [ ] If B: add the `{ try, catch }` leaf shape to `parseTestSet`/`collectTests`/`TestEntry` in
      `fs/emergent_testing/module.f.ts`, wire `defaultTest` to sandbox `catch` on a caught
      throw, and extend `registerModule` for the external-framework path (Node `--test`,
      Bun, Playwright).
- [ ] Migrate `fs/asserts/proof.f.ts`, `fs/types/result/proof.f.ts` (`unwrapError`) back to
      payload-checking tests using whichever proposal is chosen.
- [ ] Document the new marker in `fs/emergent_testing/README.md` next to
      [Throw tests](../README.md#throw-tests).
- [ ] Update AGENTS.md's `try`/`catch` rule to point at the supported payload-checking path.
- [ ] Confirm `fjs t` proofs pass with full branch coverage and `npx tsc` is clean.

### Related

- [PR #1295](https://github.com/functionalscript/functionalscript/pull/1295) — introduced the
  flat `try`/`catch` ban this issue proposes a supported escape hatch for.
- [todo-property](./todo-property.md), [skip-property](./skip-property.md) — the same
  structural-marker mechanism this proposal extends.
- `fs/asserts/proof.f.ts`, `fs/types/result/proof.f.ts` — the sites that lost payload checks.
