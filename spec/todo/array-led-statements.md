# Array-led statements

**Priority:** P3
**Status:** wip — approved AST admission

Designer `sergey-shandar` approved admitting array-led statements into AST in the [working session](https://chatgpt.com/local/01a19f43-23cd-76b0-9836-c24644dc8019).

Admit statements such as `[1, 2].forEach(f);` at module and block positions. Reuse array/value parsing and existing discard records; keep the current source admission of discarded calls. Other expression-statement heads and arbitrary discarded values are separate work.

Preserve JavaScript continuation behavior: `f()\n[0](x)` is one expression, whereas `f();\n[0](x)` is two statements. The predictive backend currently rejects the resulting FIRST/FOLLOW overlap. Add an explicit continuation-symbol policy that chooses consumption only for the caller's declared symbols; strict default checks, FIRST/FIRST checks and all other FIRST/FOLLOW checks remain. This is deterministic greedy parsing, not backtracking or a broad relaxation of grammar validation.

Benefits: faithful ASTs and dependency discovery for ordinary array-led proof calls. Costs: an explicitly disambiguated grammar at the source parser boundary and tests for ASI, chaining, and required evaluation.
