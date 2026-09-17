## refs-stack-safety. `refsOf`'s access-chain case still recurses

**Priority:** P3
**Status:** open

### Problem

`refsOf` in [`../module.f.mjs`](../module.f.mjs) walks an `AstConst` collecting
the `cref`/`aref` references it reaches, for `sharing` and `anchors`. Its
`'.'` case is genuine JS recursion — one call per link of an access chain:

```js
case '.': {
    const read = view.through(ast)
    return read !== null && typeof read === 'object' && read[0] === '.'
        ? map(deeper(`${read[2]}`))(refsOf(view)(read[1]))
        : refsOf(view)(read)
}
```

A chain of `.` twenty thousand deep — `a.x.x.x…x`, `fjs/fsc/parser`'s own
proof bar for "nothing walks the tree" — overflows the call stack here. This
predates Stage A operators
([`spec/todo/2340-operators.md`](../../../../spec/todo/2340-operators.md)):
measured against the commit before that work landed, and unrelated to it.

Stage A gave `refsOf` a second chain shape — a long run of one operator
nests its growing operand (`**`'s right, every other operator's left,
`fjs/fsc/parser/module.f.mjs`'s `leftAssocNode`/`unaryNode`) as deep as the
chain — and *that* case is fixed: `refsOf` walks it with a loop, collecting
each link's non-growing side on a heap-allocated list rather than recursing,
the same technique `unaryNode` itself uses on the parser side and
`fjs/fsc/edag/module.f.mjs`'s `lower` uses for the identical shape at
lowering. See `operatorStackCost` in
[`../proof.f.mjs`](../proof.f.mjs)'s `anchors` entry for the twenty-thousand
bar met there.

The `'.'` case was deliberately left as it was rather than folded into that
fix: unlike an operator's side operand, `view.through(ast)` is not a plain
recursive descent — it can transform the node into something of a different
shape entirely (the `value` view's `selected` resolves an access straight
through a known literal), so peeling one level per loop iteration means
re-deriving that transform's per-step contract, not just moving a spine walk
into a loop. Real, but a separate piece of work from Stage A's own.

### Proposal

Not designed. The operator fix's shape — walk the growing side in a loop,
push what has to be applied afterward (here, a `deeper(key)` wrap rather
than a `side` ref-list to concatenate) onto a `{ first, tail }` list, then
unwind it once the chain bottoms out — is the likely template; the open
question is only how `view.through`'s transform composes across steps
without re-running it at each one from scratch.

### Tasks

- [ ] Design the loop, particularly how `view.through`'s per-step transform
      threads through an iterative walk.
- [ ] `refsOf`'s `'.'` case rewritten; a stack-safety proof at the same
      20,000 bar as `operatorStackCost`.
- [ ] `tsc`, `fjs t`, `npm run cov` at 100%.

### Related

- [`../../parser/README.md`](../../parser/README.md) — "twenty thousand
  siblings, twenty thousand levels" is this front end's own bar for "nothing
  walks the tree," stated for the parser side.
- [`../../parser/module.f.mjs`](../../parser/module.f.mjs)'s `unaryNode` —
  the same technique, applied where a chain of `-`/`~`/`**` would otherwise
  recurse one JS call per link during folding.
- [`../../edag/module.f.mjs`](../../edag/module.f.mjs)'s `lower` — the same
  fix again, for the identical operator-chain shape at EDAG-lowering time.
