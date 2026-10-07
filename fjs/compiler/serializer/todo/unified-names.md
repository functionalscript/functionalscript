# One counter for generated serializer names

**Priority:** P2
**Status:** wip — proposal; implementation remains a separate step

## Problem

The FunctionalScript serializer assigns different names to arguments and
constants, with scope-specific prefixes to prevent shadowing. PR
[#2631](https://github.com/functionalscript/functionalscript/pull/2631)
proposed `a` and `c` prefixes, but separates the FunctionalScript spelling
from DataJS's `$0`, `$1`, … spelling even for shared data.

## Proposal

Use `$` followed by a decimal counter for every generated binding: constants,
fixed arguments, rest arguments, captured slots, and function self names.
One allocation sequence covers the entire output, including nested functions
and lazy blocks. Each binding receives a distinct number; references reuse
that binding's assigned name. Sibling scopes also receive distinct numbers.

Allocate bindings in deterministic source emission order, before rendering
their initializer or body when self-reference requires it. Allocate fixed
arguments in parameter order, then the rest argument, before the body.
Allocate a self name before its parameters when code-only text requires a
named function expression. Source output reuses the function's hoisted binding
for self-reference. Keep allocation state explicit and immutable.

Reserve externally named bindings before allocation and skip any number whose
`$n` spelling is reserved. Never change the `$` prefix to escape a collision.
Each serialization call starts a fresh counter, so serializing the same graph
again produces the same names.

For shared data in the common DataJS/FunctionalScript subset, retain DataJS's
allocation order and exact normalized text. Functions and their arguments
consume numbers only when present; compatibility does not promise identical
numbering for an EDAG document describing a function and source containing it.
DataJS's existing writer remains the compatibility reference.

The same rule applies to code-only function text and value materialization.
Internal temporary bindings introduced by those renderers must also avoid
collisions; their exact allocation order needs to be pinned by proofs when
the implementation is written. Property keys and literal strings are data
and are never renamed.

## Tradeoffs

One rule replaces several naming families and prevents generated bindings from
shadowing one another. Arguments and constants no longer look different, and
adding an earlier binding can renumber later bindings across scopes. Generated
function text changes observably and the implementation PR must declare that
break in its changelog section.

## Tasks

- [ ] Implement one deterministic allocator for source, code-only function text,
  and value materialization without mutable state.
- [ ] Prove shared-data compatibility with DataJS, round-trip stability, nested
  scopes, captures, self-reference, rest parameters, lazy blocks, and exported
  names that collide with `$n`.
- [ ] Update naming documentation and exact-text proofs, regenerate Rust
  fixtures, and run all required checks.

## Related

Supersedes the prefix-only approach in
[#2631](https://github.com/functionalscript/functionalscript/pull/2631).
