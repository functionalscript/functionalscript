# 667-bnf-repeat-flatten. BNF: flatten right-recursive repeat rules

**Priority:** P3
**Status:** open
**Blocked by:** [i207-bnf-semantic-actions](./207-bnf-semantic-actions.md)

## Problem

Unbounded repetition in the BNF grammar is encoded as right-recursion — there
is no primitive `repeat` rule. The four BNF shapes are `Variant | Sequence |
TerminalRange | string`. Helpers like `repeat0Plus` expand to right-recursive
`Variant` rules:

```ts
repeat0Plus(x)  // r = () => option([x, r])  →  Variant { some: [x, r], none: [] }
```

Hand-written repetition looks the same:

```ts
characters = () => ({ none, characters: [character, characters] })  // 0-or-more
members    = () => ({ member, members: [member, ',', members] })    // 1-or-more
```

The raw output of these rules is a right-nested cons list:
`{ tag:'some', value:[x0, { tag:'some', value:[x1, { tag:'none', value:[] }] }] }`

Actions and downstream consumers almost always want a flat array `[x0, x1, …]`
instead.

## Proposal

Detect right-recursion structurally and flatten the raw output opt-in.

**Detection.** A rule `L` is *list-like* when every recursive reference within
its strongly-connected component (SCC) occurs in **tail position** (the last
element of a `Sequence`, possibly through a thunk). For each branch, split into:
- a **prefix** — all items before the optional tail (after noise elision: fixed
  literals and silent rules drop out), contributing one item;
- an optional **tail** — a reference back into `L`'s SCC that recurses.

Base branches (no tail) contribute their prefix item and stop. This handles all
common shapes: empty-base + `[item, ·]` tail, single-item base + `[item, sep, ·]`
tail (separator elides), and multi-rule SCC splits (`digits`/`digits0`).

A self-reference in **non-tail** position means the rule is a tree (e.g. an
operator grammar `a = [x, '+', a] | x`) and is left un-flattened.

**Opt-in.** Flat list and right-associative tree share the same grammar shape,
so structural detection alone cannot decide whether to flatten. Flattening is
requested by declaring the action's `in`/`out` schema as `array(itemSchema)` (see
[i207-bnf-semantic-actions](./207-bnf-semantic-actions.md) §5). Detection
establishes that the rule *can* be presented as a list; the `array` schema opts
into it. An instantiation-time check verifies the unfolded item schema matches the
declared element type — a mis-detected or mis-shaped list fails at construction.
Combinator helpers (`repeat0Plus`, etc.) can declare the `array` schema on the
caller's behalf, making opt-in automatic for combinator-built lists.

**Flattening** is an unfold performed during the fold evaluation (§3.2 of
i207): walk the matched branch, emit its prefix item, follow the tail, stop at a
base branch — yielding a flat array. The parser and generic AST are untouched;
this is purely a transformation on the raw output of list-like rules.

## Tasks

- [ ] Implement SCC + tail-position analysis to detect list-like rules
- [ ] Implement the unfold flattening pass in the fold evaluator
- [ ] Wire opt-in: `array(itemSchema)` schema declaration triggers flattening
- [ ] Instantiation-time schema check (item shape matches declared element type)
- [ ] Update `repeat0Plus` (and siblings) to declare `array` schema automatically
- [ ] Tests: right-recursive lists flatten; right-associative trees do not

## Related

- [i207-bnf-semantic-actions](./207-bnf-semantic-actions.md) §2.1 — origin of this design; §5 for the opt-in schema mechanism
- `fs/bnf/module.f.ts` — BNF combinators including `repeat0Plus`
