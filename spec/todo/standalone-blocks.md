## Standalone lexical blocks

**Priority:** P3
**Status:** wip

### Problem

Standalone `{ ... }` statements currently stop syntax-AST formation in proofs.
They need lexical scope without adding a function invocation or a persistent
block boundary to normalized FAST.

### Proposal

Recognize standalone blocks at module, function and loop statement positions.
Preserve their source extent and child statements in the syntax AST. Resolve
inner declarations in a fresh lexical region, preserving the owning function
and any loop-transfer targets. Shadowed and sibling bindings get distinct
source identities and fresh FAST bindings; inner names do not escape their
scope. Duplicate declarations in one scope and reads in a declaration's TDZ
retain the existing admission checks.

Retain the region through source resolution, then flatten it into the enclosing
FAST statement sequence. Outer writes, captures and abrupt transfers keep their
existing meaning. Nested control-flow nodes remain where needed; ordinary
lexical braces introduce no FAST block wrapper, invocation or EDAG operation.
Imports/exports inside blocks, labels, `var`, bare `return` and implicit function
returns remain outside this increment.

The benefit is familiar JavaScript scope and broader dependency scans. The cost
is a recursive statement form, a source-region boundary and its flattening rule.
The pending no-shadowing proposal is not implemented: this increment preserves
current shadowing and assigns distinct identities rather than conflating names.

The language designer `sergey-shandar` explicitly requested AST support,
flattening to FAST and fresh names for shadowed bindings in the
[working session](https://chatgpt.com/local/01a19f43-23cd-76b0-9836-c24644dc8019).
This records the approval required by DESIGN.md §12.

### Tasks

- [ ] Add syntax-AST standalone blocks at module, function and loop positions.
- [ ] Resolve lexical scopes, fresh identities and existing transfer owners.
- [ ] Flatten lexical regions during FAST normalization.
- [ ] Prove shadowing, scope boundaries, captures, writes and transfers.
- [ ] Document the supported block form and run scoped checks.
