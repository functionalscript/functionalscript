## Precompute closed nodes of a function body

**Priority:** P3 — experiment
**Status:** wip — design questions open, no code yet

### Problem

A node of a function body that reaches no `['arg', N]`, `['rest']`,
`['self']` or `['frame', N]` is the same computation in every call. A
JS-compatible executor still runs it per invocation, since its cache lives
for one invocation
([`../execution-models.md`](../execution-models.md) §2):

```js
const f = () => {
    const a = { b: 2 + 2 }
    return a.b
}
```

Every call builds the object and reads it. Global memoization (§3 there)
describes computing it once; nothing implements it. It was a different
identity model, so no §2 executor could adopt it:

```js
const g = () => [1, 2]
export default Object.is(g(), g())
```

is `false` with an array per call and `true` with one array. The
[value-identity proposal](../../../spec/todo/value-identity.md) permits both
answers: a `true` implies equal content, and both arrays have it. That makes
the reduction a transformation a compiler may apply, not a separate model.

### Proposal

An experiment: `precompute`, a function from an EDAG to an EDAG, in a module
of its own that nothing calls by default.

**Closed.** A node is *closed* when neither it nor any operand reaches
`arg`, `rest`, `self` or `frame` of the function whose body holds it. A
nested `['=>', length, slots, body]` is closed when every slot is; its body
belongs to another scope and is not asked.

**Evaluate, then lift.** Each maximal closed node of a body is evaluated
once, by [`memo`](../memo/module.f.js), when the transformation runs:

- `error` — the node stays where it is, and the program fails where and
  when it did;
- `ok` with a primitive — the primitive replaces the node in the body;
- `ok` with an array, an object or a function — the value becomes a new
  slot of the function and the body reads it as `['frame', k]`. An
  evaluated value is an `Exp` (`_Subset` in
  [`../value/types.ts`](../value/types.ts)), so the slot holds it as
  written.

A slot is evaluated in the scope around its function. The new slot holds a
value, which is closed there too, so in a nested function it lifts again,
and ends as a slot filled at the module level, where it is made once:

```js
// before
const f = x => y => [x, y, [1, 2]]
// after, as the writer would spell it
const $0 = [1, 2]
const f = x => y => [x, y, $0]
```

The result is an ordinary EDAG. Every §2 executor runs it unchanged, the
FunctionalScript writer spells a lifted value as a module-level `const`, and
no executor needs a cache that outlives an invocation.

**What it may change.** Only what the value-identity proposal leaves
unspecified: two calls can answer one array, object or function where they
answered two. A successful result has the same ordered content
(`structEq`), a failure is the same failure, and a closed node whose
evaluation fails is not touched. Function text changes with the body; that
exception is already adopted
([`../function-text.md`](../function-text.md)).

### Open questions

1. **Calls.** A closed node can hold a call — `[1, 2].map(x => x * 2)`, an
   immediately called arrow — and a call may not terminate, at compile time
   where it did not at run time: `() => c ? loop() : 0` never reaches it.
   Proposed for the first step: a node holding a call is not closed.
   Without calls evaluation always ends. Admitting calls waits on a bound
   for the interpreter
   ([`bound-edag-interpreter-resources.md`](../../compiler/todo/bound-edag-interpreter-resources.md)).
2. **A slot that is a module-level constant.** `() => make(1)` reads `make`
   through `['frame', 0]`, so by the rule above nothing in it is closed,
   though the slot is filled once at the module level and the call is the
   same every time. The rule as asked for stops at any `frame`. Following a
   slot to the scope that fills it is the natural second step, and it is
   where most of the gain is, since a body reaches everything outside it
   through its frame.
3. **Program or value.** The proposal transforms a program's `Exp`. The same
   reduction can run over an evaluated closure, `['=>', length, captures,
   body]`, appending to its captures — that is where a module's exported
   functions are after compile-time evaluation. One of the two first, or
   both.
4. **Approval.** The identity change rests on the value-identity proposal,
   which awaits the language designer's explicit approval. Until then the
   module is reachable by its proofs alone, and wiring it into the compiler,
   behind a flag or not, is a separate decision
   ([`070-compiler-flags.md`](../../compiler/todo/070-compiler-flags.md)).

### Tasks

- [ ] Settle the open questions above, and write the answers here.
- [ ] `fjs/edag/precompute`: closedness, evaluation and lifting, with
      proofs — a primitive result, a lifted container, a failing node left
      in place, a nested function lifting through two frames, a closed
      nested function, a lazy arm.
- [ ] Prove the bound: for each case, the transformed program and the
      original agree under `structEq`, and the identity cases that differ
      are named.
- [ ] Measure over the repository's own modules how many nodes lift, pinned
      to a commit, with and without question 2's extension.
- [ ] Decide what consumes it, and record §3's new standing in
      [`../execution-models.md`](../execution-models.md).

### Related

- [`../execution-models.md`](../execution-models.md) — §3, global
  memoization, and the transformation requirements.
- [`../../../spec/todo/value-identity.md`](../../../spec/todo/value-identity.md)
  — the bound that permits sharing equal values.
- [`scope-and-identity-free-nodes.md`](./scope-and-identity-free-nodes.md)
  — the scope rule a lifted value must respect: one node per scope, reached
  through slots.
