# Serializable Representation

The pure, parser-agnostic BNF intermediate representation (IR).

A `RuleSet` is a serializable map of `Rule = Variant | Sequence | TerminalRange`.
The function `toData()` converts a functional grammar into this representation.

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
