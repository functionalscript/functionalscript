## The runtime as a value the module receives

**Priority:** P2
**Status:** wip — the shape is `sergey-shandar`'s, from the session that
filed this, who approved the primitives as recognized helpers and the
strengthened invariant by asking for the implementation; the first
primitive, `slice`, was the first step, `runtime::<A>()`, the value
built beside the lifted tables, the second, and `module::<A>(runtime)`,
which retired the lifting, the third; `dot` over the natives remains

### Problem

A runtime is generated from FunctionalScript code: that is the principle
[`runtime.md`](./runtime.md) set, and [`../runtime/module.f.js`](../runtime/module.f.js)
is the one definition of every body. NaNVM cannot hold it the way the
interpreter does. Rust has no generic `static`, and a `static` cannot hold
a value a VM allocates, so an `Any<A>` is never a global, and the
`runtime` export object — a map of functions — has no place to live
between calls. The static-runtime printer,
[`../../compiler/rust/runtime/module.f.mjs`](../../compiler/rust/runtime/module.f.mjs),
worked around that by *lifting* the module at compile time: every function
became a static `fn`, the two tables became functions answering arrays of
function pointers, `statics` and `members` in `vm/gen.runtime.rs`, and
everything else at module scope was refused — the README's section of
the time, "The runtime is static code, not a value", which "How NaNVM
finds it" replaces. The workaround cost more than it saved:

