## Draw a chain as a table of its links

**Priority:** P2
**Status:** wip

### Problem

The EDAG demo ([`../demo.f.mjs`](../demo.f.mjs)) draws a chain — a method
call, an optional chain — as the one node the EDAG holds, which is right,
but spells the whole chain into that node's label and hangs every operand
on one flat list of ports:

```js
export default []?.[Number(5)].c(0, 2).d
```

draws as one box labelled `?..c().d` with ports `obj`, `idx`, `c(0)`,
`c(1)`. The label is a string the reader has to parse, a computed key
leaves a bare `.` in it (`..c`), and nothing ties a port to the link it
belongs to.

### Proposal

Sergey's proposal on
[functionalscript/functionalscript#3033](https://github.com/functionalscript/functionalscript/pull/3033#issuecomment-6256884000):
the chain node is a table, **one group of rows per link**. A link's
operator — `?.`, `.`, `()`, `?.()`, `(?.)()` — is a label cell spanning
its rows, and each row is the link's key or an operand:

```
?.  | obj | -> []
    | idx | ┄> Number(5)
.   | c   |
()  | ... | ┄> [0, 2]
.   | d   |
```

- **A static key is a value in the row**, `c`, `d`, or a numbered index
  `[0]`.
- **An operand is an arrow**, its row named by its role where it has no key
  of its own: the receiver `obj`, a guarded call's `callee`, a computed key
  `idx`, a call's arguments `...`.
- **A call's arguments are one `[]` node**, `() | ... | -> [0, 2]`, not a
  port per argument: two calls in one chain would otherwise both have a
  `(0)` port. A spread argument is the `[]`'s spread, as in an array
  literal. A plain call, `f(x)`, takes the same shape: a `()` node with
  `callee` and `...`.
- **The first link always has two rows**: the receiver (`obj`, or `callee`
  for a guarded call) and the key or arguments. Every arrow then has its
  name beside it, and the first link reads as a plain `a.x` does, a `.`
  with `obj` and `key`.
- **Laziness stays on the edges**: once a `?.` has been passed, every
  operand after it is dashed, until a call's parentheses close the region.

A link's label spanning only its own rows is new to the shared graph
module ([`../../../website/demo/graph/module.f.mjs`](../../../website/demo/graph/module.f.mjs)),
whose label column spans every row of a node.

### Tasks

- [ ] The graph module draws a node's label column in groups, each
      spanning its own rows.
- [ ] The EDAG demo draws every chain as a table of its links, and a call's
      arguments as one `[]` node.
