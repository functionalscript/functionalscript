# Body Constants

Parse a const definition in a function body; a const can be used within that body after it is defined.

```js
export default () => {
    const x = 43
    return [3, x]
}
```

Depends on [function](./3110-function.md) and [const](../README.md#shared-values-constants).

The block body it is written in is in the language
([functions](../README.md#functions)); what this issue adds is a second
statement before the `return`.

Wanted first by the FunctionalScript writer
([`fjs/fsc/todo/functionalscript-output.md`](../../fjs/fsc/todo/functionalscript-output.md)):
a constructor shared within a function body, one array reached twice, has no
spelling that keeps it one array per call until a body has a `const` to hoist
it into, so the writer refuses such a body until this lands. A body `const`
is a comma operand of the body, as a module `const` is of the module
([`2340-operators.md`](./2340-operators.md)), and the no-shadowing rule
([`3150-shadowing.md`](./3150-shadowing.md)) applies to it.
