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

Following that through leaves four kinds again, but split along a different
line: whether a node carries HCF at all.

## The invariant

The receiver and the short-circuit — the HCF state of
[`../amnesia/module.f.mjs`](../amnesia/module.f.mjs) — are never the result of
an `exp`. Evaluating an `exp` yields an ordinary value and nothing else, which
is what keeps a node context-independent and shareable by identity
(["Chains"](../README.md#chains)). So an HCF must be **born, carried, and
consumed inside one node's `lambdas` walk**; it cannot be handed to a
neighbouring node.

There are exactly two kinds — the receiver, reaching **back** to the step that
made it, and the short-circuit, reaching **forward** over what it skips — and
both live in a `lambdas`. So a node carrying a `lambdas` decides only how the
walk ends: read the value, or call it. A node carrying none has no HCF to
decide about, and the four kinds fall out of those two questions.

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
node consumes — and no dead prefix. `['()', a, [['|.', b], ['|.', c]], d]` is
not a legal spelling of `a.b.c(d)`: the first step's receiver is overwritten
before anything consumes it, so it is an ordinary value computation and belongs
in a `.` node. Verified exact, error text included.

**Legitimacy criterion.** A rewrite is available only when the target shape is
not already spoken for, and the survivor is **fully** equivalent — same values,
same throws, same unevaluated operands. "Both throw" is not enough.

## Proposal

Four nodes, split by whether they carry HCF at all:

```ts
type Property = readonly['.',   Exp, Index]            // no HCF
type Call     = readonly['()',  Exp, Exp]              // no HCF
type Chain    = readonly['?.',  Exp, Lambdas]          // walk, then read
type ChainCall= readonly['.()', Exp, Lambdas, Exp]     // walk, then call
```

`.` and `()` are the HCF-free cases and stay simple: a property read, and a call
of an ordinary value with no receiver. `()` loses the `lambdas` it has today,
since a `lambdas` is precisely where HCF lives.

The two chain nodes evaluate their base, walk their `lambdas`, and differ only
in what consumes the result:

```js
'?.':  value(property(applyLambda(i, lambdas, [i(a)])))
'.()': call (property(applyLambda(i, lambdas, [i(a)])), () => i(args))
```

`?.()` disappears as a node kind. An optional link is a *step id*, not a node: a
region short-circuits when a `?.` / `?.()` step meets a nullish value, and
`property` turns that back into the value `undefined` — for `?.` to read, or for
`.()` to call. That is the whole difference between `u?.b(d)` being `undefined`
and `(u?.b)(d)` throwing.

Step ids drop the `|` prefix, since a `lambdas` is a distinct operand kind:
`.`, `?.`, `()`, `?.()`.

The tag says which kind of node it is before any operand is read — the property
the two-node form (see [Alternatives](#alternatives-considered)) gave up.

### Conditions

- At most one `.` before the first optional step — minimality. `a.b.c` therefore
  nests as `['.', ['.', a, b], c]`, exactly as today.
- `?.` has at least one `?.` or `?.()` step. Without it,
  `['?.', a, [['.', b]]]` is a second spelling of `a.b`.
- `.()`'s `lambdas` is non-empty. Without it, `['.()', a, [], c]` is `['()', a, c]`.

The last two are what keep the four kinds disjoint, and none of the three is
expressible in rtti — see [Open questions](#open-questions).

### Encodings

| JS | EDAG |
| --- | --- |
| `a.b` | `['.', a, b]` |
| `a.b.c` | `['.', ['.', a, b], c]` |
| `f(...c)` | `['()', f, c]` |
| `(_, a.b)(...c)` | `['()', ['.', a, b], c]` |
| `a.b(...c)` | `['.()', a, [['.', b]], c]` |
| `a.b.c(...d)` | `['.()', ['.', a, b], [['.', c]], d]` |
| `(a?.b)(...c)` | `['.()', a, [['?.', b]], c]` |
| `(a?.b.c)(...d)` | `['.()', a, [['?.', b], ['.', c]], d]` |
| `a?.b` | `['?.', a, [['?.', b]]]` |
| `a?.b.c` | `['?.', a, [['?.', b], ['.', c]]]` |
| `a?.b(...c)` | `['?.', a, [['?.', b], ['()', c]]]` |
| `f?.(...c)` | `['?.', f, [['?.()', c]]]` |
| `a.b?.(...c)` | `['?.', a, [['.', b], ['?.()', c]]]` |
| `a.b?.(...c).d` | `['?.', a, [['.', b], ['?.()', c], ['.', d]]]` |
| `((a?.b).c)?.(...d)` | `['?.', ['?.', a, [['?.', b]]], [['.', c], ['?.()', d]]]` |

Every row was checked against V8 through its equivalent in the current node set;
no mismatch. Two rows carry most of the design:

`a.b(...c)` against `(_, a.b)(...c)` — the receiver and its absence — are now
told apart by the **tag**, where every earlier shape told them apart by an
operand. That is the counterexample which rules out recovering the receiver from
the callee expression, made structural.

`((a?.b).c)?.(...d)` is why a leading `.` is permitted at all: the receiver for
`?.()` comes from `.c` applied to an already-completed region, and folding it
into the base would lose it.

The collapse of `?.()` relies on the parenthesis law — `(a?.b.c)?.(...d)` has to
lower to the flat form. That is a question of *expressibility*: were the law
wrong, the spelling would become unwritable rather than silently wrong.

## Why `.()` keeps a full `lambdas`

It is the only **unguarded** consumer of a receiver, so a leading optional step
is observable there and irreducible: `(a?.b)(...c)` differs from `a?.b(...c)` —
one throws on a nullish `a`, the other is `undefined`. `?.` needs the same
vocabulary for the opposite reason: its steps are what make a region optional at
all. Two narrowings of `.()` fail the legitimacy criterion:

- **Drop the operand and recover the receiver from the callee `exp`.**
  `(_, a.b)(...c)` and `a.b(...c)` compute the same callee and differ only in
  the receiver, so the operand must exist.
- **Restrict its ids to `.`.** `['()', a, [['|?.', b], ['|.', c]], d]` and
  `['()', ['?.', a, b, []], [['|.', c]], d]` agree on values but are the
  lowerings of `(a?.b.c)(...d)` and `((a?.b).c)(...d)`, which raise different
  `TypeError`s. The target shape is already spoken for.

## Open questions

**The conditions are what keep the four kinds disjoint, and the schema cannot
state any of them.** rtti offers `array(T)` and `or` and nothing else — no
cardinality, no order. "At most one leading `.`", "at least one optional step",
and "non-empty" all become lowering rules plus a validation pass. Without them
the redundancy this proposal removes comes straight back, expressible if not
emitted. That tension is the sharpest thing here, and it is the same gap as
[`../../types/rtti/todo/excluded-string-values.md`](../../types/rtti/todo/excluded-string-values.md).

**Two refinements to the leading-`.` rule**, both following from minimality and
neither yet decided:

- A leading `.` is *needed* only when a call step consumes it. Before a `?.`
  step it is dead prefix — `['?.', a, [['.', b], ['?.', c]]]` equals
  `['?.', ['.', a, b], [['?.', c]]]`, verified exact.
- `()` before the first optional step should be forbidden too: it completes an
  earlier HCF lifetime, which belongs in its own `.()` node.

## Alternatives considered

**Two nodes — `['.', Exp, Lambdas]` and `['()', Exp, Lambdas, Exp]`** — every
chain in one of two shapes, differing only in whether the walk ends by reading
its value or calling it. Superseded because the tag stopped classifying the
node: `['.', a, L]` might yield `undefined` or throw depending on `L`, so
reading a graph meant reading its steps. Splitting the HCF-free cases back out
restores that at the cost of one more condition, and makes the receiver's
presence a tag rather than an operand's length.

**Three nodes — `.`, `this`, `option`** — with `option` carrying the optional
region and `.` kept as a bare `['.', Exp, Index]`. Superseded by dropping
`option`'s "at least one optional step" condition: without it `option` has
nothing to distinguish it from `.`, so the two merge and one unexpressible
condition disappears with them. It also spent a word — `this` — that reads like
the context-reading `args` and `frame`, and was a misnomer for `['this', f, [],
c]`, which has no receiver.

**A second tag, `.?.()`** — `['.?.()', Exp, Index, Exp, Lambdas]` alongside a
receiver-less `['?.()', Exp, Exp, Lambdas]`. Superseded: it needs two operands
for the call and its continuation, where `option` carries both in one `lambdas`,
and it leaves five chain nodes instead of three.

**Extend `.`** — `['.', Exp, Index, Lambdas]`, so the receiver its own step
creates is consumed inside its own walk. Superseded by putting the same
machinery in `option`, which already carries a `lambdas`. Extending `.` taxes
the most frequent node with a third operand, and turns plain property paths from
a unique spelling into a combinatorial one.

**Peek at the callee's tag** — recover the receiver when the callee is a `.`
node. Rejected: that shape already denotes `(_, a.b)?.(...c)`, so peeking
relabels the simplest encoding and forces the ordinary reading onto a node whose
only job is erasing a reference. It also makes a node's meaning depend on a
child's tag, so `['.', a, b]` and `[',', [['.', a, b]]]` stop being
interchangeable despite having one value.

**A leading path** — `['?.()', Exp[], Exp, Lambdas]` with the array holding
`a.b.c.d`. Rejected: rtti cannot express `[Exp, ...Index[]]`, and `Exp` and
`Index` overlap (a string is both), so the closest expressible type also admits
an array-literal node in a property position.

## Tasks

- [ ] Decide whether step ids keep the `|` prefix, given each name is now both a
      node tag and a step id.
- [ ] Confirm `()` gives up the `lambdas` it has today — "w/o HCF" implies it,
      since a `lambdas` is where HCF lives.
- [ ] Decide the two leading-`.` refinements, then state the conditions in one
      sentence each.
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
