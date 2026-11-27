## Forward references

**Priority:** P2
**Status:** wip — approved for implementation by @sergey-shandar in the
[implementation request](https://chatgpt.com/c/6b09bd1d-d70c-83e8-ac35-915adb53201e).

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

### Proposal: a function group

The language designer's design, 2026-11-25.

**The language.** Consecutive function `const`s may refer to each other:

```js
const a = () => b
const b = () => a
```

`a` and `b` are **one definition**, a function group of two. Nothing is
defined between the functions of a group: a group used before it is
completely defined is a compilation error.

```js
const a = () => b
const c = a()      // error: `a`'s group is not complete here
const b = () => a
```

JavaScript throws at that call, `b` being uninitialized, so the refusal
admits no program JavaScript runs differently. Allowing other definitions
between the functions of a group, where they do not use it, may come later.

The same rule is expected to hold in a function body, for local functions
that refer to each other, the group made when the enclosing function runs.

**The EDAG.** A group is semantics, the owner of several functions, so the
EDAG says it whatever a VM does with it:

```js
// const a = () => b; const b = () => a
const ab = ['group', [], [
    [0, ['self', 1]],
    [0, ['self', 0]],
]]
const a = ['fn', ab, 0]
const b = ['fn', ab, 1]
```

- `['group', slots, functions]` makes the group: its captured slots, **one
  frame shared by all its functions**, and its functions, each a `length`
  and a body. It is a node, tagged as every node is, since it is made
  once and shared: `a` and `b` are functions of one group.
- `['fn', group, index]` is a function of it. The tag is a placeholder.
- `['self', index]` in a body is function `index` of the body's own group.

The number of functions in a group is not limited by the language: how a
VM holds the index is its own (below).

A group is no array or object of the language, and a program never holds
one: only its functions are values.

**One form or two.** Whether a function that refers to no other keeps
today's `['=>', length, slots, body]`, with `['self']`, is open.

- *Only the group* is one way to write a function, a single one a group of
  one, and one interface for a VM.
- *Both* keeps a single function simple, and leaves room to extend the
  group. It also leaves standing what is keyed on a function node being a
  scope: the analysis's `scope`, and the tail recovery of
  [`fjs/edag/to_fast`](../../fjs/edag/to_fast/README.md), which finds a
  call of the function's own `self` binding by placement, through
  conditionals, sequences and lazy recipes, for up to sixteen parameters
  and a rest. With the group alone a body belongs to a group and an index,
  not to a node, and all of that is keyed again for functions that need
  none of it. One spelling per function is then kept by a rule: a group has
  at least two functions, and the compiler makes one only of functions
  that refer to each other.

**The VM.** A group made at run time is one counted allocation holding the
frame and the code, and a function is a pointer to it with an index:

```rust
let _ab = [() => (_ab, 1), () => (_ab, 0)];
let a: Any = (_ab, 0);
let b: Any = (_ab, 1);
```

The index is not visible to a program. The group holds code, not
functions, so nothing in it refers back to it: no cycle, one counter, and
`Rc` or `Arc` as it stands. An entry of a group is code and knows no group;
calling it takes the group, for the frame and for `['self', index]`. A VM
may implement one interface, a single function a group of one:

```rust
trait IGroup {
    type Function: Function;
    fn at(&self, i: u32) -> &Self::Function;
}
trait Function {
    fn len(&self) -> u32;
    fn call(&self, ...) -> ...;
}
```

How a function value holds its group and its index depends on how wide a
value is:

- *A wide value*, 128 bits, or a VM whose values are not packed at all,
  as NaNVM's reference VM: the index is in the value beside the pointer,
  `GroupFunction { group: Rc<Group>, index: u32 }`. Cloning it is cloning
  the group's `Rc`.
- *A 64-bit NaN-boxed pointer* has no room for an index. The value points
  at the function's own entry inside the group, and the entry holds the
  offset back to the group's counter. Cloning or dropping a function reads
  that offset and counts through it, with `Rc`'s own count behind it, and
  nothing else in the VM does: every other reference counts where it
  points. A call finds its code in the entry it already points at.

Neither limits a group, and neither is seen by a program.

Two function values are the same function where they are the same group
and the same index, so a function read twice is one function on every
executor, a content-addressable one included, where a function is its
group's content and its index.

**No `StaticGroup`.** A function that is a constant of its module,
[`StaticFunction`](../../nanvm/lib/src/vm/static_value.rs) in NaNVM, needs
no group: a Rust `static` names another whichever is written first, so two
static functions that refer to each other are two statics, each naming the
other in its code. Nothing is allocated or counted, so there is no cycle to
break and nothing for a group to own, and a function's identity is its
descriptor's. A group of constants is written that way; only a group made
while the program runs is the allocation above. It needs no frame either:
what a static function captured is a static its code can name, and the
frame `StaticFunction` has today is to go, which is NaNVM's own task.

**Two functions written alike.** A group is what a program can rely on to
be one: a function read twice is the same function. It cannot rely on two
groups being two.

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
  this file's earlier proposal. Not to be implemented: a group of functions
  is no object or array of the language, and the functions of a group name
  each other without one.
- *An untagged group*, `['=>', [slots, functions], index]`. What is made
  once and shared is a node in the EDAG, and a node has a tag; an untagged
  array is a list, never shared. Each function would make a group of its
  own, and `b` reached from `a` would not be the `b` outside.
- *Lowering to `['self']` alone*, `const make = () => ({ a: () => make().b() })`.
  Every read inside builds the group again. On a VM that compares by
  reference a structure made that way cannot be walked: each visit meets
  functions never seen before, and a grammar never ends.
- *A fresh-identity operation.* It defeats content addressing: a value
  would carry something that is no part of its content.
- *Counting inside a group*: an owner in every object's header costs every
  clone a read; a counter per part with a check when one reaches zero is
  not what `Rc` does and is hard to make safe across threads. One counter
  for the group and an index in the reference needs neither.

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
function group above does.

**Approval.** The self case was approved by @sergey-shandar on 2026-10-06,
and implemented as the pull requests #2629 (the EDAG node) and #2630 (the
language rule).

### Tasks

The compiler step covers module and local groups together: each passes through
the same binding resolution, graph construction, analysis, and output pipeline.

- [x] A function reading its own `const`'s name, `e` above: the function
      itself, [`["self"]`](../../todo/edag-stage1-discussion.md).
- [x] Record the language designer's explicit approval of the function
      group for implementation.
- [x] Keep both forms. A standalone function keeps `['=>', length, slots, body]`,
      including its existing self-tail-call recovery.
- [ ] The EDAG: `['group', slots, functions]`, `['fn', group, index]` and
      `['self', index]`.
- [ ] The language rule: consecutive function `const`s that refer to each
      other are one group, and a use of a group before its last function
      is a compilation error.
- [ ] Every consumer of a function: the analysis, both interpreters, both
      writers, the Rust backend and NaNVM's function value. A group of
      constants is written as static functions that name each other, with
      no `StaticGroup`.
- [ ] Migrate EBNF and its callers together so each named rule has a body
      and the compiler can build its own grammar.
- [ ] `fjs/ebnf`: rules that name each other as functions of one group, in
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
