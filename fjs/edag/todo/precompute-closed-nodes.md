## Precompute closed nodes of a function body

**Priority:** P3 — experiment
**Status:** wip — [`../precompute`](../precompute/module.f.js) runs on
every module the interpreter loads, within a count of steps

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

### Principles

Decided by the task owner:

1. **Every module is precomputed, as early as it can be.** A module's
   value is computed once, when the module is loaded, and what imports it
   takes the precomputed value. Modules are to be cached across CI builds,
   so the precomputed value is what a cache holds, and the next consumer
   does not walk the graph again.
2. **Everything that can be computed is.** There is no separate
   metaprogramming: a computation whose inputs are known is done ahead,
   whatever kind it is.

What they ask of the design, and where each stands:

- **The place** is where a module's initializer answers its export object,
  `interpreting` in
  [`../../compiler/transpiler`](../../compiler/transpiler/module.f.js): an
  importer's initializer runs over precomputed functions. Done.
- **A value precomputed once is not walked again, and what exists is never
  made again.** A value nothing changed in is answered as itself, and the
  values answered are carried from one module to the next: the module walk
  hands each module the one it completed before
  (`_Load` in [`../../compiler/source`](../../compiler/source/types.ts)).
  Done.
- **A closed call that does not end** is stopped by a count of steps, not
  a clock, so that a cached value is the same on every run. Done, in
  [`../memo`](../memo/module.f.js)'s `eachWith`: the closed nodes of one
  function have a count of nodes to evaluate between them, 100 000 where
  a module is loaded, and a call may nest 64 invocations deep. The count
  travels through the invocation's state and through every call a node
  leaves, a loop of tail calls included, and a node it ends in is left
  where it is, as a node that fails is.

  Two things it does not yet do. A function called back by a member
  function or by a helper is given what was left when the invocation
  around it began, so each such call is bounded and their sum is not: a
  `map` over `n` items can take `n` times the count. And the count is per
  function, not per load, where
  [`bound-edag-interpreter-resources.md`](../../compiler/todo/bound-edag-interpreter-resources.md)
  asks for one count over the whole operation; a module's own
  initialization is not counted at all, as before.
- **Each open question below** is a computation not yet applied, and so
  owed.

**A test that compares sharing between executors does not hold.** The
interpreter's value of a module shares what its precomputed functions
answer, the runtime's among them, where NaNVM running the same graph does
not. Decided by the task owner: `nanvm/harness` compares ordered content
only (`same_content`). Four fixtures also computed a boolean from whether
two equal values were one — `fromEntries([]) === fromEntries([])` and its
kind — which the value-identity proposal leaves to the executor; those
comparisons are gone from the fixtures, and what NaNVM itself shares stays
with the tests that run it.

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

### Measurement

At `eee50e43`, one module with two functions that each compute the same thing
in every call, summed in a loop:

```js
const lookup = i => squares(64)[Number(i % 64)]             // builds a 64-item table per call
const weight = i => [3, 1, 4, 1, 5, 9, 2, 6][Number(i % 8)] // a literal array per call
```

The module was interpreted, written from its evaluated value as
FunctionalScript and as Rust, and written again after `precompute`. Best
of several runs, the same results from all four:

| | as written | precomputed |
| --- | --- | --- |
| Node 22, `lookup` × 20 000 | 73.6 ms | 0.13 ms |
| Node 22, `weight` × 200 000 | 1.78 ms | 1.74 ms |
| NaNVM `naive`, release, `lookup` × 20 000 | 1450 ms | 13.9 ms |
| NaNVM `naive`, release, `weight` × 200 000 | 161 ms | 144 ms |

A closed call is the whole gain: the table is built once and not at all at
run time. A small literal array is about a tenth on NaNVM and nothing a JIT
does not already do. In the precomputed text the table, the literal array
and each loop's initial `[0, 0]` are module-level constants.

The benchmark is not in the tree. It needed one thing the first prototype
lacked: a capture the body no longer reads has to go, since the
FunctionalScript writer refuses a slot no read reaches.

### A module written from its value

`fjs compile` writes `.js` and `.rs` from the program's graph, so every
module-level definition is evaluated again at start. The same writers take
an evaluated value, which is an `Exp`: the module interpreted, its
functions given bodies of their own (`ownBodies`), then written. Tried from
a script outside the tree, at `9a0b2367`:

| | from the graph | from the value | value, precomputed |
| --- | --- | --- | --- |
| `fjs/nanvm/fjsrs/module.f.js` as FunctionalScript | 88.8 KB | 18.3 KB | 19.9 KB |
| the same as Rust | 573 KB | 121 KB | 119 KB |
| `fjs/module.f.js`, the whole compiler, as Rust | 8.57 MB | 8.65 MB | not tried |
| the whole compiler, `Naive`, unoptimized (`debug = false`), `help` | 355 s | 0.40 s | not tried |

