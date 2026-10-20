## The chain-step fold and map are written module by module

**Priority:** P3
**Status:** open

### Problem

A chain step is `[tag, x, next]`: `|.` carries a key, a call step carries an
item list, and `next` is the rest. Folding its operands and mapping over it
are the same recursion wherever they appear, and at `4f44c5d1` they appear
in five modules. [`sharing`](../sharing/module.f.mjs) has the parameterized
fold, private:

```js
const stepOperands = (key, args) => k => {
    if (k === undefined) { return [] }
    const [step, x, next] = k
    return [...(step === '|.' ? key(x) : args(x)), ...stepOperands(key, args)(next)]
}
```

[`analysis`](../analysis/module.f.mjs)'s exported `stepOperands` is it with
`one` and `xs => xs.map(itemOperand)`;
[`fjs/compiler/ast`](../../compiler/ast/module.f.mjs)'s exported
`stepOperands` is it with `keyOperands` and the same items. The maps —
`codeStep`/`codeItems` in [`memo`](../memo/module.f.mjs),
`lowerStep`/`lazyItem` in [`fjs/compiler/edag`](../../compiler/edag/module.f.mjs)
— differ only in the key and item functions, and the item lists one level
down ("map, keeping `['...', x]` a spread") are written in `memo`,
`compiler/edag`,
[`serializer/function_text`](../../compiler/serializer/function_text/module.f.mjs)
and [`operations`](../operations/module.f.mjs). [`types.ts`](../types.ts)
already has the shapes: `StepOver<E, I>`, `ItemsOver<E>`, `Over<T, E, I>`.

### Proposal

In [`module.f.mjs`](../module.f.mjs), beside the schema that defines the
shapes: `stepOperands(key, args)` moved out of `sharing`'s private scope, its
map twin `mapSteps(key, items)`, and `mapItems(f)`. `analysis.stepOperands`
and `ast.stepOperands` become one-line applications or go; the maps become
`mapSteps` calls; the item maps become `mapItems`. `analysis.step`
threads a state and stays. If
[bodies-from-analysis](../memo/todo/bodies-from-analysis.md) lands first,
`memo`'s map is gone and `compiler/edag` is the map's consumer — still
worth it, since `sharing` already pays for the fold.

### Tasks

- [ ] `stepOperands`, `mapSteps` and `mapItems` in `fjs/edag`, with proof.
- [ ] `sharing`, `analysis`, `ast`, `memo`, `compiler/edag`, `function_text`
      and `operations` import them.

### Related

- [operand-classification-owner](./operand-classification-owner.md) — who
  classifies operands eager or lazy; this is the traversal under it.
- [deep-nesting-recursion](../../compiler/todo/deep-nesting-recursion.md) —
  names `lowerStep` and `stepOperands` for stack depth; one owner is one
  place to make them iterative.
