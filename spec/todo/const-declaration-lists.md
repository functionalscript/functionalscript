## Comma-separated const declarations

**Priority:** P2
**Status:** wip

Parse `const a = first, b = second;` and lower it to ordered individual const declarations. Preserve lexical scope, destructuring, initializer evaluation order and source diagnostics. Keep the written group in syntax AST; expand it during source resolution before FAST. Apply the same handling to module, function, branch, switch and loop-body statements and named exports. Classic for headers and let lists remain separate grammar work.

Benefit: removes the next dependency-scan failures without rewriting authored JavaScript. Cost: the syntax reader and source resolver must handle grouped declarations. No trailing comma is admitted because JavaScript declaration lists do not allow one.

The language designer sergey-shandar explicitly requested this desugaring in the [working session](https://chatgpt.com/local/01a19f43-23cd-76b0-9836-c24644dc8019), approving the feature under DESIGN.md §12.