Both builds of the compiler print the same help and exit `0`. The start-up
[`whole-compiler.md`](../../../nanvm/fjsrs/todo/whole-compiler.md) asks
about is module initialization, and a module written from its value has
none.

At `ab08cdfd`, with every module precomputed as it loads, the whole
compiler initializes under the interpreter: it did not while the grammar's
rules were told apart by allocation, `duplicate reference definition`, and
does now that they are functions of a group. `fjs compile fjs/module.f.js`
to `.rs` takes 14 min 48 s on Node 22 and writes 9.26 MB. Whether that text
is written from the value or from the graph is not known: the fallback
says nothing.

What does not work yet for the whole compiler: interpreting it takes about
five minutes on Node, each writer several more, and the FunctionalScript
writer refuses the value with `a frame slot that repeats another`, since two
captures of an evaluated closure may hold one value.

A curried function, `k => i => k * squares(64)[Number(i % 64)]`, measured as
the table above was: 75.9 ms to 0.14 ms on Node 22 and 1394 ms to 14.7 ms
on NaNVM, the same as the uncurried one.

### Open questions

1. **`self`.** A closure is defined when it is called, so `['self']` is as
   constant as its frame, and a closed `self(1)` could be made once. The
   prototype treats it as open: the value `self` reads is the closure being
   rebuilt.
2. **A conditional with a known test.** `c ? a : b` is open when any
   operand is. With `c` closed the node is the arm chosen, the other
   dropped, whatever the arms read; the same for a guarded chain on a known
   receiver.
3. **Values a precomputation answers.** A lifted closure is not precomputed
   in turn. Doing so without a bound does not end on
   `const mk = n => () => mk(n + 1)`, where each closure's body closes over
   a call that answers the next.
4. **A known failure.** A closed node that fails is left to fail at every
   call. It could become a `throw` of the value it failed with.
5. **A function of a group.** A closed call into a
   [function group](../../../spec/design/function-groups.md) is made like any
   other, and a group a body builds is rebuilt with the node that reads it.
   A function that is a member of a group, `['fn', group, index]` as a
   value, is answered as itself: the closed nodes of a member's body are
   not evaluated, since its captures are the group's and the other members
   read them by the same place.
6. **A module that does not initialize in reasonable time.** A code
   output now initializes the module, as a data output always did: a module
   whose initialization overflows the host's stack or does not end stops
   `fjs compile` for `.js` and `.rs` too, where it used to be written
   without being run. Initialization is not counted; only what is
   precomputed is.

### Tasks

- [x] Settle calls and frames (above).
- [x] `fjs/edag/precompute`: closedness, evaluation and lifting over an
      evaluated value, with proofs.
- [x] Drop a capture the body no longer reads, and a comma operand already
      evaluated: both are what the FunctionalScript writer refuses.
- [x] Reduce a nested function over its known slots.
- [x] Precompute every module as the interpreter loads it, carrying the
      values answered from one module to the next and making nothing again
      that exists.
- [x] `nanvm/harness` compares ordered content, and its fixtures compute
      nothing from whether two equal values are one.
- [x] A count of steps through the calls a node leaves, and a closed call
      stopped by it.
- [ ] Count what a member function or a helper calls back, and one count
      for a whole load.
- [ ] Choose the count from measurements: 100 000 is a first guess.
- [x] Write `.js` and `.rs` from the module's value in `fjs compile`, by
      default (decided by the task owner), and from the graph where the
      module has no value or the writer no spelling for it. A caller whose
      subject is the writer or the VM asks for the graph: the NaNVM harness,
      the demos and the proofs of the writers.
- [ ] Correct the specification pages that still call them graph outputs
      ([`code-outputs-are-values.md`](../../../spec/todo/code-outputs-are-values.md)).
- [ ] Say which of the two a code output was written from, where it falls
      back to the graph.
- [ ] Merge captures holding one value, so the whole compiler has a
      FunctionalScript spelling.
- [ ] Release builds of the whole compiler from the graph and from the
      value, and the start-up of each.
- [ ] Profile the interpreter and the writers on the whole compiler.
- [ ] Open questions 1 to 5.
- [ ] Record §3's new standing in
      [`../execution-models.md`](../execution-models.md).

### Related

- [`../execution-models.md`](../execution-models.md) — §3, global
  memoization, and the transformation requirements.
- [`../../../spec/todo/value-identity.md`](../../../spec/todo/value-identity.md)
  — the bound that permits sharing equal values.
- [`scope-and-identity-free-nodes.md`](./scope-and-identity-free-nodes.md)
  — the scope rule a rebuilt body respects: one node per scope.
