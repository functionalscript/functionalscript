## binary-counter-owner. `set` re-implements `common/monoid`'s binary-counter run stack

**Priority:** P4
**Status:** open

### Problem

`PersistentSet`, declared in [`types.ts`](../types.ts) and built by
[`module.f.mjs`](../module.f.mjs), is a list of runs
whose sizes double, and `add` carries a new element into it exactly as a
binary counter increments — its doc says so: every full entry on the way
is merged into what is carried, and the carry lands in the first empty
one:

```js
// set add
let carry = new Set([value])
let i = 0
while (i < set.length) {
    const entry = set[i]
    if (entry === null) { break }
    carry = new Set([...entry, ...carry])
    i += 1
}
return [...set.slice(0, i).map(() => null), carry, ...set.slice(i + 1)]
```

[`fjs/common/monoid`](../../../common/monoid/module.f.mjs) already owns
that structure, under the same description ("exactly the carry of
incrementing a binary counter"), as its private `push` and `step` over
`_Run`/`_Stack` in its `private.ts`:

```js
// monoid push
const push = operation => size => value => stack =>
    stack === null || stack.size !== size
        ? { size, value, rest: stack }
        : push(operation)(size * 2)(operation(stack.value)(value))(stack.rest)
```

The set's `has`, `size` and `values` then walk its own array-of-runs
shape, which the monoid's stack would also give them.

### Proposal

The run stack gets one owner, and it is `common/monoid`, which already
holds it: `push` and `step` become exports, with a walk over the stack
beside them, and `_Run`/`_Stack` move from its `private.ts` to its
`types.ts` as `Run`/`Stack`, since a second module now names them. No
new module: the structure is the monoid fold's own, and `set` is one
more consumer of it. `add` becomes
`has(value)(set) ? set : step(union)(new Set([value]))(set)` with
`union = a => b => new Set([...a, ...b])`, and `has`/`size`/`values`
walk the stack. The representation of `PersistentSet` changes from an
array of runs to the stack, which is a breaking change to that public
type for anyone who builds or inspects one by shape, and the
implementing PR declares it under `Changelog:` as a
`**BREAKING CHANGES:**` item. Its in-repository consumers are
[`fjs/media/datajs/serializer`](../../../media/datajs/serializer/module.f.mjs)
and [`fjs/edag/value/metadata`](../../../edag/value/metadata/module.f.mjs),
whose `_Visited` is the type; both use it only through `add`, `has` and
the other exports, so both follow the new representation without a
change of their own beyond the type.

### Tasks

- [ ] `push`, `step` and the stack walk exported from `common/monoid`;
      `Run`/`Stack` in its `types.ts`.
- [ ] `set` over them; its proof passes with the new representation;
      the serializer and `edag/value/metadata` updated in the same PR;
      the `PersistentSet` representation change declared in the PR's
      `Changelog:` section.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.
