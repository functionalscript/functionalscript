# Body Constants

A `const` in a function body, named by the `return` and by the statements
after it.

```js
export default (...a) => {
    const x = 43;
    return [3, x];
};
```

Depends on [function](./3110-function.md) and [const](../README.md#shared-values-constants).

The block body it is written in is in the language
([functions](../README.md#functions)); what this issue adds is the statement
before the `return`. Every statement carries its `;`, the `export default`
included, since this language ends a statement at a `;` and never where an
engine infers one. The `()` this issue was filed with is the empty parameter
list, which [function](./3110-function.md) still holds, so the example takes
the rest parameter the language has.

## What landed

The language accepts it. A body `const` binds as a module's does — one node
however many references reach it, not in its own initializer's scope, and no
name written twice — and lowers the same way: an entry of the function's own
body, `['cref', i]` naming an entry of *that* body, and what the returned
value does not reach anchored by the comma rather than dropped — a body
`const` is a comma operand of the body, as a module `const` is of the module
([`2340-operators.md`](./2340-operators.md)). The parameter is a name of the
body too, so a `const` may not take it.

A body `const` may take a name the module binds. The body cannot reach the
module's scope at all, a reference out being a capture, so the module's name
is unreachable here rather than hidden, and
[no-shadowing](./3150-shadowing.md) has nothing to decide about this case.

## What is left

The writer. [`fjs/fsc/serializer`](../../fjs/fsc/serializer/module.f.mjs) has
no spelling for a body `const` yet, so it refuses three graphs it could now
write:

- `a comma outside the root` — a body whose entry the returned value does not
  reach;
- `a shared constructor inside a function body` — the one this issue was
  wanted for;
- `a hoisted access base inside a function body` — a numeric or function base,
  which needs a `const` in the body's own scope.

Each becomes `const` statements before the `return`. Names continue the
module's `$n` sequence, so no two `const`s in one module share a name and the
question no-shadowing has not answered stays out of the writer's way.

## Tasks

- [x] The grammar takes `const*` before the `return`, the module's own rule.
- [x] The fold binds them in the body's scope, and the lowering makes them
      entries of the function's body.
- [ ] The writer spells them, and the three refusals above go.
