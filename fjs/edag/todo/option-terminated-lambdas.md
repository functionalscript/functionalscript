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

Both findings above verify the `option` spelling — the alternative the hole
question below ends up rejecting. They stay as the record of what was
established; the chosen arity-split spelling needs none of that machinery,
its hand-written types being plain unions of exact tuples, the pattern the
schema already uses today.

### What is gained

- `null` in a graph means one thing again: the primitive value.
- Every plain property access and every chain end drops one element — fewer
  elements to store and hash.
- "The chain ends" is spelled by the operand not being there — a shorter
  closed tuple.

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
trailing hole, pinned in the proofs.

**The chosen mechanism is arity-split unions, no `option` at all** (verified
against the real `validate`, no rtti change needed). Each node or step whose
continuation may end is a union of its two closed arities —
`or(['.', exp, index], ['.', exp, index, propertyLambda])`, and likewise per
step — so absence is spelled by the shorter tuple and a hole matches neither
arm: the 3-arity arm rejects length 4, the 4-arity arm has no `option` and
rejects the absent member. `['.', a, 'b', ,]` and `['|()', c, ,]` both
reject; every acceptance row in the table above is unchanged. Costs: each
such kind doubles its union arms, the shared prefix is written twice, and
the `AbsentOr`/`CheckRaw` machinery drops out — hand-written types are plain
unions of exact tuples, no optional elements.

One boundary of the gate, measured both below and past `length`: a
**prototype-supplied index** is rtti's host question, not this migration's,
and the answers are symmetric between the spellings. The tuple readers
decide presence by HasProperty and read a below-`length` index through the
prototype, held to the schema (`constContainerValidate` in
[`../../rtti/validate/module.f.mjs`](../../rtti/validate/module.f.mjs)),
and never answer an index at or past `length` — both stated, with the
`Array.prototype[10] = 99` example, in "Beyond `length`" in
[`../../rtti/README.md`](../../rtti/README.md), as a caveat that "applies
to `array`, `record` and every container schema alike". So a polluted
`Array.prototype` reaches both spellings, and only each one's own
vocabulary decides which values flip: behind `['.', a, 'b', ,]`'s own
length-4 hole, an inherited `['|()', c, null]` validates under **today's**
schema and rejects under the split one, an inherited `['|()', c]` exactly
the reverse; past the end, the split 3-arity arm accepts a length-3
`['.', a, 'b']` whatever `Array.prototype[3]` holds — the unanswered
region every bare tuple in the repository already has — while today's
schema accepts the same length-3 value the moment `Array.prototype[3]` is
its own `null`. Neither spelling is pollution-proof, neither ever was, and
under a pristine prototype — the only host DJS admits — both reject every
hole and every spelling has exactly one length. The executor is already
safe on the unanswered region: [amnesia](../amnesia/module.f.mjs) reads
nodes by **destructuring**, and the array iterator stops at `length`, so a
prototype-supplied index past the end is never read — measured: with
`Array.prototype[3] = 'junk'`, the destructured fourth slot of a length-3
node is `undefined` and the chain ends, while a direct `node[3]` would
read `'junk'`. The gate's claim is therefore about the value's **own**
members under rtti's stated reading model; hermetic reads for hostile
hosts are rtti's tracked question
([`hostile-accessor-hermetic-read-path`](../../rtti/todo/hostile-accessor-hermetic-read-path.md)),
not an EDAG-boundary duplicate.

