## inert-type-level-proofs. 89 `Assert<…>` typedefs in proofs check nothing

**Priority:** P2
**Status:** open

### Problem

[`fjs/AGENTS.md` §3.2](../fjs/AGENTS.md) names a function-local JSDoc
`@typedef` as "the normal home for compile-time proof types", pointing at the
`consistency` and `signatures` entries in `fjs/edag/proof.f.mjs` and
`fjs/effects/proof.f.mjs`. **TypeScript never evaluates them.** The constraint
of a declaration nothing references is not resolved, so an `Assert<…>` written
this way is green whatever it claims.

Two falsifications, each with `tsc` exiting 0 and printing nothing:

```js
// fjs/edag/proof.f.mjs:177 — claims op1Id's schema matches Op1Id
/** @typedef {Assert<Check<Op2Id, typeof op1Id>>} _Op1Id */   // Op2Id: still passes
```

```js
// fjs/nanvm/proof.f.mjs (before #1776 moved these) — claims a unary case has one operand
/** @typedef {Assert<Equal<Case<1>['args'], readonly[Value, Value]>>} _Unary */  // still passes
```

The same six assertions moved to module scope in `fjs/nanvm/types.ts` fail
loudly (`TS2344: Type 'false' does not satisfy the constraint 'true'`) on the
first edit and on a widening of `Case<N>['args']`, which is what a proof is
for.

This is the failure §1.4 already warns about in its other form: it forbids
`true as _Predicate` because "the assertion compiles no matter what the
predicate resolved to". A function-local typedef has the identical defect and
is currently *recommended* — which is why it has spread to **89 typedefs
across 15 files**:

| file | count |
| --- | --- |
| `fjs/edag/proof.f.mjs` | 24 |
| `fjs/rtti/parse/proof.f.mjs`, `fjs/rtti/proof.f.mjs`, `fjs/rtti/ts/proof.f.mjs` | 9 each |
| `fjs/effects/proof.f.mjs`, `fjs/rtti/validate/proof.f.mjs` | 8 each |
| `fjs/edag/amnesia/proof.f.mjs` | 5 |
| `fjs/djs/parser/proof.f.mjs`, `fjs/types/object/proof.f.mjs` | 4 each |
| `fjs/media/json/schema/proof.f.mjs`, `fjs/media/revision/proof.f.mjs`, `fjs/types/result/proof.f.mjs` | 2 each |
| `fjs/js/keywords/proof.f.mjs`, `fjs/protocol/mcp/proof.f.mjs`, `fjs/types/nullable/proof.f.mjs` | 1 each |

Each is a green leaf asserting nothing. Worse than an absent check: a leaf that
cannot fail is indistinguishable from one that passes, and it survives the
refactor that makes its claim false. The `fjs/edag` ones are the sharpest loss
— they are the `Assert<Check<…>>` pins that the README says keep `types.ts` and
the rtti schema from drifting, and they would not notice if it did.

Nothing is known to be *wrong* underneath: the claims were true when written.
What is gone is any guarantee they still are.

### Proposal

Move the assertions to module scope in a `.ts` file, where TypeScript resolves
them. `fjs/types/array/types.ts` is the precedent, and `fjs/nanvm/types.ts`
the worked case:

```ts
type _X1 = Assert<Equal<KeyOf<readonly [true]>, 0>>
```

Hoisting them to file scope inside the `.mjs` is **not** the fix: §3.2 forbids
a file-scope `@typedef` in authored `.mjs` outright.

Per file the target differs, and the choice is the work:

- A claim about a **published type** belongs beside it in that module's
  `types.ts` — `fjs/edag/proof.f.mjs`'s `Assert<Check<…>>` pins go to
  `fjs/edag/types.ts`, next to the types they pin.
- A claim about a **local inference** — a `const` type parameter's effect at a
  call site, say — has no `types.ts` home. It needs one written, or the
  claim needs restating as something a module-scope alias can hold.

Do it per directory, so each lands with the `tsc` run that proves the
moved form bites: falsify each assertion once, see it fail, restore it. An
assertion moved without that check is the same inert leaf in a new place.

Then correct §3.2 — a function-local `@typedef` is fine for an ordinary
local type and is *not* a home for a proof — and add the rule to §1.4 beside
the `true as _Predicate` prohibition it matches.

### Tasks

- [ ] Correct `fjs/AGENTS.md` §3.2 and §1.4: a compile-time proof goes at
      module scope in a `.ts` file, never in a function-local `@typedef`.
- [ ] Move the 24 `fjs/edag/proof.f.mjs` assertions into `fjs/edag/types.ts`,
      falsifying each once to prove the moved form fails.
- [ ] The same for the remaining 14 files, a directory at a time.
- [ ] `tsc` and `fjs test` clean after each.

### Related

- [`fjs/nanvm/types.ts`](../fjs/nanvm/types.ts) — the worked case: six
  assertions that were inert in `proof.f.mjs` and bite at module scope.
- [`fjs/types/array/types.ts`](../fjs/types/array/types.ts) — the form that
  works, predating this issue.
- [#1776](https://github.com/functionalscript/functionalscript/pull/1776) —
  where the defect was found, in review.
- [`jsdoc-verification.md`](./jsdoc-verification.md) — the other standing case
  of a JSDoc claim nothing checks.
