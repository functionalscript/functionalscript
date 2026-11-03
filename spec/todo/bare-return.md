## Bare return

**Priority:** P3
**Status:** wip

### Proposal

Accept explicit `return;` and `return` immediately before a closing brace. Desugar the missing operand to the existing primitive `undefined` in the syntax AST, retaining the return token and semicolon metadata. Use the same return path at function, guard, switch and loop positions, so FAST and EDAG need no new form.

Keep return-owner checks, explicit function-ending requirements, unreachable-statement admission and refusal of a value beginning on the next line. Bare `throw` remains unsupported. The benefit is familiar JavaScript syntax and broader AST dependency coverage; the cost is an optional return operand and its canonicalization.

The language designer `sergey-shandar` explicitly requested this desugaring in the [working session](https://chatgpt.com/local/01a19f43-23cd-76b0-9836-c24644dc8019), recording approval under DESIGN.md §12.

### Tasks

- [ ] Admit and desugar bare returns in the syntax AST.
- [ ] Prove equivalent FAST and graph behavior, metadata, transfer ownership and existing refusal boundaries.
- [ ] Update the language documentation and run scoped checks.
