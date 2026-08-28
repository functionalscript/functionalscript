# End chain lambdas by absence, not `null`

**Priority:** P3
**Status:** open

## Problem

The chain grammar spells "the chain ends here" as a literal `null`, in two
roles: as a member of all three lambda unions (`['.', a, 'b', null]` is a
plain read), and as the terminals' stated third operand — `['|()', exp, null]`
in `propertyLambda`, `['|!()', exp, null]` in `optionPropertyLambda`. That
gives `null` double duty in a graph — primitive value *and* chain terminator —
and puts a fourth element on every plain property access, the first cost named
in "The cost" of [`../README.md`](../README.md).

rtti has a schema built to mean exactly "the member that is not there":
[`option`](../../rtti/module.f.mjs). A continuation is always the last operand
of a closed tuple, which is precisely the position where absence is observable
and where `TupleTs` renders it as an exact optional element. So the chain
could end by the operand *not being there*: `['.', a, 'b']`, `['|()', c]`,
`['|!()', c]`.

The module's recorded argument against this is stale. "Terminals state their
`null` … were the terminal two elements long, a continuation handed to a
`propertyLambda` slot would be read as the terminal with the rest silently
dropped" (`../module.f.mjs`, `../README.md`) was written when the chain
grammar landed (53077ae, 2026-08-26) — **against open-by-default tuples**,
where it was true. Bare tuples became closed by length one day later
(7852819, 2026-08-27), whose design issue was titled "closed containers by
default, then `option` as omission" (930fa65, #1725) — this issue is the
second half of that plan. Under the closed model a two-element terminal handed
a continuation is rejected by length, not truncated.

## Investigation (2026-08-28, verified)

### Runtime, against the real `validate`

With a `dot` whose fourth position is `or(option, …)` and step schemas ending
by absence:

| value | result | why |
|---|---|---|
| `['.', a, 'b']` | ok | absent continuation — the plain read |
| `['.', a, 'b', ['\|()', c]]` | ok | two-element terminal step |
| `['.', a, 'b', ['\|()', c, ['\|()', d]]]` | error | the "silent drop" fear: closedness answers by length and **rejects** |
| `['.', a, 'b', undefined]` | error | absence is not a spelling of `undefined` |
| `['.', a, 'b', null]` | error | `null` leaves the chain vocabulary entirely |
| `['.', a, 'b', ['\|()', c], 'junk']` | error | closed node tuple, as today |
| `['.', a, 'b', ['\|?.()', c, ['\|.', 'd']]]` | ok | recursion through the thunks unaffected |

### Type level, under the repository's flags

Compiles clean (including `exactOptionalPropertyTypes`), with each negative
row above a genuine type error:

- Hand-written types use optional trailing tuple elements, which `Ts` renders
  **exactly** (`_OptionalTail` in [`../../rtti/ts/proof.f.mjs`](../../rtti/ts/proof.f.mjs)):

  ```ts
  type PropertyLambda =
      | readonly['|()', Exp]                          // terminal: genuinely shorter
      | readonly['|?.()', Exp, OptionLambda?]
  type OptionLambda =
      | readonly['|()', Exp, OptionLambda?]
      | readonly['|.', Index, OptionPropertyLambda?]
  type OptionPropertyLambda =
      | readonly['|()', Exp, OptionLambda?]
      | readonly['|.', Index, OptionPropertyLambda?]
      | readonly['|?.()', Exp, OptionLambda?]
      | readonly['|!()', Exp]                         // terminal
  type Dot = readonly['.', Exp, Index, PropertyLambda?]
  ```

- The recursive thunks' roots now admit absence, so their `Phantom`
  annotations must carry the flag in the wrapper —
  `Phantom<typeof _optionLambda, AbsentOr<OptionLambda>>` — pinned with
  `CheckRaw` **in addition to** `Check3`, which cannot see the flag (the
  public `Ts` strips absence from both sides). See the `Ts` JSDoc in
  [`../../rtti/ts/types.ts`](../../rtti/ts/types.ts). This would be the first
  real consumer of the `AbsentOr`/`CheckRaw` pattern — currently documented
  with zero users — and it was verified to compile with the mutual recursion
  above. `propertyLambda` is not phantom-wrapped, so it needs no wrapper:
  `_AdmitsAbsence` walks its `or` directly.

### What is gained

- `null` in a graph means one thing again: the primitive value.
- Every plain property access and every chain end drops one element — fewer
  elements to store and hash.
- "The chain ends" is spelled as absence, which is what `option` is for.

### Trailing holes must be rejected in the same change

