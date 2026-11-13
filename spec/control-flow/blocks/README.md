# Standalone Lexical Blocks

**Status:** implemented

A standalone `{ ... }` statement introduces a lexical scope at module,
function-body and loop-body positions. Blocks may nest. A declaration belongs
to its block: it may shadow an enclosing name, and sibling blocks may reuse a
name. Duplicate declarations within one scope remain errors. Reading an outer
name before declaring the same name in the inner scope retains the compiler's
existing `capture shadowed` refusal.

```js
const value = [1];
let result = [];
{
    const value = [2];
    result = value;
}
export default [value, result]; // [[1], [2]]
```

The syntax AST retains the block and its opening token. Resolution enters a
lexical region, gives each declaration a distinct binding identity, then
flattens the resolved statements into their enclosing sequence. FAST uses its
existing statements; standalone braces add no wrapper or invocation. Generated
JavaScript gives shadowed bindings distinct names. Closures retain their captured
inner bindings after the block ends, and assignments still reach their resolved
enclosing bindings.

A block preserves the enclosing function's return target and the enclosing
loop or switch's break/continue targets. A block completing normally resumes its enclosing sequence. FAST supplies
`return undefined` if execution reaches the end of the owning function.
Loops retain their transfer owners; FAST decides whether they can finish
normally. Existing restrictions on conditional joins and EDAG conversion of
nonlocal transfers in value regions remain in force.

Imports and exports belong at module level. This feature does not add labels,
`var` or empty `;` statements. [Bare returns](../guards/README.md) desugar to
`return undefined`.

The language designer `sergey-shandar` explicitly approved standalone AST blocks,
flattening to FAST and distinct names for shadowed bindings in the
[working session](https://chatgpt.com/local/01a19f43-23cd-76b0-9836-c24644dc8019),
as required by DESIGN.md §12. This preserves existing cross-scope shadowing;
the separate [no-shadowing proposal](../../todo/3150-shadowing.md) remains open.
