# Formal comparison-narrowing (H2b)

2026-11-28. **Shipped H2b stays.** This note writes the formal
refinement rules that the checker already implements for rule 2 of
[flow refinement](./type-system.md#flow-refinement-is-two-rules) — a
lattice, sound transfer, conservative joins and loops — so they can be
checked as rules, not only as code. It is docs/spec **alongside H3**,
not a redesign of [#4150](https://github.com/functionalscript/functionalscript/pull/4150).

The working reference is
[`compared` / `learned` in `fjs/ir/check/module.f.js`](../../../fjs/ir/check/module.f.js)
and the `refinement` proofs in
[`fjs/ir/check/proof.f.js`](../../../fjs/ir/check/proof.f.js). The
shipped surface is also summarised in
[`fjs/ir/README.md`](../../../fjs/ir/README.md#what-flow-refinement-adds).

## Why formalise what already runs

H2b lets the arena's pointer arithmetic stay unmasked: a sum of two
`u(32)` values that a branch proves fits in 32 bits again is a `u(32)`
in that branch, and the emitter reads the local in the narrower word.
That behaviour is correct enough to ship. What it still owes is a
statement of the lattice and transfer functions that a reader (or a
later proof) can check without reading the checker line by line —
especially at joins and loops, where over-narrowing would be unsound.

Open question 14 of [type-system.md](./type-system.md#open-questions)
keeps the deliberate limit: one range per local, no relation between
two locals. This note does not lift that limit.

## Lattice

An integer type is a closed interval `int(lo, hi)` with `lo ≤ hi`, or
the empty set `⊥` (unreachable). Named widths (`u(8)`, `u(32)`,
`i(64)`, …) are intervals. Ordering is inclusion:

- `⊥ ⊑ R` for every range `R`
- `int(a, b) ⊑ int(c, d)` iff `c ≤ a` and `b ≤ d`

Join (`⊔`) is the least upper bound by inclusion: the convex hull of
two non-empty ranges, `int(min(a,c), max(b,d))`, and `⊥` with anything
is the other side. Meet (`⊓`) is intersection; an empty intersection
is `⊥`.

The checker stores one range per local. A refinement **narrows** a
local when it replaces its range `R` by `R ⊓ S` for a sound fact `S`.
Widening a local is never a refinement step; after a merge the sound
choice is a wider bound — the lattice join of arm results for a
`match`, or the author-declared upper bound of a loop parameter
(below), which need only be a subtype bound, not a computed join.

## Transfer: a branch on a comparison

Let `op` be `lt`, `le` or `eq`, and let `holds` be whether the arm sees
the true outcome. For two integer operands with ranges `A = int(al, ah)`
and `B = int(bl, bh)`, the transfer `compared(op, holds, A, B)` answers
a pair of ranges `(A′, B′)`, each `⊥` where no value remains.

| `op` | `holds` | `A′` | `B′` |
| --- | --- | --- | --- |
| `lt` | true | `int(al, min(ah, bh − 1))` | `int(max(bl, al + 1), bh)` |
| `lt` | false | `int(max(al, bl), ah)` | `int(bl, min(bh, ah))` |
| `le` | true | `int(al, min(ah, bh))` | `int(max(bl, al), bh)` |
| `le` | false | `int(max(al, bl + 1), ah)` | `int(bl, min(bh, ah − 1))` |
| `eq` | true | `A ⊓ B` | `A ⊓ B` |
| `eq` | false | `A` without `bl` if `B` is a singleton and that value is an end of `A`; else `A` | symmetric in `B` |

An empty interval after the bounds is `⊥`. Only an operand that is a
**local** (a `get`) is rewritten; a literal, a float, or a compound
term is left alone. An arm that sees **both** outcomes learns nothing.
A nested `match` whose arms are bool literals — as `not` and `ne` write
one — passes the outcomes that lead to the outer arm into the same
transfer on the inner operand.

**Soundness claim (to prove against the rules, not by redesign):** if a
concrete pair `(a, b)` lies in `A × B` and `op(a, b)` evaluates to the
arm's outcome, then `(a, b)` lies in `A′ × B′`. Each transfer is a
**sound over-approximation** of the pairs with that outcome: the
projected ranges may keep pairs that the comparison would decide the
other way. Example: with `A = B = int(0, 1)` and `lt`, the true transfer
is `int(0, 0) × int(1, 1)` and the false transfer is still
`int(0, 1) × int(0, 1)`, so `(0, 1)` appears in both projections even
though only the true outcome holds for it. Non-relational intervals
cannot partition the concrete pairs; they only guarantee inclusion of
every pair the arm can see. An empty arm (no values left) is unreachable
and keeps the old ranges.

## Conservative at joins and loops

Refinement facts are **path-local**. Where control meets, the checker
must not keep a fact that only one path proved.

1. **`match` / `if_` result type.** The type of the term is the join of
   the arms' result types (`joinAll`). An arm may use a narrowed local;
   the join of the results does not push that narrowing onto locals
   after the match. Locals rebound only inside an arm's environment.
2. **Loop parameters.** A loop binds each parameter at a declared type.
   The first values and every `br` that repeats must **subtype** that
   declaration (`loopTerm` / `repeat`); the checker does not compute the
   lattice join of the supplied values. The declaration is an **upper
   bound** the author chose — often wider than every iteration (e.g. a
   `u(64)` parameter whose first and next values are both `int(0, 0)`).
   A narrowing learned inside one iteration does not shrink the
   parameter for the next. Over-narrowing a loop parameter from one
   path would be unsound on another.
3. **`br` out of a block.** A branch that leaves a block carries the
   value's type; it does not carry per-local refinements into the
   outer scope beyond what the value itself is.

Conservative means: prefer the wider range at a merge. A missed
narrowing costs a later `narrow` or a refused body; a false narrowing
would accept an out-of-range use. The shipped checker takes the first
trade.

## What the checker must keep checkable

These are the obligations this note tracks; none of them changes the
shipped H2b API.

- **Lattice ops are total on integer ranges** the IR admits, including
  `⊥`, and agree with inclusion.
- **Transfer matches the table** for `lt` / `le` / `eq` and both
  outcomes, including end-only removal on a false `eq`.
- **Negation is outcome flipping**, not a second transfer table: `not`
  / `ne` are bool `match`es whose arms are literals.
- **Joins and loop parameters stay conservative**: no local keeps a
  path-only bound across a merge or across iterations.
- **Proofs pin the surface** the arena relies on: a 33-bit sum fitted
  back into `u(32)` by a bound check; a non-zero count; a signed window
  around zero — as `refinement` and the `narrowing` module of
  [`testlib.f.js`](../../../fjs/ir/testlib.f.js) already do.

A later step may turn the table into an executable model beside the
checker (same style as the heap's FunctionalScript model) so the
proofs compare both. That step is optional; the rules above are the
spec either way.

## Non-goals

- **Relational facts** (`i < n` as a predicate the checker keeps). Open
  question 14 stays no; a second check or the target's optimizer removes
  a redundant bound test.
- **Float comparisons** and operands that are not locals.
- **Rewriting FAST's `&&` gap**
  ([TODO_DESIGN.md, Refinement stops at `&&`](./TODO_DESIGN.md)):
  a comparison bound in one block and branched on later still does not
  narrow; that is a separate lowering concern, not an H2b change.
- **Changing the emitter's wrap** of a narrowed `i64` local that now
  fits 32 bits.

## Tasks

Tracked on [`fjs/ir/todo/heap.md`](../../../fjs/ir/todo/heap.md) as
**H2b formal rules** — **done** in this note: the lattice, transfer
table, and join/loop conservatism are written so the checker can be
checked against them, without changing shipped H2b behaviour. An
executable model beside the checker stays optional (above).

## Related

- [type-system.md, Flow refinement](./type-system.md#flow-refinement-is-two-rules)
- [type-system.md, open question 14](./type-system.md#open-questions)
- [`fjs/ir/todo/heap.md`](../../../fjs/ir/todo/heap.md) (H2b shipped; formal rules done)
- [heap.md, order of work](./heap.md#order-of-work) (H2)
- [comparison.md, Risks](./comparison.md#risks) (refinement across `br` and loops)
- [TODO_DESIGN.md, Refinement stops at `&&`](./TODO_DESIGN.md)
- [long-strings.md](./long-strings.md) / H3 — parallel coding line; this note does not block it
