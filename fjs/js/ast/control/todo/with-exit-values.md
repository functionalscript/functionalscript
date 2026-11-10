## `exitValues` has no inverse

**Priority:** P3
**Status:** open

### Problem

[`control`](../module.f.mjs)'s `exitValues` is the one reader of an
`Exit`'s operands: `yield` carries a list, `break` and `continue` a target
and a list, `return` a target and one value, `throw` one value. The writer,
"this exit with its operands replaced", has no owner, so every pass that
rewrites operands re-derives the four-way split, most of them with the same
identity-preserving guard in front:

```js
// memo/cells: mappedExit
const mappedExit = (exit, values) => values.every((value, index) => value === exitValues(exit)[index]) ? exit
    : exit[0] === 'yield' ? ['yield', values]
        : exit[0] === 'break' || exit[0] === 'continue' ? [exit[0], exit[1], values]
            : exit[0] === 'throw' ? ['throw', values[0]] : ['return', exit[1], values[0]]
// to_fast/join: joinTask
const mapped = (exit[0] === 'yield' ? ['yield', replacement]
    : exit[0] === 'break' || exit[0] === 'continue' ? [exit[0], exit[1], replacement]
        : exit[0] === 'return' ? ['return', exit[1], replacement[0]] : ['throw', replacement[0]])
```

The same split is in `exitTask` of [`memo`](../../memo/module.f.mjs),
`blockTask` of
[`fjs/edag/to_fast/source/loops`](../../../../edag/to_fast/source/loops/module.f.mjs)
and `exitTask` of
[`fjs/edag/from_fast/loop/owning`](../../../../edag/from_fast/loop/owning/module.f.mjs),
where it is spread over two `if`s. A new `Exit` variant is a reader change
in one place and a writer change in five.

### Proposal

`withExitValues(exit, values): Exit` beside `exitValues` in `control`,
identity-preserving when the values are the exit's own, and the five sites
call it. `mappedExit` in `memo/cells` is deleted; the others lose their
inline split. A `mapExitValues(f)(exit)` over the pair is the natural
second export if a caller wants it, but none of the five does today.

### Tasks

- [ ] `withExitValues` in `control`, with a proof case per variant and one
      for the identity.
- [ ] The five sites call it.
- [ ] `tsc` and the suites under `fjs/js/ast` and `fjs/edag`.

### Related

- [fast-children-once](../../todo/fast-children-once.md) — the readers;
  this is the one writer.
