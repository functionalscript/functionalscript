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
| `a?.b(...c)?.d` | `OptionLambda` has no `?.`, so the guarded access starts a node |

The same holds for the dead-prefix rule: `PropertyLambda` has no `.` production,
so plain property paths nest and `a.b.c` has exactly one spelling. Read "exactly one"
throughout as *up to trailing elements*: RTTI tuples are open on that side by
design, so `['|()', args, null, 'extra']` validates against the continuing
production and an executor reading declared fields ignores the extra. That is
not a property of this grammar — it holds of every tuple in the current node set
too, which is why [`../README.md`](../README.md) already carries it as a caveat
rather than a bug.

`parse` does drop what a schema does not declare, and it is tempting to call
that the answer:

```
parse(['()', Exp, Exp])  ['()','f',null,'extra']  ->  ok ['()','f',null]
```

It is not the answer here. `parse` constructs a fresh container at every
position it visits, so two edges reaching the same input reference come back as
two distinct outputs — the identity loss measured in
[`../../types/rtti/todo/identity-aware-parse.md`](../../types/rtti/todo/identity-aware-parse.md).
An EDAG's sharing is observable and part of what a function *means*, so
canonicalizing a graph through `parse` would flatten the one property the
representation exists to carry. [`../module.f.mjs`](../module.f.mjs) warns
against calling `parse(exp)` for precisely this reason.

So the multiplicity is real and stays real. Closing every production, or an
identity-aware normalizer, are the options; `parse` is not among them. And the bound
that `chain-nodes.md` had to derive — *at most one `|?.`, and only as the first
step* — is not a rule here at all, because the grammar offers nowhere else to
put one.

## Verification

19 chain shapes × 13 input kinds, comparing all 171 pairs on **value, throw
kind, receiver identity, and which operands ran** — every index and argument
side-effecting, every callee reporting its `this`. Under V8, no two distinct
terms denote the same expression.

Receiver identity belongs in that list and is not decoration: drop it and
`a.b(..)` merges with `(0, a.b)(..)` across all 13 inputs, leaving 18 of 19
distinct.

The inputs put a nullish at depths 0, 1 and 2, through both property and call
edges, because a shallow battery manufactures phantom duplicates. Over these 19
shapes the effect is blunt but real — three depth-0 inputs alone collapse 10
pairs, and adding back a single deep input separates all 19 again — so the
spread is insurance against a wider term space rather than something this matrix
needs. `d1 a.b missing` is behaviourally identical to `d1 a.b=undefined` here,
since nothing observes `in`, so 13 kinds are 12 effective ones:

```
d0  a=undefined | a=null | a=1
d1  a.b=undefined | a.b=null | a.b=1 | a.b missing | a()=undefined | a()=fn
d2  a.b()=undefined | a.b.c=undefined | a.b.c=1
    full (a deep self-similar callable, every property also callable)
```

The shapes, each with the term the grammar assigns it:

| JS | term |
| --- | --- |
| `a.b` | `['.', a, i, null]` |
| `a.b(..)` | `['.', a, i, ['()', args]]` |
| `(0, a.b)(..)` | `['()', ['.', a, i, null], args]` |
| `a.b?.(..)` | `['.', a, i, ['?.()', args, null]]` |
| `a.b.c` | `['.', ['.', a, i, null], j, null]` |
| `a.b(..).c` | `['.', ['.', a, i, ['()', args]], j, null]` |
| `a?.b` | `['?.', a, i, null]` |
| `a?.b.c` | `['?.', a, i, ['.', j, null]]` |
| `a?.b(..)` | `['?.', a, i, ['()', args, null]]` |
| `(a?.b)(..)` | `['?.', a, i, ['!()', args]]` |
| `a?.b?.(..)` | `['?.', a, i, ['?.()', args, null]]` |
| `(a?.b.c)(..)` | `['?.', a, i, ['.', j, ['!()', args]]]` |
| `(a?.b).c(..)` | `['.', ['?.', a, i, null], j, ['()', args]]` |
| `a?.b.c(..)` | `['?.', a, i, ['.', j, ['()', args, null]]]` |
| `a?.b(..).c(..)` | `['?.', a, i, ['()', args, ['.', j, ['()', args2, null]]]]` |
| `a?.(..)` | `['?.()', a, args, null]` |
| `a?.(..)(..)` | `['?.()', a, args, ['()', args2, null]]` |
| `(a?.(..))(..)` | `['()', ['?.()', a, args, null], args2]` |
| `a?.(..).c` | `['?.()', a, args, ['.', j, null]]` |

Operands are named **positionally** — first index, second index, first argument
list, second — so two shapes denoting the same computation produce the same log.
An earlier run named them per-shape, which left some pairs permanently
incomparable and undercounted the engine divergence below. That run also used a
narrower battery of 11 inputs; the 13 above are the corrected one, and `C(19,2)`
is 171 either way, so no pair count moved.

The harness, so the numbers can be re-run rather than taken on trust — save and
run under both `node` and `bun`:

