# Serializable Representation

The pure, parser-agnostic BNF intermediate representation (IR).

A `RuleSet` is a serializable map of
`Rule = Variant | Sequence | TerminalRange | Repeat`. The function `toData()`
converts a functional grammar into this representation.

## The `repeat` rule

Three of the four rule kinds transcribe what the functional grammar spells;
`Repeat` is derived. The functional layer has no repetition primitive —
`repeat0Plus(x)` expands to a right-recursive variant — so nothing in the data
form would say that a rule is a *list*, and a parser building an AST from it
would emit the cons-shaped chain that spelling implies rather than a sequence of
items. `toData()` therefore recognizes the shape and records it:

```text
R = { some: S, none: E }   S = [item, R]   E = []      ⟶   R = item
```

Recognition is structural, so a hand-written 0-or-more list folds exactly like a
`repeat0Plus` one, and it is deliberately narrow — only the unambiguous
0-or-more case:

- exactly two branches, one of them the empty rule and the other `[item, R]`;
- `item` must not lead back to `R`, so the tail is `R`'s only self-reference;
- `item` must not match empty, since a body that can consume nothing gives the
  same input infinitely many parses.

Everything looser keeps its variant: a 1-or-more chain, a separated list
(`[item, separator, R]`), and an operator-style tree all reach `R` again, but
which of their items are the list's elements is not something the shape says.
Naming that needs the schema/action mechanism, not this fold. There is no `min`
parameter for the same reason: `repeat` means 0-or-more, exactly the case the
shape settles on its own.

A `Repeat` is the repeated rule's **name**, which keeps the four rule kinds
disjoint by JavaScript type alone — a number is a `TerminalRange`, an array a
`Sequence`, an object a `Variant`, a string this — so telling one kind from
another never has to probe a shape. A string is free to mean this because nothing
else in a `RuleSet` is one: the *functional* `DataRule` does have a string case,
a Unicode literal, but `toData` expands it to terminals long before the data form
exists. Rule dispatch still asks `isRepeat()` rather than testing for a string
inline, so the discriminator lives in one place when the rule model next moves.

Folding a rule leaves its recursive branch (and often its empty one) unreachable,
and `toData()` drops rules that the entry can no longer reach. Generated rule
names have never been part of the contract — only the entry name `toData()`
returns is — and after this fold the intermediate names of a repetition are gone
entirely, so match by the returned entry rather than by a name read off the
serialized set.

A `TerminalRange` packs stored endpoint codes rather than semantic terminal
values — see [Terminals and EOF](../README.md#terminals-and-eof). The codes are
unchanged since EOF moved to `-1`, but their meaning at the top of the space is
not: serialized ranges whose endpoint was the old EOF must be regenerated.

`emptyTagMap()` computes, for every rule in a `RuleSet`, whether it can match
empty input — shared by both automaton builders below so nullability is
derived once, consistently.

The automaton/parser builders that consume a `RuleSet` live in their own sibling
modules:

- [`../ll1`](../ll1) — LL(1) dispatch/matcher,
- [`../descent`](../descent) — recursive descent matcher.
