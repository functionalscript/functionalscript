# Serializable Representation

The pure, parser-agnostic BNF intermediate representation (IR).

A `RuleSet` is a serializable map of `Rule = Variant | Sequence | TerminalRange`.
The function `toData()` converts a functional grammar into this representation.

`emptyTagMap()` computes, for every rule in a `RuleSet`, whether it can match
empty input — shared by both automaton builders below so nullability is
derived once, consistently.

The automaton/parser builders that consume a `RuleSet` live in their own sibling
modules:

- [`../ll1`](../ll1) — LL(1) dispatch/matcher,
- [`../descent`](../descent) — recursive descent matcher.
