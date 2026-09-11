## inert-type-level-proofs. 70 `Assert<…>` typedefs in proofs check nothing

**Priority:** P2
**Status:** open

### Problem

[`fjs/AGENTS.md` §3.2](../fjs/AGENTS.md) named a function-local JSDoc
`@typedef` as "the normal home for compile-time proof types", pointing at the
`consistency` and `signatures` entries in `fjs/edag/proof.f.mjs` and
`fjs/effects/proof.f.mjs`. Many of those are green whatever they claim.

**The mechanism, corrected.** This issue first said TypeScript never evaluates
a function-local typedef, because "the constraint of a declaration nothing
references is not resolved". That is not it, and the real rule is narrower and
sharper: **a JSDoc comment binds to the statement that follows it.** With no
statement after it there is nothing to bind to, the declaration is never
created, and its constraint is never resolved. Measured on a scratch file:

| form | result |
| --- | --- |
| `@typedef` last in a block | inert |
| any statement after it | TS2344 |
| three in a row, nothing after | all three inert |
| three in a row, one statement after | all three flagged |
| one, a statement, then a trailing one | only the first flagged |

So a proof entry whose body is *nothing but* typedefs checks nothing, and one
whose typedefs are followed by an `assert` call works exactly as intended.
That is the whole difference, and it explains both of the original
falsifications and why `fjs/ebnf/ll1/proof.f.mjs`'s `constParameter` — a
typedef followed by `assertStructurallySame` — is genuinely load-bearing:
falsifying it gives TS2344 at its own line.

The same six assertions moved to module scope in `fjs/nanvm/types.ts` fail
loudly (`TS2344: Type 'false' does not satisfy the constraint 'true'`) on the
first edit and on a widening of `Case<N>['args']`, which is what a proof is
for.

This is the failure §1.4 already warns about in its other form: it forbids
`true as _Predicate` because "the assertion compiles no matter what the
predicate resolved to".

**The count, measured rather than grepped.** Every `Assert` typedef in the
repository was falsified — the 116 single-line ones by replacing the claim
with `Assert<Equal<1, 2>>` and keeping the name so references still resolve,
the 9 multi-line ones by replacing their first type argument — and `tsc` run
over the falsified tree. A checked one reports TS2344 at its own line; an
inert one says nothing. Of **125 across 23 files, 55 are checked and 70 are
inert**, in ten files:

| file | inert |
| --- | --: |
| `fjs/edag/proof.f.mjs` | 28 |
| `fjs/rtti/ts/proof.f.mjs` | 9 |
| `fjs/edag/amnesia/proof.f.mjs`, `fjs/effects/proof.f.mjs` | 8 each |
| `fjs/types/object/proof.f.mjs`, `fjs/djs/parser/grammar/proof.f.mjs` | 4 each |
| `fjs/ebnf/byte/proof.f.mjs` | 3 |
| `fjs/media/json/schema/proof.f.mjs`, `fjs/media/revision/proof.f.mjs`, `fjs/rtti/proof.f.mjs` | 2 each |

The first table counted every typedef in a proof file, including the 55 that
work: `fjs/rtti/parse/proof.f.mjs`, `fjs/rtti/validate/proof.f.mjs`,
`fjs/types/result/proof.f.mjs`, `fjs/types/nullable/proof.f.mjs`,
`fjs/protocol/mcp/proof.f.mjs` and `fjs/js/keywords/proof.f.mjs` have none
inert. `fjs/effects/proof.f.mjs` does, all eight, and every one is
multi-line — its `signatures` entry ends with them, which is the inert shape
exactly. §3.2 named that entry alongside `consistency` as a model to follow.

Each inert one is a green leaf asserting nothing. Worse than an absent check: a leaf that
cannot fail is indistinguishable from one that passes, and it survives the
refactor that makes its claim false. The `fjs/edag` ones are the sharpest loss
— they are the `Assert<Check<…>>` pins that the README says keep `types.ts` and
the rtti schema from drifting, and they would not notice if it did.

Nothing is known to be *wrong* underneath: the claims were true when written.
What is gone is any guarantee they still are — and the drift they would miss
is not hypothetical in shape. Removing the `['|.', index]` production from
`fjs/edag/module.f.mjs`'s `regionProductions` **and** from its `@type` tuple
together leaves `OptionLambda` and `OptionPropertyLambda` both declaring an
arm the schema no longer accepts: exactly the divergence `Assert<Check<…>>`
exists to catch, and `tsc -p .` exits 0. Consistent edits to a schema and its
annotation are the likely way in, since an inconsistent one the annotation
still catches. (Measured before that thunk existed, when the production sat
in `_optionLambda` itself; the shape is the same either way.)

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

**Adding a statement after the run would also work**, and is worth naming so
it is rejected on purpose rather than missed. It leaves the claim one
reordering away from silent again, in a file whose other entries end with
their typedefs, so it fixes the instance and not the hazard. Take it only
where the entry already has statements and its typedefs merely drifted to the
end.

Do it per directory, so each lands with the `tsc` run that proves the
moved form bites: falsify each assertion once, see it fail, restore it. An
assertion moved without that check is the same inert leaf in a new place. The
whole-repository sweep above is the cheap version of that check and is worth
re-running after each directory: the inert count should fall by exactly the
number moved.

### Tasks

- [x] Correct `fjs/AGENTS.md` §3.2 and §1.4: §3.2 no longer calls a
      function-local typedef the normal home for a proof, and §1.4 states the
      binding rule, the measured table, and where a proof belongs.
- [ ] Move all 28 inert `fjs/edag/proof.f.mjs` assertions into
      `fjs/edag/types.ts`, falsifying each once to prove the moved form fails. Three chain-state
      pins are already there, added beside the unions they are about when
      `regionProductions` landed: `OptionLambda` and `PropertyLambda` are
      inside `OptionPropertyLambda`, and the wider state adds exactly three
      arms. Each was falsified once and went red. They overlap
      `_OptionLambda` and `_OptionPropertyLambda` without replacing them —
      those pin the schema against the type, these pin the types to each
      other.
- [ ] The same for the other nine files in the table, a directory at a time.
      Six files the first count named have nothing inert and need no work.
- [ ] `tsc` and `fjs test` clean after each, and the sweep's inert count
      down by the number moved.

### Related

- [`fjs/nanvm/types.ts`](../fjs/nanvm/types.ts) — the worked case: six
  assertions that were inert in `proof.f.mjs` and bite at module scope.
- [`fjs/types/array/types.ts`](../fjs/types/array/types.ts) — the form that
  works, predating this issue.
- [#1776](https://github.com/functionalscript/functionalscript/pull/1776) —
  where the defect was found, in review.
- [`jsdoc-verification.md`](./jsdoc-verification.md) — the other standing case
  of a JSDoc claim nothing checks.
