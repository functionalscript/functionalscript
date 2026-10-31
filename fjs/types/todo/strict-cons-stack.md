## One strict cons type, with "push this array"

**Priority:** P3
**Status:** open

### Problem

[`fjs/types/list`](../list/module.f.mjs) is lazy: a `tail` may be a thunk or
a `Concat`. A walker that keeps a work stack wants a strict cons — a `first`
and a `tail` that is a cons or `null`, nothing to force — and since `types`
offers none, each walker declares its own. At `c162c3a`:

```ts
// edag/from_fast/private.ts, edag/from_fast/control/private.ts,
// edag/from_fast/loop/root/private.ts, and js/ast/prepare/private.ts as `_Link`
export type Link<T> = { readonly first: T; readonly tail: Link<T> | null }
// types/stack_walk/types.ts, and monomorphic in media/datajs/vectors/private.ts,
// compiler/parser/private.ts and js/ast/sugar/pattern/private.ts
export type Stack<F> = { readonly top: F, readonly rest: Stack<F> } | null
```

and beside each type its "push an array, first element on top", also per
module:

```js
// edag/from_fast, edag/from_fast/control, js/ast/prepare — identical
const prepend = (items, tail) => items.reduceRight((tail, first) => ({ first, tail }), tail)
// edag/from_fast/loop/root, inline
children.reduceRight((tail, block) => ({ first: ['enter', block], tail }), …)
// js/ast/sugar/pattern: `pushed` plus two `reduceRight`s over it
// media/datajs/vectors `children`: two hand loops, `for (let i = n - 1; …) { result = { top: …, rest: result } }`
// sul: `prepend = (tail, first) => ({ first, tail })`, one cell
```

Two spellings of the same cell (`first`/`tail`, `top`/`rest`) and seven
copies of the same fold. [stack-walk-driver](./stack-walk-driver.md) took the
*loop* out of these walkers; the *cell* and the push stayed behind in each.

### Proposal

One strict cons in `fjs/types` — promote `stack_walk`'s `Stack<F>`, or add it
to `types/list` as the strict case — with `pushAll(items, stack)`, the array's
order kept so `items[0]` ends on top, and its proof. The four `Link`
declarations and the three monomorphic stacks become instances of it; the
`prepend`s, the inline `reduceRight`s and the hand loops become `pushAll`.
Settle the field names first: `top`/`rest` is what `stack_walk` already
exports.

### Tasks

- [x] Choose the spelling; export the type and `pushAll` from `fjs/types`:
      `top`/`rest`, `Stack<F>` in `types/stack_walk/types.ts` and `pushAll`
      in its module.
- [x] `js/ast/sugar/pattern`, `media/datajs/vectors` and
      `rust/serializer`'s `namesOf` over it.
- [ ] `edag/from_fast` and its two children, `js/ast/prepare` (the
      `first`/`tail` `Link`s, renamed to `top`/`rest`), and
      `compiler/parser`, as each is next touched.

### Related

- [stack-walk-driver](./stack-walk-driver.md) — the driver loop; this is the
  cell it pushes.
- [simplify-list-type](../list/todo/simplify-list-type.md) — the lazy
  `List`, which this does not change.
