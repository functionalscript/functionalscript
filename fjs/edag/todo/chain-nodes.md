# Restructure chain nodes

**Priority:** P2
**Status:** open

## Problem

Four nodes own a chain today — `.`, `?.`, `()`, `?.()`
([`../types.ts`](../types.ts)) — and their operands are wider than their jobs.
`?.()` carries two `lambdas`; `?.` carries an `index` operand that its own
`lambdas` could hold; and a leading `lambdas` admits step shapes that are all
redundant but one. The vocabulary in that position lets a compiler write graphs
that mean nothing new, and the executor walks a step vocabulary where only one
step can ever matter.

Answering two questions about each expression — does it carry HCF, and is an
optional operator involved — partitions them, and the node set falls out.

## The invariant

The receiver and the short-circuit — the HCF state of
[`../amnesia/module.f.mjs`](../amnesia/module.f.mjs) — are never the result of
an `exp`. Evaluating an `exp` yields an ordinary value and nothing else, which
is what keeps a node context-independent and shareable by identity
(["Chains"](../README.md#chains)). So an HCF must be **born, carried, and
consumed inside one node**; it cannot be handed to a neighbouring one.

## Purity

A `lambdas` is a necessary impurity, and that is the reason to confine it.

A step is not an `exp`. [`../types.ts`](../types.ts) states it on `Lambda`: a
step "reads the current chain value implicitly, so it has no place to hold one,
and it cannot be extracted as a shared computation node." So whatever a graph
expresses as a step is not a node — it cannot be shared, cannot be substituted
for an equivalent expression, and contributes no hash of its own. Whatever it
expresses as an `exp` is all three.

An expression whose HCF is complete within it needs no step: its operands can
hold everything. Only an HCF spanning a *variable-length* region needs a
`lambdas`, because only then is there no fixed number of operands to hold it.

That is also what makes [minimality](#three-laws) more than tidiness. Sharing is
observable and part of a function's meaning ([`../README.md`](../README.md)), so
a non-minimal `lambdas` does not merely spell a chain redundantly — it *hides*
subexpressions inside a walk where nothing else can share them, and they are
evaluated again wherever they recur.

## The partition

**`a.b(...c)` is the only expression with no optional operator that carries
HCF.**

The argument is short. A short-circuit can only come from an optional operator,
by definition. So an expression built without `?.` and `?.()` can carry only
*receiver* HCF, and a receiver exists only where a property access feeds a call.
With the optional operators excluded the access must be `.` and the call must be
`()`, so `a.b(...c)` is the only shape left.

It stays unique under composition — longer non-optional chains supply the base
rather than adding cases:

```ts
a.b.c(...d)      ['.()', ['.', a, b], c, d]
a(...b).c(...d)  ['.()', ['()', a, b], c, d]
```

The fusion is always one `.` feeding one `()`; everything to its left is
HCF-free and decomposes into ordinary nodes.

| | no HCF | HCF |
| --- | --- | --- |
| **no optional operator** | `.`, `()` | `.()` — the unique case |
| **optional operator** | — | `?.`, `?.()` alone; a region needs a walker |

`?.` and `?.()` sit in the pure column for the same reason `.()` does: their
short-circuit is complete within the node, because nothing follows it to skip.
So the five pure nodes are exactly the expressions whose HCF lifetime, if any,
is complete, and the walkers are for lifetimes that span a region.

## Three laws

**Parenthesis law.** Closing an optional region is observable exactly when the
operator that follows is *unguarded*:

```
(X).y        ≢  X.y          (a?.b).c   throws  ·  a?.b.c   is undefined
(X)(...y)    ≢  X(...y)      (a?.b)(c)  throws  ·  a?.b(c)  is undefined
(X)?.y       ≡  X?.y
(X)?.(...y)  ≡  X?.(...y)
```

A guarded operator absorbs the `undefined` a closed region yields; an unguarded
one rejects it. Checked against V8 over 10 chain shapes × 7 input kinds, with no
mismatch. `X` must be built from the chain operators, so that `X op` parses with
all of `X` as the base — the restriction is syntactic, not semantic.

**Minimality.** A `lambdas` should hold exactly one HCF lifetime — the one the
node consumes — and no dead prefix. `['_()', a, [['|.', b], ['|.', c]], d]` is
not a legal spelling of `a.b.c(...d)`: the first step's receiver is overwritten
before anything consumes it, so it is an ordinary value computation and belongs
in a `.` node. Verified exact, error text included.

Read through [purity](#purity), this says: keep as much of a chain as possible
in `exp` nodes, and start the `lambdas` only where HCF genuinely begins.

**Legitimacy criterion.** A rewrite is available only when the target shape is
not already spoken for, and the survivor is **fully** equivalent — same values,
same throws, same unevaluated operands. "Both throw" is not enough.

## Proposal

Five pure nodes, and two walkers used only where an optional operator opens a
region:

```ts
// no HCF
type Dot        = readonly['.',    Exp, Index]
type Call       = readonly['()',   Exp, Exp]

// HCF, complete within the node
type DotCall    = readonly['.()',  Exp, Index, Exp]
type OptionDot  = readonly['?.',   Exp, Index]
type OptionCall = readonly['?.()', Exp, Exp]

// HCF spanning a region
type OptionChain     = readonly['_',   Exp, Lambdas]
type OptionChainCall = readonly['_()', Exp, Lambdas, Exp]
```

The two walkers evaluate their base, walk their `lambdas`, and differ only in
what consumes the result:

```js
'_':   value(property(applyLambda(i, lambdas, [i(a)])))
'_()': call (property(applyLambda(i, lambdas, [i(a)])), () => i(args))
```

A region short-circuits when a `|?.` / `|?.()` step meets a nullish value, and
`property` turns that back into the value `undefined` — for `_` to read, or for
`_()` to call. That one word is the whole difference between `u?.b(d)` being
`undefined` and `(u?.b)(d)` throwing.

### Reading the tags

The glyphs are a vocabulary: `.` is a property access, `()` a call, `?` the
guard that makes one optional, `_` a walked chain. Composition within a tag is
evaluation order — `.()` is a property access **then** a call, `_()` a chain
**then** a call.

Step ids keep the `|` prefix they have today — `|.`, `|?.`, `|()`, `|?.()`. It
marks the one property that matters, that a step is not an `exp`
([Purity](#purity)), and with `_` carrying the walk no glyph does double duty:
no node tag and step id share a name.

### Conditions

- `_`: at least two steps, at least one of them optional.
- `_()`: at least one step, at least one of them optional.
- Minimality: at most one `|.` before the first optional step.

Together these keep the seven kinds disjoint — without them `['_', a,
[['|.', b]]]` respells `a.b`, and `['_()', a, [['|.', b]], c]` respells
`a.b(...c)`. None is expressible in rtti; see [Open questions](#open-questions).

### Encodings

| JS | EDAG |
| --- | --- |
| `a.b` | `['.', a, b]` |
| `a.b.c` | `['.', ['.', a, b], c]` |
| `a(...b)` | `['()', a, b]` |
| `(_, a.b)(...c)` | `['()', ['.', a, b], c]` |
| `a.b(...c)`, `(a.b)(...c)` | `['.()', a, b, c]` |
| `a.b.c(...d)` | `['.()', ['.', a, b], c, d]` |
| `a.b(...c)?.d` | `['?.', ['.()', a, b, c], d]` |
| `a?.b` | `['?.', a, b]` |
| `a?.b?.c` | `['?.', ['?.', a, b], c]` |
| `a?.(...b)` | `['?.()', a, b]` |
| `a?.b.c` | `['_', a, [['\|?.', b], ['\|.', c]]]` |
| `a?.b(...c)` | `['_', a, [['\|?.', b], ['\|()', c]]]` |
| `a.b?.(...c)` | `['_', a, [['\|.', b], ['\|?.()', c]]]` |
| `a.b?.(...c).d` | `['_', a, [['\|.', b], ['\|?.()', c], ['\|.', d]]]` |
| `((a?.b).c)?.(...d)` | `['_', ['?.', a, b], [['\|.', c], ['\|?.()', d]]]` |
| `(a?.b)(...c)` | `['_()', a, [['\|?.', b]], c]` |
| `(a?.b.c)(...d)` | `['_()', a, [['\|?.', b], ['\|.', c]], d]` |

Every row was checked against V8 through its equivalent in the current node set;
no mismatch. Three carry most of the design:

`a.b(...c)` against `(_, a.b)(...c)` — the receiver and its absence — are told
apart by the **tag**. That is the counterexample ruling out recovery of the
receiver from the callee expression, made structural rather than hidden in an
operand's length.

`((a?.b).c)?.(...d)` is why a `|.` step may precede an optional one: the
receiver for `|?.()` comes from `.c` applied to an already-completed region, and
folding it into the base would lose it.

`a.b(...c)?.d` needs no walker at all, because a call ends the receiver's
lifetime. Nothing can extend `.()`, which is what makes it expressible as
operands in the first place.

## Why `_()` keeps a full `lambdas`

It is the only **unguarded** consumer of a receiver, so a leading optional step
is observable there and irreducible: `(a?.b)(...c)` differs from `a?.b(...c)` —
one throws on a nullish `a`, the other is `undefined`. Two narrowings fail the
legitimacy criterion:

- **Drop the operand and recover the receiver from the callee `exp`.**
  `(_, a.b)(...c)` and `a.b(...c)` compute the same callee and differ only in
  the receiver, so a tag or an operand must carry it. Here the tag does, which
  is why `.()` can be pure and `_()` still cannot.
- **Restrict its step ids to `|.`.** `['_()', a, [['|?.', b], ['|.', c]], d]`
  and `['_()', ['?.', a, b], [['|.', c]], d]` agree on values but are the
  lowerings of `(a?.b.c)(...d)` and `((a?.b).c)(...d)`, which raise different
  `TypeError`s. The target shape is already spoken for.

## Open questions

**The cardinality conditions admit two families of duplicates.** "At least one
optional step" tests for an optional operator's *presence*, where what justifies
a walker is whether the region has work to do:

```ts
['_', a, [['|?.', b], ['|?.', c]]]              // a?.b?.c      — also ['?.', ['?.', a, b], c]
['_', a, [['|.', b], ['|()', c], ['|?.', d]]]   // a.b(...c)?.d — also ['?.', ['.()', a, b, c], d]
```

Both satisfy the stated conditions and both duplicate a pure nesting. The first
is equivalent by the parenthesis law; the second by construction, since the walk
is left to right and each step is the same operation. Replacing the cardinality
test with two rules covers both:

- **Whether** a walker is required — some step consumes a receiver from the
  preceding step, or an unguarded step follows an optional one and so must be
  skipped.
- **How much** goes in it — minimality.

Under those, `a?.b?.c` fails both clauses and lowers to pure nesting, while
`a.b(...c)?.d` requires a walker only for `a.b(...c)` — which is `.()`, so no
walker at all. Recommended, not yet decided.

**The schema can state none of the conditions.** rtti offers `array(T)` and `or`
and nothing else — no cardinality, no order. They become lowering rules plus a
validation pass, so `validate` accepts graphs the lowering never emits. That is
the price of maximizing purity: every pure node added is one more spelling the
walkers must be forbidden to duplicate. Same gap as
[`../../types/rtti/todo/excluded-string-values.md`](../../types/rtti/todo/excluded-string-values.md).

**`.()` and `?.()` look parallel and are not.** `.()` is property-plus-call;
`?.()` is an optional call of a value, with no property. Following JS is right,
but a reader may expect `?.()` to be the optional method call — which is
`['_', a, [['|?.', b], ['|()', c]]]`, a walker, because its region can extend.

**`_` never says its node is always optional**, though its condition guarantees
it. `?_` would carry that; `_()` has the same condition, so the pair stays
consistent either way.

## Alternatives considered

**Four nodes, split by HCF alone** — `.`, `()`, and two walkers `?.` and `.()`,
with `a.b(...c)` written `['.()', a, [['|.', b]], c]`. Superseded by
[the partition](#the-partition): `a.b(...c)` is the *only* non-optional
expression carrying HCF, so it deserves operands rather than a walk. Giving it a
pure node also makes a `lambdas` mean exactly "an optional region", which the
four-node split could not say — its call walker admitted chains with no optional
step at all.

**Two nodes — `['.', Exp, Lambdas]` and `['()', Exp, Lambdas, Exp]`.**
Superseded on [purity](#purity): every property access goes through a `lambdas`,
so `a.b` stops being a node and becomes a step that nothing can share.

**Three nodes — `.`, `this`, `option`.** Superseded by merging `option` into
`.`, and then by splitting the pure cases back out. `this` also read like the
context-reading `args` and `frame`, and was a misnomer for a call with no
receiver.

**A second tag, `.?.()`** — `['.?.()', Exp, Index, Exp, Lambdas]` beside a
receiver-less `['?.()', Exp, Exp, Lambdas]`. Superseded: it needs two operands
for the call and its continuation, where a walker carries both in one `lambdas`.

**Extend `.`** — `['.', Exp, Index, Lambdas]`. Superseded on the same ground as
the two-node form: it makes the most frequent node in any graph carry a
`lambdas`, and turns plain property paths from a unique spelling into a
combinatorial one.

**Peek at the callee's tag** — recover the receiver when the callee is a `.`
node. Rejected: that shape already denotes `(_, a.b)(...c)`, so peeking relabels
the simplest encoding and forces the ordinary reading onto a node whose only job
is erasing a reference. It also makes a node's meaning depend on a child's tag.

**A leading path** — `['?.()', Exp[], Exp, Lambdas]` with the array holding
`a.b.c.d`. Rejected: rtti cannot express `[Exp, ...Index[]]`, and `Exp` and
`Index` overlap, so the closest expressible type also admits an array-literal
node in a property position.

## Tasks

- [ ] Decide the conditions: the stated cardinality tests, or whether-plus-
      minimality. The second removes both duplicate families.
- [ ] Settle whether `_` should say it is optional (`?_`).
- [ ] Weigh against ["no normal form"](../README.md): this buys canonicality the
      model declines, and moves the truncations into the lowering.
- [ ] If adopted: the node schemas in [`../module.f.mjs`](../module.f.mjs), the
      types in [`../types.ts`](../types.ts), the `Map` and handlers in
      [`../amnesia/`](../amnesia/), the tables in [`../README.md`](../README.md),
      and the `chains` / `optionalCall` proofs.
- [ ] Add the distinguishing pairs as proofs whichever way this goes — each is a
      fact that would break silently under a later "simplification":
      `(_, a.b)(...c)` vs `a.b(...c)`; `((a?.b).c)(...d)` vs `(a?.b.c)(...d)`;
      `((a?.b).c)?.(...d)` vs `(a?.b.c)?.(...d)`; and a trailing `lambdas` moved
      outside its node.

## Related

- [`../README.md`](../README.md) — "Chains", the receiver and short-circuit rules
- [`../../djs/todo/compile-modules-to-edag.md`](../../djs/todo/compile-modules-to-edag.md)
  — the lowering that would have to emit the normal form
- [`../../types/rtti/todo/excluded-string-values.md`](../../types/rtti/todo/excluded-string-values.md)
  — the same class of gap in what rtti can express
- [`../../AGENTS.md`](../../AGENTS.md) §1.5 — a throw is a panic, which is why
  "both throw" tempts and why the legitimacy criterion rejects it anyway
