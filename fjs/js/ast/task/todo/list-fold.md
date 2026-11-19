## `Task` has no fold over a list; every pass writes the index recursion

**Priority:** P3
**Status:** open

### Problem

[`module.f.js`](../module.f.js) exports the four primitives of deferred work —
`done`, `call`, `bind`, `run` — and nothing that sequences a list. Sixteen
modules import it, and fourteen of them write the list traversal by hand, as
a local function recursing on `index + 1` inside `call`: about thirty-three
such loops at `024d5d2d`, under `fjs/js/ast` (`memo`, `memo/cells`, `prepare`,
`prepare/joins`, `returns`, `sugar`, `sugar/completion`, `sugar/effects`) and
`fjs/edag` (`from_fast`, its `loop/owning` and `loop/root`, `to_fast/join`,
`to_fast/tail`, `to_fast/source/loops`).

The plain ones differ only in what they accumulate:

```js
// edag/from_fast: lowerValues
const each = (index, values) => call(() => index === input.length ? done(toArray(values).toReversed())
    : bind(valueTask(input[index], context), value => each(index + 1, { first: value, tail: values })))
return each(0, null)

// edag/to_fast/tail: expand's roots
const each = (index, recipes) => call(() => index === roots.length ? done({ block, recipes })
    : bind(expand(roots[index]), recipe => each(index + 1, [...recipes, recipe])))
return each(0, [])

// js/ast/memo/cells: values
const each = (index, summary) => call(() => index === input.length ? done(summary)
    : bind(value(input[index], scope, depth), result => each(index + 1, mergeDeferred(summary, result))))
return each(0, emptyDeferred)
```

Each restates the same three decisions next to the one thing the pass means to
say — the step:

- **the suspension.** Wrapping the recursion in `call` is what keeps a long
  list off the host stack; a loop that forgets it is still correct on every
  proof-sized input.
- **the accumulator's representation.** `lowerValues`, `valuesTask` in `memo`
  and `values` in `prepare` collect into a cons list and reverse at the end;
  `expand`, `packedStatements` in `prepare` and `eachTask` in
  `from_fast/loop/owning` spread into a fresh array per item, which is
  quadratic in the list. Nothing in the passes chooses between the two.
- **the end test and the indexing**, which is where an off-by-one would live.

Two modules already extracted a private helper — `each` in
`to_fast/source/loops`, `eachTask` in `loop/owning` — which is the sign the
helper is wanted, and, being private, neither serves the other twelve.

### Proposal

Own the traversal in the task module, where the stack discipline is already
owned:

```js
/** @type {<T, S>(items: readonly T[], initial: S, step: (state: S, item: T, index: number) => Task<S>) => Task<S>} */
export const fold = (items, initial, step) => {
    const each = (index, state) => call(() => index === items.length ? done(state)
        : bind(step(state, items[index], index), next => each(index + 1, next)))
    return each(0, initial)
}

/** @type {<T, U>(items: readonly T[], f: (item: T, index: number) => Task<U>) => Task<readonly U[]>} */
export const map = (items, f) => …   // one accumulator representation, chosen once
```

The examples above become their steps:

```js
const lowerValues = (input, context) => map(input, value => valueTask(value, context))
const values = (input, scope, depth) =>
    fold(input, emptyDeferred, (summary, item) => bind(value(item, scope, depth), result => done(mergeDeferred(summary, result))))
```

A loop whose state is several values (`each(index, scope, anchors)` in
`from_fast`'s block walk, `each(index, statements, deferred)` in
`to_fast/join`'s `blockTask`) folds over a record or tuple of them; the
post-processing some loops do at `index === length` moves to a `bind` after
the fold.

Not every loop is this shape, and the ones that are not should stay as they
are rather than bend the helper:

- **early exit** — `selectedTask` in `to_fast/join` stops at the first
  non-null operand, `evaluatedValues` in `sugar` at the first abrupt part,
  `loop/root` at the first invalid result. A `find`-shaped sibling
  (`first(items, f)`: the first non-null task result) covers `selectedTask`;
  whether the others earn a stopping fold is for the migration to decide, with
  the count in hand.
- **non-tail continuation** — `sugar`'s conditional lowering and
  `sugar/completion` bind on the *rest of the list* and wrap its result
  (`bind(each(index + 1, …), following => …)`). That is a right fold, not this
  one, and is left alone.

Migrate one module per pull request, plain loops first; the helper lands with
its first consumer.

One question the move raises and does not need to answer first: the module
lives under `js/ast` and its `types.ts` describes it as "shared by FAST graph
construction and normalization", but nothing in it mentions FAST, and
`fjs/edag` reaches up four directories for it. `fjs/types/task` may be its
home — compare [stack-walk-driver](../../../../types/todo/stack-walk-driver.md),
which proposes a driver in `fjs/types` for the walkers that keep their own
explicit stack instead of using `Task`.

### Tasks

- [ ] Add `fold` and `map` to `fjs/js/ast/task`, with proofs — including one
      over a list long enough to overflow the host stack without `call` — and
      migrate one module's plain loops in the same pull request.
- [ ] Migrate the remaining plain loops, one module per pull request.
- [ ] Count the early-exit loops that remain and decide whether a stopping
      fold or `first` is worth exporting.
- [ ] Decide whether the module moves to `fjs/types`.

### Related

- [stack-walk-driver](../../../../types/todo/stack-walk-driver.md) — the other
  family of stack-safe walkers, with a hand-written driver loop each.
- [postorder-fold](../../control/todo/postorder-fold.md) and
  [fast-children-once](../../todo/fast-children-once.md) — the same passes,
  deduplicated along another axis: what a node's children are, and the
  memoized fold over them. Independent of this one; a pass migrated to either
  has fewer hand-written loops left for the other.
- [stack-safety](../../../../edag/todo/stack-safety.md) — host-stack depth, the concern
  these traversals exist to answer.