`option` admits a hole as absence, so the sparse `['.', a, 'b', ,]` — length
4, index 3 a hole — **also validates** (verified), a second spelling with a
second hash for the same function, where today's required-`null` schema
rejects every hole. FunctionalScript cannot produce it — "Two adjacent commas
are not an elision: an array has no holes"
([`../../../spec/README.md`](../../../spec/README.md), Arrays) — and a hole
even *evaluates* identically to absence (reading it yields `undefined`), so
the leak is canonicality-only. It is still a validation regression against
today's schema, and a regression may not be deferred behind a todo
([`AGENTS.md`](../../../AGENTS.md) §1, "Merge the knowledge"): the migration
does not land unless the same change keeps `validate(exp)` rejecting a
trailing hole, pinned in the proofs. Two mechanisms qualify, either is
acceptable:

1. **Arity-split unions, no `option` at all** (verified against the real
   `validate`, no rtti change needed). Each node or step whose continuation
   may end is a union of its two closed arities —
   `or(['.', exp, index], ['.', exp, index, propertyLambda])`, and likewise
   per step — so absence is spelled by the shorter tuple and a hole matches
   neither arm: the 3-arity arm rejects length 4, the 4-arity arm has no
   `option` and rejects the absent member. `['.', a, 'b', ,]` and
   `['|()', c, ,]` both reject; every acceptance row in the table above is
   unchanged. Costs: each such kind doubles its union arms, the shared prefix
   is written twice, and the `AbsentOr`/`CheckRaw` machinery drops out
   (hand-written types are plain unions of exact tuples, no optional
   elements).
2. **An rtti rule first: absence in a tuple is the array ending before the
   position, never a hole** — the const- and rest-tuple validators' absent
   branch additionally requires the index to lie at or past `value.length`.
   One condition, and it aligns the readers' array domain with DJS, which has
   no sparse arrays — the same direction as
   [`data-validate-admits-non-djs-values`](../../rtti/todo/data-validate-admits-non-djs-values.md).
   But it reverses documented rtti behavior (`option`'s "position 0 may be a
   hole"; `_InteriorTs` rendering interior absence as "what reading a hole
   gives") across all three readers and the printer, so it needs its own rtti
   issue and lands **before** this migration, which then keeps the `option`
   spelling and machinery described above.

## Proposal

Replace the `null` member of all three lambda schemas with `option`, drop the
terminals' third operand, and let the continuation positions of `dot`,
`optionDot`, `optionCall` and the steps end by absence — spelled with
`option` under mechanism 2 above, or as arity-split unions under mechanism 1
(same accepted values either way). Code changes are small; the bulk is
mechanical respelling of proofs and prose.

[amnesia](../amnesia/module.f.mjs) barely changes: its four `k === null`
checks become `k === undefined`, since reading the continuation position of a
shorter tuple yields `undefined` — which the schema guarantees is not a
present value there.

### Tasks

- [ ] `../module.f.mjs`: `option` for `null` in the three lambda unions;
  terminals become closed 2-tuples; `AbsentOr` phantom annotations plus
  `CheckRaw` asserts for `_optionLambda`/`_optionPropertyLambda`
- [ ] `../types.ts`: the optional-element types above
- [ ] `../amnesia/module.f.mjs`: `k === null` → `k === undefined`; signatures
  take `… | undefined`
- [ ] `../proof.f.mjs`, `../amnesia/proof.f.mjs`: respell (~200 trailing
  `null`s); add rejections for present `null`, present `undefined`, and the
  smuggled continuation on a terminal; the `unspellable` family list holds
- [ ] `../README.md`: node and spelling tables; "Terminals state their
  `null`" inverts into "closedness by length rejects a smuggled
  continuation"; "The cost" shrinks
- [ ] reject trailing holes **in the same change** — mechanism 1
  (arity-split unions) or mechanism 2 (the rtti past-the-end rule, filed and
  landed first) above; pin `['.', a, 'b', ,]` and `['|()', c, ,]` rejecting
  in `../proof.f.mjs`

## Related

- [`../README.md`](../README.md) — Chains; "Terminals state their `null`";
  The cost
- [`option`](../../rtti/module.f.mjs),
  [`AbsentOr`/`CheckRaw`/`TupleTs`](../../rtti/ts/types.ts) — the machinery,
  proven in [`../../rtti/ts/proof.f.mjs`](../../rtti/ts/proof.f.mjs)
- 7852819 / 930fa65 (#1725) — closed containers by default, then `option` as
  omission; this issue is that plan's second half applied to edag
- [`../../rtti/todo/identity-aware-parse.md`](../../rtti/todo/identity-aware-parse.md)
  — the Stage 2 validator the hole check could join
