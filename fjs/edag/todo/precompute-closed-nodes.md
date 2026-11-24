## Precompute closed nodes of a function body

**Priority:** P3 — experiment
**Status:** wip — a prototype is in
[`../precompute`](../precompute/module.f.js), called by its proofs alone

### Problem

A node of a function body that reads no argument is the same computation in
every call. A JS-compatible executor still runs it per invocation, since
its cache lives for one invocation
([`../execution-models.md`](../execution-models.md) §2):

```js
const f = () => {
    const a = { b: 2 + 2 }
    return a.b
}
```

Every call builds the object and reads it. Global memoization (§3 there)
describes computing it once; nothing implemented it. It was a different
identity model, so no §2 executor could adopt it:

```js
const g = () => [1, 2]
export default Object.is(g(), g())
```

is `false` with an array per call and `true` with one array. The
[value-identity proposal](../../../spec/todo/value-identity.md) permits both
answers: a `true` implies equal content, and both arrays have it. That makes
the reduction a transformation a compiler may apply, not a separate model.

### Design

`precompute(runtime)(value)` answers an evaluated value with every closure
in it precomputed. It is an experiment, in a module nothing calls by
default.

**A defined frame is constant.** A closure, `['=>', length, captures,
body]`, holds its captures evaluated, so `['frame', N]` in its body is a
constant. A node of the body is *closed* when neither it nor an operand
reaches `['arg', N]`, `['rest']` or `['self']`. A nested function is
closed when every slot is; its body is another scope and is not asked.
*(Decided by the task owner: "if frame is defined, we consider it as
constant".)*

**Calls from the start.** A closed node may hold a call, and the call is
made. One that does not end, does not end in `precompute`; a timeout may
come later. *(Decided by the task owner.)*

**Evaluate, then lift.** Each closed node an open node reads, and the body
where it is closed itself, is evaluated once by
[`memo`](../memo/module.f.js)'s `eachWith`, all in one invocation over the
captures, so a node two of them share stays one value:

- `error` — the node stays where it is, and the function fails where and
  when it did;
- `ok` with a primitive — the primitive replaces the node;
- `ok` with an array, an object or a function — the value becomes one more
  capture and the body reads it as `['frame', k]`.

```js
// before
const make = x => [x]
const f = y => [y, make(1), 2 + 2]
// after: f's captures are [make, [1]], and its body is
const f = y => [y, $1, 4]
```

The answer is an ordinary value. Every §2 executor runs it unchanged and
none needs a cache that outlives an invocation.

**What it may change.** Only what the value-identity proposal leaves
unspecified: two calls can answer one array, object or function where they
answered two. A successful result has the same ordered content
(`structEq`), a failure is the same failure, and a closed node whose
evaluation fails is not touched. Function text changes with the body; that
exception is already adopted ([`../function-text.md`](../function-text.md)).

### Open questions

1. **`self`.** A closure is defined when it is called, so `['self']` is as
   constant as its frame, and a closed `self(1)` could be made once. The
   prototype treats it as open: the value `self` reads is the closure being
   rebuilt.
2. **An open nested function.** In `x => y => [x, y, [1, 2]]` the inner
   body is left as written, since the inner frame is defined only when the
   outer function is called. The `[1, 2]` reaches no binding of either
   function and could lift through a new inner slot into the outer
   captures. Curried functions are common in this repository, so this is
   likely where the rest of the gain is.
3. **Values a precomputation answers.** A lifted closure is not precomputed
   in turn. Doing so without a bound does not end on
   `const mk = n => () => mk(n + 1)`, where each closure's body closes over
   a call that answers the next.
4. **Approval.** The identity change rests on the value-identity proposal,
   which awaits the language designer's explicit approval. Until then the
   module is reachable by its proofs alone, and wiring it into the
   compiler, behind a flag or not, is a separate decision
   ([`070-compiler-flags.md`](../../compiler/todo/070-compiler-flags.md)).

### Tasks

- [x] Settle calls and frames (above).
- [x] `fjs/edag/precompute`: closedness, evaluation and lifting over an
      evaluated value, with proofs — a primitive result, a lifted
      container, a failing node left in place, a captured function called,
      a shared closed node, nested functions, a refused body.
- [ ] Settle open questions 1 to 3, and implement what they decide.
- [ ] Measure over the repository's own modules how many nodes lift, pinned
      to a commit.
- [ ] A bound on a closed call
      ([`bound-edag-interpreter-resources.md`](../../compiler/todo/bound-edag-interpreter-resources.md)).
- [ ] Decide what consumes it, and record §3's new standing in
      [`../execution-models.md`](../execution-models.md).

### Related

- [`../execution-models.md`](../execution-models.md) — §3, global
  memoization, and the transformation requirements.
- [`../../../spec/todo/value-identity.md`](../../../spec/todo/value-identity.md)
  — the bound that permits sharing equal values.
- [`scope-and-identity-free-nodes.md`](./scope-and-identity-free-nodes.md)
  — the scope rule a rebuilt body respects: one node per scope.
