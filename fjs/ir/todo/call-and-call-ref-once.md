## `call` and `call_ref` through one path

**Priority:** P2
**Status:** open

### Problem

A direct call and a call through a function value differ in where the
parameters come from and in one more operand, the callee. The owned
check and the lifetime pass each implement the two as parallel copies.

**[`lifetime`](../lifetime/module.f.js).** `failStep` drops what a
function owns before a call that answers `never`. The `call_ref` case of
`go` holds the same thing inline, under the comment "A call_ref that
answers never drops what the function owns, as a failing call does": the
same three sets,

```js
const all = env.frames.reduce((x, [, outer]) => union(x, outer), owned)
const borrowed = lent.reduce((r, x) => union(r, leansOn(env, x)), lent)
const leaving = minus(all, borrowed)
```

the same `okList(leaving.map(x => dropOf(env, x)))`, and the same
reducer that gives each part that is not a value a fresh local. That
reducer is in `brStep` a third time. The mode and `lent` lists are built
twice in `go` and twice more in `namedCall` and `named`, differing in
`isOwn(params[k])` against `params[k][0] === 'own'`.

**[`check/owned`](../check/owned/module.f.js).** `callTerm` and
`callRefTerm` run the same steps in the same order — `sequence`,
`stranded`, the `after === null` test, `lent`, `gone`, a three-way tail —
and their refusals differ in the label, `${full}` against `call_ref`.

**[`check`](../check/module.f.js).** The arity and argument-subtype
check has the same shape for both, and
`xs.findIndex(([x], k) => !sub(env, x, params[Number(k)][1]))` is written
four times.

This is P2 and not P3 because the lifetime copy is a soundness rule: a
correction to what is dropped before a failing call has to be made in
`failStep` and again inside `go`, and nothing fails if it is made once.

### Proposal

- **One view of a callee's parameters.** `check` already turns a
  `Signature` into `CodeParam[]`,
  `params.map(p => [isOwn(p) ? 'own' : 'borrow', p[1]])`. Exported from
  [`module.f.js`](../module.f.js) as `codeParams`, it lets every site
  ask `p[0] === 'own'`, and `uncode` and `unsigned` in `check` become one
  rule.
- **`lifetime`**: `leaveWith(env, leaving, parts, make, n)` owns the
  reducer, `chain` and `hold`. `brStep` calls it; `failStep` takes the
  parts and a function that makes the term from the held names, and
  serves both kinds of call.
- **`check/owned`**: one function over the head, the arguments, the
  parameters and a label; `callTerm` and `callRefTerm` each a call of
  it.

### Drawbacks

- The refusals differ in more than the label: parameter names against
  indices, and `callRefTerm` says `call_ref's own: … is borrowed`. One
  path keeps a naming parameter or changes texts that the proofs pin.
- `callRefTerm` counts the callee's roots in `gone` and `callTerm` has
  no callee. The shared function must keep that, and it is the one line
  where a careless merge is unsound.

### Related

- [the facts the stages share](./shared-stage-facts.md)
