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

Answering two questions — does this node carry HCF, and is an optional operator
involved — partitions the *node kinds*, and the set falls out. It classifies
nodes, not whole expressions: `(a?.b).c` has an optional operator and no HCF of
its own, and is a `.` node over a `?.` one.

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

And `.()` **covers the row completely**, because a receiver lifetime is bounded
at two operations: the call consumes the receiver and ends it, so `a.b(...c)`
cannot extend to the right. `a.b(...c).d` starts a fresh lifetime — the `.d`
reads an ordinary value — so it is `['.', ['.()', a, b, c], d]`, not a longer
form. No non-optional expression ever needs a walker.

| | no HCF | HCF |
| --- | --- | --- |
| **no optional operator** | `.`, `()` | `.()` — the unique case |
| **optional operator** | — | `?.`, `?.()` alone; a region needs a walker |

`?.` and `?.()` avoid a walker for a matching reason: their
short-circuit skips nothing beyond their own operands — `a?.b` skips its index,
`a?.(...b)` its arguments, and neither can skip more.

The line is **bounded against unbounded**, not complete against incomplete.
`a?.b(...c)` also has a complete lifetime, and its base, index and arguments
would fit fixed operands; what disqualifies it is that its short-circuit skips a
*separate operation* — the call, arguments included — and once a region reaches
past its own operands the number of operations it can skip is unbounded
(`a?.b(...c).d.e…`). Unbounded needs an array.

The two rows differ exactly there. A call ends a *receiver* lifetime, so
`a.b(...c).d` and `(a.b(...c)).d` are the same expression; a call does **not**
end a *region*, so `a?.b(...c).d` and `(a?.b(...c)).d` are not — on a nullish
`a` the first is `undefined` and the second throws
`Cannot read properties of undefined (reading 'd')`.

Being extensible is not itself the disqualifier, and reading it as one would
take the pure nodes down with it. Every optional operator extends: `a?.b.c`
differs from `(a?.b).c`, and `a?.(...b).c` from `(a?.(...b)).c` — `undefined`
against `Cannot read properties of undefined (reading 'c')` — yet `?.` and
`?.()` are pure. What a node denotes is the expression with **nothing after
it**, and there `?.` and `?.()` skip one operation each. `a?.b(...c)` skips two
before any continuation exists, and that is what puts it in the other column.
Extension is what makes the excess *unbounded* rather than merely two:
`a?.b(...c).d.e…`.

| lifetime | bound | node |
| --- | --- | --- |
| receiver — `.` feeding `()` | exactly two operations; the call ends it | `.()` |
| region skipping only its own operands | one operation | `?.`, `?.()` |
| region skipping separate operations | unbounded | a walker |

So there are five pure nodes because there are exactly two *bounded* HCF shapes,
plus the two operations carrying no HCF at all.

### The rows are independent

A language subset with no optional operators needs only the top row:

```ts
type Dot     = readonly['.',   Exp, Index]
type Call    = readonly['()',  Exp, Exp]
type DotCall = readonly['.()', Exp, Index, Exp]
```

`Lambda`, `Lambdas`, and both walkers drop out entirely, and the subset still
expresses every non-optional chain — receivers included — because `.()` is the
only non-optional form carrying HCF and it holds its receiver in operands.

