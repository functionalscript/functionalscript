# A grammar for chain nodes

**Priority:** P2
**Status:** open

## Problem

[`chain-nodes.md`](./chain-nodes.md) settled what a chain node set should mean —
**the shortest valid form**, where an expression that can be split into two is
split — and then had to record that none of it fits in the schema:

> With `lambdas` as `array(lambda)`, neither `array(T)` nor `or` states
> cardinality or order, so the conditions are lowering rules plus a validation
> pass, and `validate` accepts graphs the lowering never emits.

So the design was right and unenforceable. Four duplicate families slipped
through the schema, the minimality rule lived in prose, and a walker's shape had
to be described rather than typed.

This proposal makes the rule structural. It replaces the flat `Lambdas` array
with three mutually recursive lambda types, one per state a chain can be in.
Nothing is forbidden; the wrong shapes stop being expressible.

## The two bits

`chain-nodes.md` opens by observing that hidden control flow comes in exactly
two kinds: a **receiver** handed from a property access to a call, and a
**short-circuit** region opened by an optional operator. Those are the two bits
of state a chain carries, and they are what the lambda types track:

- **P** — a receiver is live
- **O** — a short-circuit region is open

Which is why there are three lambda types and not four. `00` is "neither is
live", and that is the definition of a node boundary — the fourth cell is `Exp`.

| | outside an option | inside an option |
| --- | --- | --- |
| **receiver live** | `PropertyLambda` | `OptionPropertyLambda` |
| **value only** | *(an `Exp`)* | `OptionLambda` |

Each node hands its continuation the state it produces: `Dot` a property,
`OptionDot` a property inside a region, `OptionCall` a value inside a region,
and `Call` a bare value — which is why `Call` alone takes no lambda.

## The grammar

```ts
// a(b)
type Call = ['()', Exp, Exp]

// a.bc
type Dot = ['.', Exp, Index, PropertyLambda]

// a?.bc
type OptionDot = ['?.', Exp, Index, OptionPropertyLambda]

// a?.(b)c
type OptionCall = ['?.()', Exp, Exp, OptionLambda]

type PropertyLambda =
    | null
    | ['()', Exp]
    | ['?.()', Exp, OptionLambda]

type OptionLambda =
    | null
    | ['()', Exp, OptionLambda]
    | ['.', Index, OptionPropertyLambda]

type OptionPropertyLambda =
    | null
    | ['()', Exp, OptionLambda]
    | ['.', Index, OptionPropertyLambda]
    | ['?.()', Exp, OptionLambda]
    | ['!()', Exp]
```

Four node kinds, down from the seven in `chain-nodes.md`, and no walkers.

