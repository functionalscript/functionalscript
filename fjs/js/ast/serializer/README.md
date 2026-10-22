# Prepared FAST to JavaScript

This serializer consumes the prepared model in [`prepare`](../prepare/README.md).
It chooses JavaScript grouping, lexical names, helper syntax and token marks.
Source logical operators have already become single-evaluation conditional
regions. The prepared serializer emits their conditional spelling; it contains
no logical/nullish tag handling or source-operator recovery.
EDAG reachability, shared-value ownership, lazy memo lifetimes, loop slots and
simultaneous transfers have already been decided by the common passes.

`render` emits marked text and `stringify` removes those same marks. Their
module, expression and factory forms share one spelling. `renderModule`
preserves named exports. Runtime mode also supports primitive and repeated
capture values. Code-only `functionStringify` treats capture slots as external
values with positional names, omitting the module wrapper and captured values.
The public compatibility APIs live in [`compiler/serializer`](../../../compiler/serializer/README.md).

Binding and loop identities determine names; diagnostic indices are not keys.
Source functions with several captures name them in signature order before the
body, so parsing the output preserves that order even if body reads differ.
Scalar loops retain the source grammar's paired `let` and `while`, including a
loop whose transition keeps its parameter unchanged. Ordinary prepared memo
instructions render one lexical memo cell and demand function.

Syntax scans, ordinary expression rendering and chain continuation rendering
use explicit immutable work stacks. Final result blocks are flattened into the
same lexical region, retaining their required definitions and final exit. The
proofs exercise 20,000-node unary, binary, property and result-block trees,
including result blocks with required definitions. This is a prepared-model
depth guarantee; it does not expand the separate raw graph admission domain.