No other shape considered here has that property, **today's schema included**:
each spells `a.b(...c)` with a `lambdas`, so a non-optional subset would carry
the whole step vocabulary to express a method call. That makes this schema
stageable — the optional row can land later without reworking the first, which
matters for
[`../../djs/todo/compile-modules-to-edag.md`](../../djs/todo/compile-modules-to-edag.md),
where lowering is staged work.

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
mismatch at the level of value and throw *kind*. Message text is not covered and
does differ — `a?.b?.(1)` says "a?.b is not a function" where `(a?.b)?.(1)` says
"(intermediate value) is not a function" — a V8 source-rendering artifact, not a
semantic difference, but worth naming since [minimality](#three-laws) and the
`()` narrowings below do turn on message text.

`X` must be built from the chain operators, so that `X op` parses with all of
`X` as the base — the restriction is syntactic, not semantic.

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

Step ids keep the `|` prefix they have today — `|.`, `|?.`, `|()`, `|?.()`.
That is a correctness requirement, not a readability one. Tuples are open
(["Caveats"](../README.md#caveats)), so an unprefixed step schema `['.', Index]`
also admits a full three-operand `.` **node**: `validate` accepts
`['.', 'base', 'idx']` against it, after which a walk would read `'base'` as the
index and ignore the rest. The same collision hits `()` and `?.()`. The prefix
keeps the two vocabularies disjoint, and it marks what the disjointness is for —
a step is not an `exp` ([Purity](#purity)).

### Conditions

- `_`: at least two steps, at least one of them optional.
- `_()`: at least one step, at least one of them optional.
- **Minimality — the shortest valid form.** Where an expression can be split
  into two, it is split. For a walk that means cutting at every available cut
  point and keeping only what cannot be cut; "at most one `|.` before the first
  optional step" is the weakest visible consequence, not the rule. The rule is
  in [Open questions](#open-questions), and it bounds the shape: a `lambdas`
  holds at most one `|?.`, first if at all. Further guarded steps are possible
  only as `|?.()`, each bound to the property step ahead of it.

Together these stop a walker respelling a pure *node* — without them
`['_', a, [['|.', b]]]` respells `a.b`, and `['_()', a, [['|.', b]], c]`
respells `a.b(...c)`. They do not stop one respelling a pure *nesting*, which is
what the four families in [Open questions](#open-questions) are.

With `lambdas` as `array(lambda)`, none of the three is expressible: neither
`array(T)` nor `or` states cardinality or order. They are lowering rules plus a
validation pass — see [Open questions](#open-questions).

### Encodings

| JS | EDAG |
| --- | --- |
| `a.b` | `['.', a, b]` |
| `a.b.c` | `['.', ['.', a, b], c]` |
| `a(...b)` | `['()', a, b]` |
| `(0, a.b)(...c)` | `['()', ['.', a, b], c]` |
| `a.b(...c)`, `(a.b)(...c)` | `['.()', a, b, c]` |
| `a.b.c(...d)` | `['.()', ['.', a, b], c, d]` |
| `a.b(...c)?.d` | `['?.', ['.()', a, b, c], d]` |
| `a?.b` | `['?.', a, b]` |
| `a?.b?.c` | `['?.', ['?.', a, b], c]` |
| `a?.(...b)` | `['?.()', a, b]` |
| `a?.b.c` | `['_', a, [['\|?.', b], ['\|.', c]]]` |
| `a?.b(...c)` | `['_', a, [['\|?.', b], ['\|()', c]]]` |
| `a.b?.(...c)` | `['_', a, [['\|.', b], ['\|?.()', c]]]` |
| `a?.b?.(...c)`, `(a?.b)?.(...c)` | `['_', a, [['\|?.', b], ['\|?.()', c]]]` |
| `a.b?.(...c).d` | `['_', a, [['\|.', b], ['\|?.()', c], ['\|.', d]]]` |
| `((a?.b).c)?.(...d)` | `['_', ['?.', a, b], [['\|.', c], ['\|?.()', d]]]` |
| `(a?.b)(...c)` | `['_()', a, [['\|?.', b]], c]` |
| `(a?.b.c)(...d)` | `['_()', a, [['\|?.', b], ['\|.', c]], d]` |

Every row was checked against V8 through its equivalent in the current node set;
no mismatch. Three carry most of the design:

`a.b(...c)` against `(0, a.b)(...c)` — the receiver and its absence — are told
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
  `(0, a.b)(...c)` and `a.b(...c)` compute the same callee and differ only in
  the receiver, so a tag or an operand must carry it. Here the tag does, which
  is why `.()` can be pure and `_()` still cannot.
- **Restrict its step ids to `|.`.** That leaves `(a?.b.c)(...d)` unspellable.
  Its `|?.` sits inside the region the call consumes, and moving it into the
  base changes the expression: `['_()', ['?.', a, b], [['|.', c]], d]` is
  `((a?.b).c)(...d)`, which throws `Cannot read properties of undefined
  (reading 'c')` on a nullish `a` where `(a?.b.c)(...d)` throws `(intermediate
  value) is not a function`. And that base-shifted node is not a legal `_()`
  anyway — with no optional step it fails the condition — because
  `((a?.b).c)(...d)` is a receiver pair over a completed region:
  `['.()', ['?.', a, b], c, d]`. The narrowing loses one expression and
  duplicates one `.()` already owns.

## Open questions

**Minimality is decided; where it lives is not.** The rule is the shortest
valid form: where an expression can be split into two, it is. What is open is
that no part of it is expressible in the schema. With `lambdas` as
`array(lambda)`, neither `array(T)` nor `or` states cardinality or order, so the
conditions are lowering rules plus a validation pass, and `validate` accepts
graphs the lowering never emits. (`close` could state some of it — see the
[later option](#open-questions) below — but this proposal does not use it.)

Four duplicate families show what a cardinality test alone lets through:

```ts
['_',   a, [['|?.', b], ['|?.', c]]]                // a?.b?.c        also ['?.', ['?.', a, b], c]
['_',   a, [['|.', b], ['|()', c], ['|?.', d]]]     // a.b(...c)?.d   also ['?.', ['.()', a, b, c], d]
['_()', a, [['|?.()', b]], c]                       // (a?.(..b))(..c) also ['()', ['?.()', a, b], c]
['_',   a, [['|?.', b], ['|()', c], ['|?.', d]]]    // a?.b(..c)?.d   also ['?.', ['_', a, [['|?.', b], ['|()', c]]], d]
```

Each satisfies "at least one optional step" and each duplicates a shorter
spelling — verified identical, error text included. What the cardinality test
misses is that an optional operator's *presence* is not what justifies a walker;
the region having work to do is. Two clauses say it:

- **Whether** a walker is required — some *consumer* takes a receiver from the
  step before it, or an unguarded step follows an optional one and so must be
  skipped. The consumers are the `|()` and `|?.()` steps **and, in `_()`, the
  node's own call**, which takes the last step's. Counting that last one is what
  admits `['_()', a, [['|?.', b]], c]`, the only receiver-preserving spelling of
  `(a?.b)(...c)`: its single step neither follows a step nor precedes one, so a
  clause quantified over steps alone would reject it.
- **How much** goes in it — as little as possible. The walk is cut at **every**
  available cut point, and what survives between cuts is one node. Cuts come in
  two kinds, because the parenthesis law only has something to say once a region
  is open.
  - **Before the region** nothing is guarded, so every step that does no
    required work leaves through the front into the base — it is a dead prefix
    whatever its id. `['_', a, [['|.', b], ['|.', c], ['|?.()', d]]]` —
    `a.b.c?.(...d)` — keeps only `|.c`, which supplies the receiver `|?.()`
    consumes; `|.b` does nothing for anyone and becomes
    `['_', ['.', a, b], [['|.', c], ['|?.()', d]]]`, exposing `a.b` for sharing.
    Verified identical over six input kinds.
  - **Inside it** a cut is available before any optional step that takes no
    receiver from the step before it: closing the region there is unobservable,
    because the operator following the closure is itself guarded. None is
    available before a `|.` or a `|()` — closing before an unguarded operator is
    exactly what the parenthesis law makes observable — nor before a `|?.()`
    whose predecessor is a property step, since that would strand the receiver
    it consumes: the cut leaves `['?.()', ['.', a, b], c]`, which calls a
    detached `a.b` because an `exp` yields a value rather than a reference
    (`a.b?.()` is `"A"`; `(0, a.b)?.()` is `"no-this"`).

Cutting *everywhere* rather than only at the two ends is what the rule needs,
and a per-step reading of either end misses a case:

```ts
['_',   a, [['|?.', b], ['|()', c], ['|?.', d], ['|.', e]]]         // a?.b(...c)?.d.e
['_',   ['_', a, [['|?.', b], ['|()', c]]], [['|?.', d], ['|.', e]]]

['_()', a, [['|.', b], ['|()', c], ['|?.', d]], e]                  // (a.b(...c)?.d)(...e)
['_()', ['.()', a, b, c], [['|?.', d]], e]
```

In the first the cut is at the back, and the trailing `|.` is not liftable on
its own — only the guarded suffix it sits in lifts, whole. In the second the cut
falls in the *middle*: both the inner `|()` and the node's own call name
consumers, so a first-to-last span would keep every step, yet what precedes the
cut is a completed receiver lifetime with a pure spelling — `a.b(...c)` is
`.()`, and leaving it in the walk hides a shareable `exp`. Both verified
identical across input kinds, error text included.

One consequence bounds the shape rather than describing a procedure: **a
`lambdas` holds at most one `|?.`, and if it holds one it is the first step.**

A `|?.` is always a cut. It cannot consume a receiver — it is a property access,
not a call — so nothing binds it to the step before it, and closing there is
never observable, `?.` being guarded itself. That holds whatever precedes it, an
unguarded step included: `a?.b.c?.d` and `(a?.b.c)?.d` are identical over six
input kinds. So anything ahead of a `|?.` is cut away into the base, and a
second one starts a new node.

That bounds `|?.` and nothing else. A `lambdas` may hold further **guarded**
steps, because `|?.()` is not a cut: it consumes the receiver the property step
before it supplies, and a cut is an `exp` boundary, which yields a value rather
than a reference.

```ts
['_', a, [['|?.', b], ['|?.()', c]]]                   // a?.b?.(...c)
```

Cutting that gives `['?.()', ['?.', a, b], c]`, a receiver-less call —
`a?.b?.()` is `"A"`, `(0, a?.b)?.()` is `"no-this"`. `optionalCallReceiver` in
[`../proof.f.mjs`](../proof.f.mjs) pins the same shape in the current schema. So
a `lambdas` is at most one `|?.`, first if at all, plus any `|?.()` each bound
to the property step ahead of it — `a?.b?.(...c).d?.(...e)` holds two.

`|?.()` is the only optional step that can sit mid-`lambdas`, and only under
that binding — one more face of `.()` and `?.()` looking parallel without being
so. The `|?.` bound still makes the first duplicate family above a corollary
rather than a case: two `|?.` in one `lambdas` can never both survive.

`_()` is the exception at the far end, because its own call is unguarded and
takes the last step's receiver. A cut inside its `lambdas` is fine, since the
tail plus the call is still a `_()`; what never happens is the walker giving way
to a bare `()`. `['_()', a, [['|?.', b]], c]` is `(a?.b)(...c)`, which runs `b`
with `a` as `this`, while `['()', ['?.', a, b], c]` is the receiver-less call
and runs it with `this` undefined. A trailing **call** step is the one that does
give way, having already cleared the receiver — that is the
`(a?.(...b))(...c)` family above.

Under the full rule all four collapse: `a?.b?.c` fails the "whether" clause
entirely, `a.b(...c)?.d` needs a walker only for `a.b(...c)` — which is `.()`,
so none at all — `(a?.(...b))(...c)` has no receiver for its final call to
consume, and `a?.b(...c)?.d` keeps the walker but cuts before the `|?.`.

Splitting wherever a split is legitimate is the decision; what remains open is
that the lowering is the only place it can be stated.

That is the price of maximizing purity: every pure node added is one more
spelling the walkers must be forbidden to duplicate, and the forbidding happens
in the lowering. The same gap as
[`../../types/rtti/todo/excluded-string-values.md`](../../types/rtti/todo/excluded-string-values.md).

**A later option, deliberately not taken here.** `close` (#1687) is a fixed
prefix plus a homogeneous tail, so it states a cardinality lower bound and pins
leading positions at once:
`or(close([optional, lambda], lambda), close([dot, optional], lambda))` for `_`,
and the same without the second-step requirement for `_()`. It is not a
restatement of the three conditions. It is strictly **stronger** at the front
and **silent** at the back, which makes it an implementation of neither rule as
written:

- Stronger — `['_', a, [['|.', b], ['|()', c], ['|?.', d]]]`, `a.b(...c)?.d`,
  satisfies all three conditions yet fails both alternatives, its second
  position being `|()`. That is the second duplicate family above, so the schema
  is doing part of the recommended rule's work rather than the conditions'.
- Silent — `['_', a, [['|?.', b], ['|()', c], ['|?.', d]]]`, `a?.b(...c)?.d`,
  passes on its first position alone. Only the suffix cut removes it, and no
  fixed prefix can state a cut.

Tried against `validate`: every `lambdas` in [Encodings](#encodings) passes, and
the probes that violate a *cardinality or leading-position* condition are
rejected. That is the whole of what was tested, and the Silent bullet is why it
cannot be more — a `lambdas` minimality rejects can still validate, so `close`
buys a partial contract rather than the rule. Left out so this proposal does not
depend on a combinator that has only just landed; adopting it would also mean
settling which of the two rules a schema is meant to carry.

**The receiver pair has four guard combinations; only one gets operands.** A
property access feeding a call can be guarded on either side, and two of the
three shapes besides `.()` are bounded by this file's own criterion — they skip
one operation, their own operands — yet are spelled with a walker:

| access | call | JS | skips, standalone | now |
| --- | --- | --- | --- | --- |
| `.` | `()` | `a.b(...c)` | nothing | `.()` — operands |
| `.` | `?.()` | `a.b?.(...c)` | its own arguments | `['_', a, [['\|.', b], ['\|?.()', c]]]` |
| `?.` | `()` | `(a?.b)(...c)` | its own index | `['_()', a, [['\|?.', b]], c]` |
| `?.` | `?.()` | `a?.b?.(...c)` | index **and** the whole call | `['_', a, [['\|?.', b], ['\|?.()', c]]]` |

Measured, with a side-effecting index and argument: on a nullish `a.b`,
`a.b?.(...c)` evaluates the index and skips the arguments; on a nullish `a`,
`(a?.b)(...c)` evaluates the arguments and skips the index; `a?.b?.(...c)`
skips both. So the fourth row is unbounded and belongs to a walker, but rows two
and three are as fixed as `.()` is — base, index, arguments — and giving them
tags would take two more shapes out of the walkers.

Not decided. It is the same trade the file already names: every pure node added
buys sharing and costs one more spelling the walkers must be forbidden to
duplicate. Recorded here so the partition is honest about the choice rather than
appearing to have no alternative. Distinct from the
[superseded `.?.()`](#alternatives-considered), which carried a trailing
`lambdas`; these would carry none.

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
step at all — and it is what lets [the rows separate](#the-rows-are-independent).

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
node. Rejected: that shape already denotes `(0, a.b)(...c)`, so peeking relabels
the simplest encoding and forces the ordinary reading onto a node whose only job
is erasing a reference. It also makes a node's meaning depend on a child's tag.

**A leading path** — `['?.()', Exp[], Exp, Lambdas]` with the array holding
`a.b.c.d`. Rejected: rtti cannot express `[Exp, ...Index[]]`, and `Exp` and
`Index` overlap, so the closest expressible type also admits an array-literal
node in a property position.

## Tasks

- [ ] Decide the conditions: the stated cardinality tests, or whether-plus-
      minimality with both halves of the span. The second removes all four
      duplicate families.
- [ ] Revisit `close` for stating the conditions structurally, once it has
      settled.
- [ ] Settle whether `_` should say it is optional (`?_`).
- [ ] Weigh against ["no normal form"](../README.md): this buys canonicality the
      model declines, and moves the truncations into the lowering.
- [ ] If adopted: the node schemas in [`../module.f.mjs`](../module.f.mjs), the
      types in [`../types.ts`](../types.ts), the `Map` and handlers in
      [`../amnesia/`](../amnesia/), the tables in [`../README.md`](../README.md),
      and the `chains` / `optionalCall` proofs.
- [ ] Add the distinguishing pairs as proofs whichever way this goes — each is a
      fact that would break silently under a later "simplification":
      `(0, a.b)(...c)` vs `a.b(...c)`; `((a?.b).c)(...d)` vs `(a?.b.c)(...d)`;
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
