# Compile the grammar without forward references

**Priority:** P3
**Status:** open

## Problem

`module.f.mjs` cannot become `.f.js`: `value` reaches the later
`valueBranches`, which reaches rules that refer back to `value`. The cycle
also includes the function body, accesses, arguments, arrays, and operator
tails. Reordering declarations only moves the first compiler refusal.

The syntax reader's [rewrite mappings](../../syntax/module.f.mjs) identify
rules by reference. Nesting rule factories would create different identities
and disconnect those mappings; replacing the reference with a look-alike
thunk is not a behavior-preserving conversion. The LL1
[front-end parser](../../../../ebnf/ll1/module.f.js) explicitly requires the
mapped rule itself to occur in the lowered grammar.

## Possible direction

The EBNF [data layer](../../../../ebnf/data/types.ts) already represents rules
by name. Investigate moving the grammar to that representation and exposing
named rewrite mappings through the LL1 builder. This needs coordinated
grammar, syntax-reader, and type changes, with proofs that recursive parsing
and every rewrite retain their behavior.

Alternatively, revisit this conversion if the language admits
[recursive object bindings](../../../../../spec/todo/3140-forward-references.md).
That feature remains a proposal; this issue does not authorize it.

## Tasks

- Choose a representation that preserves recursive rule sharing and mappings.
- Convert the grammar and syntax reader together, checking their public types.
- Verify grammar, syntax, compiler, and railroad-diagram behavior.
- Promote the grammar to `.f.js` when the current compiler accepts it whole.
