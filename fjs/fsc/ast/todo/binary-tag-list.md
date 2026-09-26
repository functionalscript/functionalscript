## binary-tag-list. The binary operator tags exist only as a type, so four switches list them by hand

**Priority:** P3
**Status:** open

### Problem

`BinaryTag` in `types.ts` names the two dozen binary operator tags, and
nothing at run time does. Four switches therefore spell the list:
`enter` in `fsc/parser`, `toDjs` and `operandsOf` in `fsc/ast`, and
`lower` in `fsc/edag`, each as a column of

```js
case '*': case '/': case '%': case '**': case '+': … case '>>>': case '&&': case '||': case '??':
```

`operandsOf` restates the lazy three inside its copy, which is
`lazyOp2Id` from `fjs/edag` again. And the grammar's operator names are
written twice more: `fsc/parser/grammar` builds `multiplicativeOp = {
mul: sym('*'), div: sym('/'), mod: sym('%') }` and its siblings, and
`fsc/parser`'s `binaryOpTag = { mul: '*', div: '/', mod: '%', … }` copies
the same pairs.

A new operator — `is`, from
[../../../edag/todo/is-operator.md](../../../edag/todo/is-operator.md)
— is a grammar table, `binaryOpTag`, the type and four switches. A
missed `case` is not a type error: in `toDjs` and `lower` the tag falls
to `default` and is treated as an access.

### Proposal

This module owns the tags at run time as well, the way
`_tokenKindNames` already does for token kinds:

```ts
export const binaryTags: readonly BinaryTag[]
export const isBinaryTag: (t: string) => t is BinaryTag
```

pinned to the type with `Assert<Equal<…>>`. The four switches become
`isBinaryTag`; `operandsOf` asks `lazyOp2Id`. The grammar declares one
name-to-tag record per layer and maps `sym` over it, and `binaryOpTag`
is the merge of those records.

### Tasks

- [ ] `binaryTags`, `isBinaryTag`, the type pin, with a proof.
- [ ] The four switches and the grammar tables through them.
- [ ] `tsc`, `fjs test`.

### Related

- [../../parser/todo/value-token-kind-list.md](../../parser/todo/value-token-kind-list.md)
  — the same fix for the primitive token kinds.
- [../../serializer/todo/stage-a-operators.md](../../serializer/todo/stage-a-operators.md)
  — the writer's spelling of the operators, which would read the same
  list.
