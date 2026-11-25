## Forward references

**Priority:** P2
**Status:** open — the function table below is the language designer's
design; its explicit approval for implementation is not recorded yet

### Problem

A module `const` cannot read a `const` declared after it: the compiler answers
`const not found`, so a function cannot call a later function
([shared values](../bindings/constants/README.md)). A function calling
itself is resolved, the `e` case below: a `const` whose whole value is a
function has the name in that function's body, the EDAG's `["self"]`.

```js
const a = () => 5;
const b = () => a() + 7; // ok
const c = b();           // ok
const d = d();           // error!
const e = () => e();     // ok: landed, `e` is the function's own `["self"]`
// two mutually recursive functions:
const f = () => h();     // not ok today, ok under the proposal below
const h = () => f();     // ok
```

Two functions that refer to each other have no spelling, and what is used
instead leans on allocation identity.
[`fjs/ebnf`](../../fjs/ebnf/module.f.js)'s `reference` is
`() => () => ['ref']`: a rule's identity is a function allocated for the
purpose, and its body and its parser mapping are found by `===`. Under the
[value-identity proposal](./value-identity.md) two such functions may be
one, and on a content-addressable VM they are one. The compiler's own
grammar holds eleven of them, and it stops initializing,
`duplicate reference definition`, once a function that reads no argument
is computed ahead of its calls, as
[#4111](https://github.com/functionalscript/functionalscript/pull/4111)
does.

### Proposal: a function table

Decided by the language designer, 2026-11-25.

**The language.** Consecutive function `const`s may refer to each other:

```js
const a = () => b
const b = () => a
```

`a` and `b` are **one definition**, a function table of two. A `const`
that refers to no later one is a table of one. Nothing is defined between
the functions of a table: a table used before it is completely defined is a
compilation error.

```js
const a = () => b
const c = a()      // error: `a`'s table is not complete here
const b = () => a
```

JavaScript throws at that call, `b` being uninitialized, so the refusal
admits no program JavaScript runs differently. Allowing other definitions
between the functions of a table, where they do not use it, may come later.

The same rule is expected to hold in a function body, for local functions
that refer to each other, the table made when the enclosing function runs.

**The EDAG has no function, only a function table.** A table is its
captured slots, one frame shared by all its functions, and its functions,
each a `length` and a body. A function value is a table and an index into
it. A function's body reads another function of its table as
`['self', index]`; today's `['self']`, the function itself, is its own
index.

**The VM.** A table is one counted allocation holding the frame and the
code, and a function is a pointer to it with an index:

```rust
let _ab = [() => (_ab, 1), () => (_ab, 0)];
let a: Any = (_ab, 0);
let b: Any = (_ab, 1);
```

The index is not visible to a program. The table holds code, not
functions, so nothing in it refers back to it: no cycle, one counter, and
`Rc` or `Arc` as it stands. Two function values are the same function where
they are the same table and the same index, so a function read twice is
one function on every executor, a content-addressable one included, where
a function is its table's content and its index.

**Two functions written alike.** A table is what a program can rely on to
be one: a function read twice is the same function. It cannot rely on two
tables being two.

```js
const a = () => 'x'
const b = () => 'x'
```

Neither `Object.is(a, b)` nor `structEq(a, b)` promises `true` or `false`
here: a compiler may compare the two EDAGs, find the functions the same and
make them one, and a content-addressable VM always does
([value identity](./value-identity.md)). So a program that needs two
functions told apart gives them different content, and one that needs them
found equal compares what they are made from, not the functions.

**What was considered and left.**

- *An object as the group*, `const x = { a: () => x.b(), b: () => x.a() }`,
  this file's earlier proposal. Not to be implemented: a table of functions
  is no object or array of the language, and the functions of a table name
  each other without one.
- *Lowering to `['self']` alone*, `const make = () => ({ a: () => make().b() })`.
  Every read inside builds the group again. On a VM that compares by
  reference a structure made that way cannot be walked: each visit meets
  functions never seen before, and a grammar never ends.
- *A fresh-identity operation.* It defeats content addressing: a value
  would carry something that is no part of its content.
- *Counting inside a group*: an owner in every object's header costs every
  clone a read; a counter per part with a check when one reaches zero is
  not what `Rc` does and is hard to make safe across threads. One counter
  for the table and an index in the reference needs neither.

### The self case: benefits and drawbacks

The `e` case is one rule: a `const` whose whole value is a function has the
name in that function's body, after the names the body binds itself. What
it buys is recursion as JavaScript writes it — `fact` calling `fact` —
where before a function reached itself only through a fixed-point
combinator or by being passed to itself, and the graph stays acyclic: the
read is the EDAG's `["self"]`, a node of the function, not an edge back to
its `const`. What it costs is one node kind the analysis, both
interpreters, the Rust printer and both writers must spell, and one
refusal: a body `const` of the name after the body has read the function
by it is `capture shadowed`, where JavaScript throws at run time, since the
read would have named the `const` before its initializer ran. The rule
stops at the function itself — `h` from `f` above stays refused — so it
decided nothing about how a mutually recursive group is resolved; the
function table above does, and makes `['self']` its case of one.

**Approval.** The self case was approved by @sergey-shandar on 2026-10-06,
and implemented as the pull requests #2629 (the EDAG node) and #2630 (the
language rule).

### Tasks

- [x] A function reading its own `const`'s name, `e` above: the function
      itself, [`["self"]`](../../todo/edag-stage1-discussion.md).
- [ ] Record the language designer's explicit approval of the function
      table for implementation.
- [ ] The EDAG: the function table node, a function taken from it, and
      `['self', index]`; today's `['=>', length, slots, body]` and
      `['self']` as a table of one, or replaced by it.
- [ ] The language rule: consecutive function `const`s that refer to each
      other are one table, and a use of a table before its last function
      is a compilation error.
- [ ] Every consumer of the function node: the analysis, both interpreters,
      both writers, the Rust backend and NaNVM's function value.
- [ ] `fjs/ebnf`: rules that name each other as functions of one table, in
      place of `reference`, `define` and `definitions`, and the compiler's
      grammar. `referenceMappingsKeepIdentity` in
      [`fjs/ebnf/ll1`](../../fjs/ebnf/ll1/proof.f.js) maps one of two rules
      of the same body and not the other, which no executor is held to:
      the requirement goes, and a grammar that maps two rules differently
      writes them differently.
- [ ] The same rule in a function body
      ([`body-const-forward-reference.md`](../../fjs/compiler/parser/todo/body-const-forward-reference.md)).

### Related

- [`body-const-forward-reference.md`](../../fjs/compiler/parser/todo/body-const-forward-reference.md)
  — the same gap inside a function body.
- [function-frame](../design/3111-function-frame.md) — mutually recursive functions
  and their frames.