The lambda tags are written bare above to keep the shape readable. They cannot
stay that way: they collide with the node tags, and
[Open questions](#open-questions) shows the witness and why `close` does not
help. Read every lambda tag below as needing a prefix.

## Reading it

Four steps, each a transition on the two bits:

| step | effect | reading |
| --- | --- | --- |
| `.` | sets P, keeps O | a property access produces a receiver |
| `()` | clears P, keeps O | a call consumes it |
| `?.()` | clears P, **sets** O | a call consumes it and opens a region |
| `!()` | clears P, **clears** O | a call consumes it and closes the region |

`?` adds a guard and `!` escapes one, which makes `OptionPropertyLambda`'s three
call forms a complete taxonomy of how a call can relate to the region it sits in:

| tag | relationship | example |
| --- | --- | --- |
| `()` | inherits the region's guard | `a?.b(...c)` — skipped when `a` is nullish |
| `?.()` | adds its own | `a?.b?.(...c)` — also checks `b` |
| `!()` | escapes it | `(a?.b)(...c)` — happens regardless, receiver kept |

There is no fourth combination, and `!` pairs only with `()` because only calls
consume receivers — a close-then-access `!.` would just be a `Dot` over the
node, which nesting already spells.

### Every production is forced

A step needs a production in a state exactly when moving it into a nested node
would be **observable**. Each alternative below is justified by a live bit, and
which bit says why it cannot be a node:

| state | production | justified by | hands on |
| --- | --- | --- | --- |
| `PropertyLambda` | `['()', Exp]` | P — nesting loses `this` | *(exits)* |
| | `['?.()', Exp, …]` | P | O |
| `OptionLambda` | `['()', Exp, …]` | O — the region must cover the call | O |
| | `['.', Index, …]` | O | OP |
| `OptionPropertyLambda` | `['()', Exp, …]` | O and P | O |
| | `['.', Index, …]` | O alone | OP |
| | `['?.()', Exp, …]` | O and P | O |
| | `['!()', Exp]` | P — the region is closing anyway | *(exits)* |

Both terminals are the two steps that produce a value **outside** an option —
one because there never was a region, one because it just closed one. `null` is
the third exit: the chain simply ends, and any live bit is dropped. That is also
the correct spelling of a bare `(a?.b)`, since closing a region with nothing
after it is unobservable ([the parenthesis law](./chain-nodes.md)).

### The absences carry the rule

Two kinds, and only the second is a design decision:

- **Undefined transition.** `!()` outside a region — there is no bit to clear.
- **Available nesting.** `.` in `PropertyLambda`, and `?.()` and `!()` in
  `OptionLambda`. In each, no live bit would be destroyed by moving the step
  into its own node, so the production would be a second spelling.

The sharpest case is `.`, which appears in `OptionPropertyLambda` and not in
`PropertyLambda`. Same step, same wasted receiver both times; the difference is
that O is live in one, so the region will not let it leave. That single
asymmetry **is** the parenthesis law, and it is the one production that exists to
protect a bit other than the one it consumes.

## What stops being expressible

The four duplicate families `chain-nodes.md` lists under Open questions are not
forbidden here — they cannot be written:

| family | why it is unspellable |
| --- | --- |
| `a?.b?.c` | no lambda has a `?.` production; `?.` is only ever a node tag |
| `a.b(...c)?.d` | `PropertyLambda`'s `['()', Exp]` is terminal, so the chain exits |
| `(a?.(...b))(...c)` | `OptionLambda` has no `!()`; the outer call is a plain `Call` |
| `a?.b(...c)?.d` | `OptionLambda` has no `?.()`; the guarded access starts a node |

The same holds for the dead-prefix rule: `PropertyLambda` has no `.` production,
so plain property paths nest and `a.b.c` has exactly one spelling. Read "exactly one"
throughout as *up to trailing elements*: RTTI tuples are open on that side by
design, so `['|()', args, null, 'extra']` validates against the continuing
production and an executor reading declared fields ignores the extra. That is
not a property of this grammar — it holds of every tuple in the current node set
too — and it does not multiply *graphs*, because `parse` drops what the schema
does not declare:

```
parse(['()', Exp, Exp])  ['()','f',null]              -> ok ['()','f',null]
                         ['()','f',null,'extra']      -> ok ['()','f',null]
                         ['()','f',null,'e1','e2']    -> ok ['()','f',null]
```

`validate` keeps them ([`../../types/rtti/README.md`](../../types/rtti/README.md#structs-and-tuples-are-open)),
so a pipeline that only validates does see the extra spellings. Closing every
production would remove them at the schema instead, but that argues against a
deliberate RTTI decision rather than with it, so the cheaper reading is that
canonicality here is a `parse` obligation. And the bound
that `chain-nodes.md` had to derive — *at most one `|?.`, and only as the first
step* — is not a rule here at all, because the grammar offers nowhere else to
put one.

## Verification

19 chain shapes × 11 input kinds, comparing all 171 pairs on **value, throw kind,
and which operands ran** — every index and argument side-effecting. No two
distinct terms denote the same expression.

The shapes cover every production and both terminals, including the four that
differ only in where the region closes:

```ts
(a?.b.c)(...d)   ['?.', a, b, ['.', c, ['!()', d]]]
(a?.b).c(...d)   ['.', ['?.', a, b, null], c, ['()', d]]
a?.b(...c)       ['?.', a, b, ['()', c, null]]
(a?.b)(...c)     ['?.', a, b, ['!()', c]]
```

**Operand evaluation is load-bearing, not a refinement.** Two of those pairs are
indistinguishable on value and throw kind alone — an earlier run with literal
arguments reported them as duplicates. On a nullish `a`, `(a?.b)(...c)`
short-circuits to `undefined`, evaluates the arguments, and throws at the call,
where `a.b(...c)` throws at the access with the arguments unevaluated. Both are
`TypeError`. The distinction survives only because the legitimacy criterion
counts unevaluated operands, which is the strongest justification for `!()`
existing as its own tag.

**The oracle is V8, and that matters for exactly one production.** Nothing here
is implemented, so each term is checked through its JS spelling rather than by
executing nodes — and on one case the host engines disagree, as
[`../README.md`](../README.md) records: for a nullish `u`, `(u?.b)(d)` must
throw, because the parentheses end the chain and `undefined` is called. V8 does.
JavaScriptCore, and so `bun test`, carries the short-circuit through the
parentheses and yields `undefined`.

That case is `!()`. Re-running the same 171 pairs under Bun collapses one:

```ts
a?.b(...c)     ['?.', a, b, ['()', c, null]]
(a?.b)(...c)   ['?.', a, b, ['!()', c]]
```

— indistinguishable under JavaScriptCore, distinct under V8. So a JS oracle
cannot establish `!()` at all on every supported runner, and the argument-
evaluation distinction above rests on the same engine. The remaining 170 pairs
agree on both engines.

This does not weaken the design; it locates where the evidence has to come from.
The EDAG follows the specification whatever its host does, which is why
`chainsJs` in [`../proof.f.mjs`](../proof.f.mjs) deliberately omits this
spelling and `chain.throw.optionalPropertyOnUndefined` in
[`../amnesia/proof.f.mjs`](../amnesia/proof.f.mjs) pins the throw by evaluating
the node instead. `!()` needs the same treatment, and it is the one production
that does.

## Open questions

**The tags collide, in two independent ways, and the grammar above cannot be
implemented until both are fixed.**

*Node against lambda, and this is the serious one.* `Call` is `['()', Exp, Exp]`
and `OptionLambda`'s call is `['()', Exp, OptionLambda]` — same tag, and both
exactly three elements. `null` is a `Primitive` and so an `Exp`
([`../types.ts`](../types.ts)), and it is also `OptionLambda`'s terminator, so

```ts
['()', f, null]
```

is simultaneously a well-formed `Call` node — call `f` with `null` as its
arguments — and a well-formed `OptionLambda` — call the chain's value with `f`
as its arguments, and stop. Measured against `validate`: `null` passes as an
`Exp`, and `['()', 'f', null]` passes as the proposed `Call`. It is not a corner
case either; `['()', f, ['()', g, null]]` is both at the next depth, and so on
down.

Because both readings have the same length, **`close` cannot separate them**.
Only disjoint vocabularies can, which is exactly what the `|` step prefix does
in [`chain-nodes.md`](./chain-nodes.md) — recorded there as a correctness
requirement rather than a readability one, for this reason. So the lambda tags
need prefixing (`|()`, `|.`, `|?.()`, `|!()`) or some equivalent split before
any of this is implementable. `!()` is the one tag already disjoint from every
node tag, which is why the collision is easy to miss when reading the grammar.

*Terminal against continuing, within the lambda vocabulary.* Separately,
`['()', Exp]` in `PropertyLambda` differs from `['()', Exp, OptionLambda]` only
by length, and rtti tuples accept trailing elements — so a `PropertyLambda` slot
handed `['()', c, someContinuation]` validates as the two-element form, the
extra element is ignored, and an executor reads it as terminal, silently
dropping the rest of the chain. This one *is* fixable as first thought: give
every call production the same arity with an explicit `null`, and state the
terminals with `close`
([`../../types/rtti/module.f.mjs`](../../types/rtti/module.f.mjs)), which has now
landed.

Two collisions, two different fixes, and neither substitutes for the other.

**What it costs.** Every property access carries a fourth operand, so plain
`a.b` is `['.', a, b, null]` in every graph. `chain-nodes.md` supersedes an
"Extend `.`" alternative on the ground that it turns property paths
combinatorial — that objection does *not* apply here, since `PropertyLambda` has
no `.` production and `a.b.c` keeps a unique spelling. The real cost is graph
size and hashing, not ambiguity.

**Purity is unchanged, and still a cost.** The lambdas are structured now, but
they are still not `Exp`s: the `a.b` inside `['.', a, b, ['?.()', c, null]]`
cannot be shared, substituted, or hashed. Everything
[`chain-nodes.md` says about purity](./chain-nodes.md) carries over intact.

**`Index` against `Exp`.** Positions that name a property use `Index`
([`../types.ts`](../types.ts)), matching today's nodes. `chain-nodes.md` records
one alternative rejected because `Exp` and `Index` overlap, so widening these to
`Exp` would need its own argument.

**Relationship to `chain-nodes.md`.** This answers that issue's central open
question rather than fixing its problem, so both files are live: its laws, its
V8 matrix and its alternatives stay load-bearing here. Whether it should be
folded in or kept as the record this one builds on is undecided.

## Tasks

- [ ] Prefix the lambda tags, or otherwise make the node and lambda
      vocabularies disjoint. `['()', f, null]` is a valid `Call` node *and* a
      valid `OptionLambda`, at equal length, so this is a prerequisite rather
      than a cleanup.
- [ ] Fix the terminal collision separately — uniform arity plus `close`. It is
      a different collision and the prefix does not close it.
- [ ] Decide where canonicality against trailing elements is owed: `parse` on
      the way in, or `close` on every production. The first is what RTTI already
      does; the second contradicts its documented openness. Either way, say so,
      because "unspellable" is otherwise true only up to that.
- [ ] Decide `Index` against `Exp` in the naming positions.
- [ ] Decide whether this supersedes [`chain-nodes.md`](./chain-nodes.md) or
      builds beside it.
- [ ] Weigh against ["no normal form"](../README.md): this buys more
      canonicality than the seven-kind proposal, and buys it in the schema
      rather than the lowering.
- [ ] If adopted: the node schemas in [`../module.f.mjs`](../module.f.mjs), the
      types in [`../types.ts`](../types.ts), the `Map` and handlers in
      [`../amnesia/`](../amnesia/), the tables in [`../README.md`](../README.md),
      and the `chains` / `optionalCall` proofs.
- [ ] Pin `!()` with an executor proof, not a JS one — it is the production the
      engines disagree about, so `chainsJs` cannot carry it. Follow
      `chain.throw.optionalPropertyOnUndefined`, which already does this for the
      same boundary in the current node set.
- [ ] Add as proofs the pairs that differ **only** in operand evaluation —
      `a.b(...c)` against `(a?.b)(...c)`, and `(a?.b.c)(...d)` against
      `(a?.b).c(...d)`. Both are `TypeError` on a nullish base, so a proof
      comparing values and throw kinds alone would pass while the distinction
      silently disappeared.

## Related

- [`./chain-nodes.md`](./chain-nodes.md) — the seven-kind proposal this answers
- [`../README.md`](../README.md) — "Chains", the receiver and short-circuit rules
- [`../../types/rtti/module.f.mjs`](../../types/rtti/module.f.mjs) — `close`, for
  stating the terminals
- [`../../djs/todo/compile-modules-to-edag.md`](../../djs/todo/compile-modules-to-edag.md)
  — the lowering, which would have far less to enforce under this shape
