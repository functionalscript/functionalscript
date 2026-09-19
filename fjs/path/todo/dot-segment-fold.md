## dot-segment-fold. The `.`/`..` rule is written twice inside `fjs/path`

**Priority:** P3
**Status:** open

### Problem

`foldNormalizeOp` in [`module.f.mjs`](../module.f.mjs) and
`importDotSegments` in [`import/module.f.mjs`](../import/module.f.mjs) are
the same three-case rule with the same `rooted` clamp:

```js
// foldNormalizeOp — over a List
case '': case '.': { return state }
case '..': {
    switch(last(undefined)(state)) {
        case undefined: { return rooted ? state : listConcat(state)([input]) }
        case '..': { return listConcat(state)([input]) }
    }
    return take(length(state) - 1)(state)
}
default: { return listConcat(state)([input]) }
// importDotSegments — over an array, with the URL grammar's spellings
case '.': case '%2e': return segments
case '..': case '.%2e': case '%2e.': case '%2e%2e':
    return segments.length !== 0 && segments[segments.length - 1] !== '..'
        ? segments.slice(0, -1) : rooted ? segments : [...segments, '..']
default: return [...segments, segment]
```

They differ on two nameable axes: how a segment is classified — the plain
spellings against the percent-encoded ones, and whether `''` is dropped or
kept — and the carrier. The clamp is the half that decides whether a
traversal escapes; `escapes` here and `decode` there are both
security-adjacent and answer from two independently maintained copies.

### Proposal

One fold parameterised by the classification:

```ts
const dotSegmentFold: (classify: (segment: string) => 'skip' | 'up' | 'keep') => (rooted: boolean) => Fold<string, List<string>>
```

`fjs/path` classifies `''` and `'.'` as `skip` and `'..'` as `up`;
`fjs/path/import` classifies the four percent spellings as `up`, the two
dot spellings as `skip`, and `''` as `keep`, which is the difference its
comment documents. The clamp then has one definition.

### Tasks

- [ ] `dotSegmentFold` with a proof of the clamp in both `rooted` states;
      both modules over it.
- [ ] `tsc`, `fjs test`.

### Related

- [decode-once.md](./decode-once.md) — `fjs/path`'s other internal
  sharing; bounded to `module.f.mjs`.
- [`../../effects/node/virtual/todo/lexical-path-resolution.md`](../../effects/node/virtual/todo/lexical-path-resolution.md) —
  keeps `parse` lexical; this issue is about the lexical rule having one
  copy.