```js
const make = (depth, tag) => {                    // `a.b` is callable and has .b/.c
    const self = function () {
        return make(depth - 1, `${tag}(this=${this === undefined ? 'undef' : (this.$ ?? '?')})`)
    }
    self.$ = tag
    if (depth > 0) for (const k of ['b', 'c']) {
        Object.defineProperty(self, k, { value: make(depth - 1, `${tag}.${k}`) })
    }
    return self
}
const inputs = [
    () => undefined, () => null, () => 1, () => make(5, 'A'),
    () => ({ b: undefined }), () => ({ b: null }), () => ({ b: 1 }), () => ({}),
    () => () => undefined, () => () => make(4, 'R'),
    () => ({ b: () => undefined }), () => ({ b: { c: undefined } }), () => ({ b: { c: 1 } }),
]
let log
const I1 = () => { log.push('i1'); return 'b' }, I2 = () => { log.push('i2'); return 'c' }
const A1 = () => { log.push('a1'); return 1 },   A2 = () => { log.push('a2'); return 2 }
const exprs = [
    ['a.b',            a => a[I1()]],
    ['a.b(..)',        a => a[I1()](A1())],
    ['(0,a.b)(..)',    a => (0, a[I1()])(A1())],
    ['a.b?.(..)',      a => a[I1()]?.(A1())],
    ['a.b.c',          a => a[I1()][I2()]],
    ['a.b(..).c',      a => a[I1()](A1())[I2()]],
    ['a?.b',           a => a?.[I1()]],
    ['a?.b.c',         a => a?.[I1()][I2()]],
    ['a?.b(..)',       a => a?.[I1()](A1())],
    ['(a?.b)(..)',     a => (a?.[I1()])(A1())],
    ['a?.b?.(..)',     a => a?.[I1()]?.(A1())],
    ['(a?.b.c)(..)',   a => (a?.[I1()][I2()])(A1())],
    ['(a?.b).c(..)',   a => (a?.[I1()])[I2()](A1())],
    ['a?.b.c(..)',     a => a?.[I1()][I2()](A1())],
    ['a?.b(..).c(..)', a => a?.[I1()](A1())[I2()](A2())],
    ['a?.(..)',        a => a?.(A1())],
    ['a?.(..)(..)',    a => a?.(A1())(A2())],
    ['(a?.(..))(..)',  a => (a?.(A1()))(A2())],
    ['a?.(..).c',      a => a?.(A1())[I2()]],
]
const cell = (f, mk) => {
    log = []
    let out
    try {
        const v = f(mk())
        out = 'ok:' + (v === undefined ? 'undefined'
            : typeof v === 'function' || (v && v.$) ? String(v.$) : JSON.stringify(v))
    } catch (e) { out = 'throw:' + e.constructor.name }
    return `${out}/[${log.join(',')}]`
}
const rows = exprs.map(([js, f]) => ({ js, v: inputs.map(mk => cell(f, mk)).join('|') }))
let dup = 0
for (let i = 0; i < rows.length; i += 1) for (let j = i + 1; j < rows.length; j += 1) {
    if (rows[i].v === rows[j].v) { dup += 1; console.log(`COLLAPSE ${rows[i].js} == ${rows[j].js}`) }
}
console.log(`${rows.length} shapes, ${inputs.length} inputs -> ${dup} collapse(s)`)
```

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

That case is `!()`. Re-running the same 171 pairs under Bun collapses **two**,
and both are a `!()` term falling onto its `()`-continuing twin:

```ts
a?.b(...c)       ['?.', a, i, ['()', args, null]]
(a?.b)(...c)     ['?.', a, i, ['!()', args]]

a?.b.c(...d)     ['?.', a, i, ['.', j, ['()', args, null]]]
(a?.b.c)(...d)   ['?.', a, i, ['.', j, ['!()', args]]]
```

— indistinguishable under JavaScriptCore, distinct under V8, and the second pair
is one of the four listed above. So a JS oracle cannot establish `!()` at all on
every supported runner, and the argument-evaluation distinction rests on the
same engine. The remaining 169 pairs agree on both.

This does not weaken the design; it locates where the evidence has to come from.
The EDAG follows the specification whatever its host does, which is why
`chainsJs` in [`../proof.f.mjs`](../proof.f.mjs) carries this spelling
commented out and `chain.throw.optionalPropertyOnUndefined` in
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
requirement rather than a readability one. Its witness is weaker than this one,
though, and the difference matters: there the colliding shapes differ in
*length*, so `close` would have settled it; here they are the same length, so
`close` cannot. Same class, strictly stronger case. So the lambda tags
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
- [ ] Make "exactly one spelling" hold literally against trailing elements —
      `close` on every production, or the identity-aware normalizer
      [`../../types/rtti/todo/identity-aware-parse.md`](../../types/rtti/todo/identity-aware-parse.md)
      describes. Not `parse`: it is not identity-aware, and flattening an
      EDAG's sharing costs more than the multiplicity does.
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
- [`../../types/rtti/todo/identity-aware-parse.md`](../../types/rtti/todo/identity-aware-parse.md)
  — why `parse` cannot canonicalize a graph whose sharing is observable
- [`../../djs/todo/compile-modules-to-edag.md`](../../djs/todo/compile-modules-to-edag.md)
  — the lowering, which would have far less to enforce under this shape
