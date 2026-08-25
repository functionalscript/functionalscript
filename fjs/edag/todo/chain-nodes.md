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

Following that through collapses the four into two.

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
both live in a `lambdas`. What is left for a node to decide is only how the walk
ends: read the value, or call it. That is why two nodes suffice.

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

```ts
type Property = readonly['.',  Exp, Lambdas]
type Call     = readonly['()', Exp, Lambdas, Exp]
```

Both evaluate their base, walk their `lambdas`, and differ only in what consumes
the result — the walk's value, or a call with it:

```js
'.':  value(property(applyLambda(i, lambdas, [i(a)])))
'()': call (property(applyLambda(i, lambdas, [i(a)])), () => i(args))
```

`?.` and `?.()` disappear. An optional link is a step id, not a node kind: a
region short-circuits when a `?.` / `?.()` step meets a nullish value, and
`property` turns that back into the value `undefined` for `.` to read or for
`()` to call — which is the whole difference between `u?.b(d)` being `undefined`
and `(u?.b)(d)` throwing.

Step ids drop the `|` prefix, since a `lambdas` is a distinct operand kind:
`.`, `?.`, `()`, `?.()`.

### Conditions

- At most one `.` before the first optional step — minimality. With no optional
  step at all that means at most one `.`, so `a.b.c` nests as
  `['.', ['.', a, [['.', b]]], [['.', c]]]`, exactly as today.
- `.`'s `lambdas` is non-empty; `['.', a, []]` is an identity wrapper around `a`.

Neither is expressible in rtti — see [Open questions](#open-questions).

### Encodings

| JS | EDAG |
| --- | --- |
| `a.b` | `['.', a, [['.', b]]]` |
| `a?.b` | `['.', a, [['?.', b]]]` |
| `a?.b.c` | `['.', a, [['?.', b], ['.', c]]]` |
| `a?.b(...c)` | `['.', a, [['?.', b], ['()', c]]]` |
| `f?.(...c)` | `['.', f, [['?.()', c]]]` |
| `a.b?.(...c)` | `['.', a, [['.', b], ['?.()', c]]]` |
| `a.b?.(...c).d` | `['.', a, [['.', b], ['?.()', c], ['.', d]]]` |
| `((a?.b).c)?.(...d)` | `['.', ['.', a, [['?.', b]]], [['.', c], ['?.()', d]]]` |
| `f(...c)` | `['()', f, [], c]` |
| `a.b(...c)` | `['()', a, [['.', b]], c]` |
| `a.b.c(...d)` | `['()', ['.', a, [['.', b]]], [['.', c]], d]` |
| `(_, a.b)(...c)` | `['()', ['.', a, [['.', b]]], [], c]` |
| `(a?.b)(...c)` | `['()', a, [['?.', b]], c]` |
| `(a?.b.c)(...d)` | `['()', a, [['?.', b], ['.', c]], d]` |

Every row was checked against V8 through its equivalent in the current node set;
no mismatch. The `((a?.b).c)?.(...d)` row is why a leading `.` is permitted at
all: the receiver for `?.()` comes from `.c` applied to an already-completed
region, and folding it into the base would lose it.

The collapse relies on the parenthesis law — `(a?.b.c)?.(...d)` has to lower to
the flat form. That is a question of *expressibility*: were the law wrong, the
spelling would become unwritable rather than silently wrong.

## Why `()` keeps a full `lambdas`

It is the only **unguarded** consumer of a receiver, so a leading optional step
is observable there and irreducible: `(a?.b)(...c)` differs from `a?.b(...c)` —
one throws on a nullish `a`, the other is `undefined`. `.` needs the same
vocabulary for the opposite reason: its steps are what make a region optional at
all. Two narrowings of `()` fail the legitimacy criterion:

- **Drop the operand and recover the receiver from the callee `exp`.**
  `(_, a.b)(...c)` and `a.b(...c)` compute the same callee and differ only in
  the receiver, so the operand must exist.
- **Restrict its ids to `.`.** `['()', a, [['|?.', b], ['|.', c]], d]` and
  `['()', ['?.', a, b, []], [['|.', c]], d]` agree on values but are the
  lowerings of `(a?.b.c)(...d)` and `((a?.b).c)(...d)`, which raise different
  `TypeError`s. The target shape is already spoken for.

## Open questions

**The tag no longer classifies the node.** `['.', a, L]` may yield `undefined`
or may throw, depending on `L`. Today `?.` against `.` says which at a glance;
here reading a graph means reading its steps. A milder form of the objection
that sank peeking — the information is in the node's own operand rather than a
child's — but it is the same kind of loss.

**`.` is both a node tag and a step id**, told apart by arity. That makes the
`|` prefix question sharper: validation distinguishes a `Lambda` from an `Exp`
by position, so nothing is ambiguous to the schema, but `['.', a, L]` and
`['.', b]` differ only in shape, and tuples accept trailing extras
(["Caveats"](../README.md#caveats)).

**The conditions are positional and cardinal, so the schema cannot state them.**
rtti offers `array(T)` and `or` and nothing else. "At most one leading `.`" and
"non-empty" become lowering rules plus a validation pass, where `?.`'s
optionality is structural today. That is the price of two nodes instead of four,
and it is the same gap as
[`../../types/rtti/todo/excluded-string-values.md`](../../types/rtti/todo/excluded-string-values.md).

**Two refinements to the leading-`.` rule**, both following from minimality and
neither yet decided:

- A leading `.` is *needed* only when a call step consumes it. Before a `?.`
  step it is dead prefix — `['.', a, [['.', b], ['?.', c]]]` equals
  `['.', ['.', a, [['.', b]]], [['?.', c]]]`, verified exact.
- `()` before the first optional step should be forbidden too: it completes an
  earlier HCF lifetime, which belongs in its own `()` node.

## Alternatives considered

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

- [ ] Decide whether step ids keep the `|` prefix, given `.` is now both a node
      tag and a step id.
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