**The rejected alternative** — keep the `option` spelling and first land an
rtti rule that absence in a tuple is the array ending before the position,
never a hole (the validators' absent branch requiring the index at or past
`value.length`) — was weighed across three review rounds of
[#1755](https://github.com/functionalscript/functionalscript/pull/1755) and
rejected because its prerequisite grows into an open-ended redesign of
rtti's canonical algebra, not one condition. The rule aligns the readers'
array domain with DJS (no sparse arrays — the direction of
[`data-validate-admits-non-djs-values`](../../rtti/todo/data-validate-admits-non-djs-values.md)),
but it cascades: it reverses documented reader and printer behavior
(`option`'s "position 0 may be a hole"; `_InteriorTs`'s "what reading a hole
gives"); it collapses `[option]` into `[]` — one set once `new Array(1)` is
excluded — while `trimPrefix` in
[`../../rtti/data/module.f.mjs`](../../rtti/data/module.f.mjs) deliberately
keeps their canonical `Node`s distinct, so `arraySet` must renormalize and
`cmp`/`equal`/`subset`, the data reader, and the printer must follow; it
makes every **interior** absent bit unobservable (absence at a position is
realizable only when every later position also admits it, so
`[or(option, number), 3]` comes to denote `[number, 3]` while `toData` keeps
the `absentBit`), so those bits must be stripped, the trailing-run split
`TupleTs` already makes; and even that strip has no local answer for a
**referenced** node — the data form declines to see through a reference
(`trimPrefix` leaves referenced positions alone), and a rule like
`r = or(option, [r])` may sit at one position where its root absence is
unobservable and another where it is not, so stripping the rule itself
changes the fixpoint, and the design would need contextual specialization or
a stated canonicality exception. All of that as a prerequisite for a
migration that does not need it; anyone wanting the past-the-end rule on its
own merits files it as an rtti issue.

## Proposal

Drop the `null` member of all three lambda unions and the terminals' third
operand, and let the continuation positions of `dot`, `optionDot`,
`optionCall` and the steps end by the operand's absence — spelled as
arity-split unions, per the chosen mechanism above: each node or step whose
continuation may end becomes a union of its two closed arities, with no
`option` anywhere in the chain schemas. Code changes are small; the bulk is
mechanical respelling of proofs and prose.

[amnesia](../amnesia/module.f.mjs) barely changes: its four `k === null`
checks become `k === undefined`, since reading the continuation position of a
shorter tuple yields `undefined` — which the schema guarantees is not a
present value there.

### Tasks

The schemas must not mix the spellings: an arity-split arm whose lambda root
carries `option` admits the absent member — and its hole — again.

- [ ] `../module.f.mjs`: every lambda union and continuation-carrying node
  splits by arity — no `option` member in any of them, terminals are the
  shorter arm, phantom annotations stay plain
- [ ] `../types.ts`: plain unions of exact tuples, one per arity, no
  optional elements
- [ ] `../amnesia/module.f.mjs`: `k === null` → `k === undefined`;
  signatures take `… | undefined`; keep the destructuring reads — the
  iterator stops at `length`, so a prototype-supplied index past a short
  node's end is never read (see the gate boundary above) — and never
  switch a continuation read to direct indexing
- [ ] `../proof.f.mjs`, `../amnesia/proof.f.mjs`: respell (~200 trailing
  `null`s); add rejections for present `null`, present `undefined`, the
  smuggled continuation on a terminal, and the trailing holes
  `['.', a, 'b', ,]` and `['|()', c, ,]`; the `unspellable` family list
  holds
- [ ] `../README.md`: node and spelling tables; "Terminals state their
  `null`" inverts into "closedness by length rejects a smuggled
  continuation"; "The cost" shrinks
- [ ] downstream designs and other repo-wide chain spellings:
  [`../../djs/todo/compile-modules-to-edag.md`](../../djs/todo/compile-modules-to-edag.md)
  and [`../../djs/todo/interpret-edag.md`](../../djs/todo/interpret-edag.md)
  both prescribe `['.', object, property, null]` and `['|()', args, null]`
  for stages not yet implemented, which would produce or expect invalid
  EDAG after the migration; respell them,
  [`../../../todo/blocked/bun-optional-chain-parentheses.md`](../../../todo/blocked/bun-optional-chain-parentheses.md),
  and whatever else a sweep for chain spellings finds — released
  `changelog/` entries stay as written, history rather than prescription

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
