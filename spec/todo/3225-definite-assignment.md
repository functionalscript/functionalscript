## Definite assignment

**Priority:** P5
**Status:** wip — revised to JavaScript-compatible initialization

### Revised scope and approval

Admit a named `let x;` by initializing `x` to the primitive `undefined` when
execution reaches the declaration, as JavaScript does. Preserve the omitted
initializer and source location in the generic AST, then reuse the existing
initialized-binding lowering. Reads after the declaration and before a later
assignment return `undefined`; access before the declaration retains the
existing refusal. No definite-assignment analysis or new FAST/EDAG operation
is needed. `const` and destructuring declarations still require initializers.

This replaces the definite-assignment proposal below. The benefit is familiar
JavaScript behavior and broader module parsing with a small desugaring; the
cost is accepting an omitted value where explicit initialization previously
made it visible.

The language designer `sergey-shandar` explicitly requested this parsing,
admission and desugaring in the
[working session](https://chatgpt.com/local/01a1908b-f970-713f-b7cb-e16f7ffb2006),
approving this revised scope under
[DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo).

The previous proposal is retained below only until the implementation and its
canonical specification replace this issue.

```js
export default cond => {
    let x;
    if (cond) { x = 2; } else { x = 3; }
    return x;
};
```

### Problem

A `let` takes its initializer, as a `const` does: JavaScript's `let x;`, the
variable `undefined` until its first assignment, is refused
([variables](../bindings/variables/README.md)). The refusal is the language
designer's decision at the implementation of general bindings
([variables](../bindings/variables/README.md)): a variable names its value where
it is declared, as a body names what it returns in an explicit `return`, and
the compiler tracks no first assignment along paths, so it admits no program
that depends on one.

JavaScript has one idiom the refusal shuts out: a variable declared before a
branch and assigned in each arm, the program above, which is `const x = cond ?
2 : 3` spelled as statements. Written in the language as it is, the arms
terminate, so the idiom has no spelling but the conditional.

### Proposal

Admit `let x;` where every path from the declaration to each read of `x`
passes an assignment to it, and refuse it where some path does not: a read
that JavaScript would answer with `undefined` is refused, never admitted as
`undefined`, since a declaration naming no value promises one along every
path, and a path that breaks the promise is the slip this analysis names
([DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)). The
lowering is the branch's result: `let x; if (c) { x = 2; } else { x = 3; }`
denotes what `const x = c ? 2 : 3` denotes, the same graph, and the writer may
spell either.

The analysis is definite assignment over the normalized FAST, where a block's
writes are its results ([normalization](../control-flow/loops/README.md#normalization-and-output)): a binding
declared without a value is assigned on a path once a write to it has been
established on it, and a read before that on any path is refused at the read.

**Depends on** the non-terminating branch, `else` and the arm that falls
through (`st.guard` in [refused constructs](./refused-constructs.md)), without
which the idiom cannot be written, and on the branch results general loops
give a block's writes, without which the arms' values have nowhere to join.

**Benefits.** The one JavaScript idiom for a value chosen by statements is
admitted, where today a reader meeting `let x;` in a JavaScript program must
spell the conditional out.

**Drawbacks.** A second notion of initialization, by path, beside the one the
language has, by declaration; a reader meeting `let x;` must find the
assignments the compiler found. The conditional expression says the same in
one place, which is why this waits.

### Approval

A new language feature needs the formal, explicit approval of the language
designer before it is implemented
([DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)).
Not yet requested.