- **Dispatch exists twice.** `dot`, the dispatcher written once in the
  language (`runtime-members.md`), is printed nowhere; `Member::call` in
  `nanvm/lib/src/vm/lambda/member.rs` reimplements its order in Rust —
  own property, the native table, `runtime_method`, the `TypeError` —
  against [DESIGN.md §13](../../../doc/DESIGN.md#13-one-source-of-truth-optimize-by-substitution).
  The open task of `runtime-members.md` that would compile `dot` as a
  `match` on the name is a third spelling of the same order.
- **The runtime holds no data.** An object, an array or a computed
  initializer at module scope is refused, so the Unicode casing table
  `toLowerCase` is written over, and the tables the number formatters
  need, cannot be where their bodies are.
- **A built-in is identified by its name, not by a value.** `Object.is
  === Object.is` holds because `RuntimeFunction`s compare by name; the
  README spends a paragraph on why a pointer comparison would pass a
  debug build and fail a release build. The language already has
  identity; the lifting threw it away.
- **Two printers.** The lifting printer is a second Rust backend beside
  [`../../edag/rust/module.f.mjs`](../../edag/rust/module.f.mjs), with its
  own resolution of frame slots, its own refusals, and a bound per kind
  of item, `IVm` for a static and `IStaticFunction` for a member.

The interpreter has none of this: `runtimeAt` evaluates the module to a
value, and `invokeWith` in [`../../edag/memo/module.f.mjs`](../../edag/memo/module.f.mjs)
threads that value through every invocation.

### Proposal

**The runtime is a value, built once, and passed to the module.** The
ordinary Rust backend prints the runtime module as it prints any module,
and a compiled module takes the value as its parameter:

```rust
pub fn runtime<A: IVm>() -> Result<Any<A>, Any<A>> {
    // generated code, which cannot name `runtime`: the identifier does not exist here
}

pub fn module<A: IVm>(runtime: Any<A>) -> Result<Any<A>, Any<A>> {
    // generated code, which reaches every built-in through `runtime`
}
```

The host — the harness, the CLI, a program embedding a VM — builds
`runtime::<A>()` once and hands it to every module it runs; two VMs in
one process build two. Building it needs no runtime, which the existing
invariant already guarantees: no initializer of the runtime's closure
calls a member function or reads a static function, and `runtimeAt`
checks it under `noRuntime`. Closures of a user module reach the value
through their frames, as they reach any module-scope value, so nothing
below the module changes: `StaticCode<A>`, `Any::call`, the operators and
the natives keep their signatures.

**Three layers, each reaching only the one below it.**

1. **Natives, in `nanvm-lib`.** Rust functions of the receiver and the
   arguments, `fn(Any<A>, Array<A>)`, with no runtime in their signature
   or body. They never need one: a callback a native invokes, `map`'s,
   is a function value whose frame holds whatever runtime its module
   received. The library stays runtime-free end to end.
2. **The runtime module.** Bodies over the primitives and over each
   other, by direct reference — `found(...)`, `isNaN_(x)`, as the module
   already does — and over `entry` and `hasEntry`. It contains **no
   member call and no static read**: the rule the spec states for `dot`
   alone, "the core of the runtime may not use what it defines"
   ([spec: why two helpers](../../../spec/property-access/entries.md#why-two-helpers)),
   becomes the rule for the whole module.
3. **User modules.** Every member call prints through the value,
   `runtime.dot(receiver, key)` then the call of what it answers, and
   every static read is the property reads of its path,
   `runtime.static.Object.is`.

**The primitives are recognized helpers, like `entry` and `hasEntry`.**
Layer 2 can hold no member call only if the bodies reach the natives
another way, since no native is an own property and `entry` cannot read
one. The parser already recognizes two function bodies whole, under any
name, as the EDAG's `['entry']` and `['hasEntry']`
([`../../compiler/parser/module.f.mjs`](../../compiler/parser/module.f.mjs);
[`../../types/object/entry/module.f.js`](../../types/object/entry/module.f.js)).
Each primitive no body can define gets the same status: a module whose
host body is the one member call, `(s, a, b) => s.slice(a, b)`, recognized
whole as a node of its own, which the runtime imports and calls as a
function, `slice(self, start, end)`. `natives` in
[`../static/module.f.js`](../static/module.f.js) becomes the list of them.
The README's own count of true primitives is short — `charCodeAt` and
`slice` on a string, `Object.entries`, then `String.fromCharCode` and the
number-formatting floor when they are admitted — and a name gets a
primitive only when no body can define it, since each costs what the pair
cost: a recognized body, a node, its serialized text, an interpreter
answer and a Rust spelling.

**The rule is enforced by rustc, for free.** Every member call and
static read prints through the `runtime` identifier, and the runtime
module has no such identifier, so a body that uses what the runtime
defines fails `cargo build` with "cannot find value `runtime`" in
`gen.runtime.rs`. No native-aware branch in the printer, no
generation-time check: one spelling of a member call for every module,
and the runtime module simply never contains one. The error names a
generated line one step after `npm run gen` rather than the body; that is
enough until a real case asks for more.

**`dot` dispatches the natives too.** With the primitives callable as
functions, a per-name body in `member` covers the receivers a native
answers today, `slice: self => typeof self === 'string' ? (a, b) =>
slice(self, a, b) : ...`, so the lookup order in
`nanvm/lib/src/vm/lambda/method.rs` retires as a dispatch and the
natives stay as implementations. A VM that wants a native over a body
substitutes it — DESIGN.md §13 — and nothing else moves.

**Property reads were never the problem.** A bare `a.p` is an own
property, `length` or index read in the library, `Any::dot(a,
key).end()`, and the language never reads a prototype member as a value,
so a read cannot reach the runtime; `entry` could not replace it anyway,
since `length` is non-enumerable. The runtime keeps `self.length`.

**What goes.** The lifting printer and its tests; `RuntimeFunction`,
`Accessor` and `MemberCode` in `nanvm/lib/src/vm/function/mod.rs`,
`runtime_static` and `runtime_method` in `nanvm/lib/src/vm/runtime.rs`;
the `IVm`/`IStaticFunction` split per item; the name-identity rule and its paragraph in the README.
`nanvm/lib/todo/static-runtime-calls.md` loses its subject, not its
point: the ordinary backend calls a captured module function through
`Any::call` of its frame slot as the lifting printer called an item's
accessor, so the direct call of a known callee stays open, retargeted at
that backend as
[`../../edag/todo/direct-calls.md`](../../edag/todo/direct-calls.md), to
measure first.

**What needs a home: the built-in's text.** `String(Object.is)` is the
NativeFunction text, `function is() { [native code] }`, never the body's
(`runtime-static.md`). Today `Function::text` forms it from the
descriptor's name. As a value, `Object.is` is a closure in the runtime
object and would print its arrow. The printer, printing the runtime
module, can read the `runtime` export's shape as the lifting printer does
today and give each function a `static` or `member` path reaches the
NativeFunction text of that path, where every other arrow gets its own
text; whether that or a marker on the value is the right form is the one
detail to settle in the first task.

**Alternatives considered.**

- *The runtime as a parameter of every generated function*, which is what
  the interpreter's `invokeWith` does. It lets a runtime body late-bind
  through the parameter and so reference the runtime itself, but every
  function, `Any::call` and every operator that can call user code would
  carry it, and so would the natives. Rejected for now: the natives must
  not use the runtime, and the layering above makes self-reference
  unnecessary. Worth revisiting only if a VM needs a context in every
  function for another reason, a heap or an arena, in which case the
  runtime rides in that context.
- *A generation-time refusal in the printer* of a member call to a
  `member` key inside the runtime, with a native-only spelling for the
  rest. Unnecessary once the runtime contains no member call at all.
- *A third host helper for `dot`*, a native lookup asked after the body.
  Unnecessary once the natives are primitives a body can call.

### Tasks

- [x] Approval of the shape, the primitives as recognized helpers and the
      strengthened invariant, by the language designer, before the next
      task.
- [x] The first primitive with its first consumer: `slice` as a
      recognized helper body with a node, the interpreter's answer, the
      serialized text and the Rust spelling, listed in `fjs/edag`'s
      `intrinsics` — the code's word for a primitive, since `Primitive` is
      the EDAG's name for a literal value — and called as a function by
      `found` (`fjs/js/intrinsic`).
- [ ] `charCodeAt` the same way, with the first body that reads a code
      unit.
- [x] The runtime module holds no member call and no static read, but
      the natives its table lists as themselves, `Object.entries`; the
      README's invariant says so for bodies as it does for initializers;
      the proof checks it on the EDAG, as it pins `dot`'s shape.
- [x] `runtime::<A>()` printed by the ordinary backend, every function a
      `static` or `member` path reaches carrying the NativeFunction text
      of that path, where `dot`, which no program reaches, and the helpers
      keep their bodies'; the built-in's identity is the value's;
      `Object.entries` a primitive the `static` section lists like the
      rest, as the built-in itself.
- [x] `module::<A>(runtime)`: the compiler prints a member call step on
      a member with `&runtime`, through which the library's call step asks
      the value's `dot` after the native table, and a static read as
      `static_read(&runtime, path)`; a closure holds the runtime in its
      frame where its body reaches a built-in; the harness and the corpus
      build the value once; the runtime module prints with no runtime in
      scope, so a body using what the runtime defines is the printer's
      refusal, by name, before rustc sees it.
- [ ] `dot` over the natives: a per-name body in `member` for every name
      the native table answers, the table's lookup order and
      `Member::call`'s runtime steps retiring; `nanvm/member` as the
      oracle.
- [x] Delete the lifting printer, `RuntimeFunction`, `Accessor`,
      `MemberCode`, `runtime_static` and `runtime_method`, and retarget
      `static-runtime-calls.md` at the ordinary backend as
      `fjs/edag/todo/direct-calls.md`; the README's "How NaNVM finds it"
      describes the value.

### Related

- [`runtime.md`](./runtime.md) — the principle: one definition, in
  FunctionalScript, for every executor.
- [`runtime-static.md`](./runtime-static.md) — the static section and the
  NativeFunction text this keeps.
- [`runtime-members.md`](./runtime-members.md) — `dot`; its task that
  compiles `dot` as a `match` is superseded by printing it as a function.
- [`../runtime/README.md`](../runtime/README.md) — "How NaNVM finds it",
  the lifting this replaces, and the two invariants, one of which this
  strengthens.
- [`../../../nanvm/lib/src/vm/runtime.rs`](../../../nanvm/lib/src/vm/runtime.rs)
  — the value, where the tables and the search were.
- [`../../edag/todo/direct-calls.md`](../../edag/todo/direct-calls.md)
  — the direct call of a known callee, retargeted at the ordinary backend.
- [spec: why two helpers](../../../spec/property-access/entries.md#why-two-helpers)
  — "the core of the runtime may not use what it defines", the rule this
  extends to the whole module.
