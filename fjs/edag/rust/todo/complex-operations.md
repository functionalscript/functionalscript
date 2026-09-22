## A complex node has no mapping to a `nanvm-lib` operation

**Priority:** P2
**Status:** open — the mapping is designed below; nothing has landed

### Problem

The printer in [`module.f.mjs`](../module.f.mjs) maps an EDAG node to a
`nanvm-lib` operation one to one where the node is a value over values:
an operator node to the `Any` operator it names, `['()', callee, args]`
to `Any::call`, a plain `['.', receiver, key]` to `Any::member_access`.
Each operation answers the node's value, or the thrown value, as a
`Result<Any<A>, Any<A>>`, and the generated text is right by construction:
a spelling that does not follow the operation's signature does not compile.

The complex nodes have no such mapping. A `.` node with a continuation —
`['.', a, 'b', ['|()', args]]`, the method call `a.b(...args)` — and the
chain steps `|.`, `|?.()`, `|!()` and the `?.` region carry control flow
their operand values do not: a receiver handed to the call as `this`, and
a short-circuit region skipping the rest of the chain
([`../../README.md`](../../README.md), Chains). No composition of the value
operations preserves that. `Any::member_access(a, b)` answers the
property's value and nothing else, so the receiver is gone the moment the
read answers, and `member_access(a, b).and_then(|f| Any::call(f, args))`
spells the detached call `(0, a.b)(...args)`, not the method call the node
means. That the two agree today — a FunctionalScript function is an arrow
function with no `this`, and `nanvm-lib` has no built-in method that reads
a receiver — makes the text plausible, not right: the moment either exists,
every module generated that way is wrong, and the fix is a generator
change and a regeneration where it should be a change in `nanvm-lib`
alone. #2173 tried that spelling and was closed for it.

So the printer refuses every continuation today, which is the honest
state, and the rule for the eager operators and the lazy ones holds for
these too: the operation comes first, in `nanvm-lib`, with the signature
the node's semantics need, and the printer prints it. The design of that
mapping is below. No spelling composed from value operations is to be
tried in its place.

### Design

The README's three continuation types become three Rust types in
`nanvm-lib`, and its "which step is legal where" table becomes their
method sets. A chain is then a value of one of these types, built by the
node that opens it and consumed by the step that ends it, and a spelling
the README does not allow is a method that does not exist.

**Three lambda types.** One struct per row of the README's table:
`PropertyLambda<A>` (a receiver is live, no region is open),
`OptionLambda<A>` (a region is open, no receiver) and
`OptionPropertyLambda<A>` (both). There is no fourth, for the README's
reason: neither bit live is a node boundary, and the value there is an
ordinary `Result<Any<A>, Any<A>>`.

**Three entry points, one per complex node.** Each is a method of
`Any<A>` taking the node's first operand as `self`, and each answers the
lambda type of the state the node produces:

| node | method | key or arguments | answers |
|---|---|---|---|
| `['.', a, key, k]` | `dot` | `key`, a value | `PropertyLambda` |
| `['?.', a, key, k]` | `option_dot` | `key`, a thunk | `OptionPropertyLambda` |
| `['?.()', a, args, k]` | `option_call` | `args`, a thunk | `OptionLambda` |

A `.` node *without* a continuation stays `Any::member_access`, one
spelling per node; `dot` is printed only where a continuation follows.
The other two nodes have no value form, so `option_dot(…).end()` is the
one spelling of a bare `a?.b`.

**One method per legal step.** The README's table, method by method.
Every step takes the lambda by value and answers the next state; the two
terminal steps and `end` answer the chain's `Result`:

| on | step | method | answers |
|---|---|---|---|
| `PropertyLambda` | `\|()` | `end_call(args)` | `Result` — terminal |
| | `\|?.()` | `option_call(args)` | `OptionLambda` |
| `OptionLambda` | `\|()` | `call(args)` | `OptionLambda` |
| | `\|.` | `dot(key)` | `OptionPropertyLambda` |
| `OptionPropertyLambda` | `\|()` | `call(args)` | `OptionLambda` |
| | `\|.` | `dot(key)` | `OptionPropertyLambda` |
| | `\|?.()` | `option_call(args)` | `OptionLambda` |
| | `\|!()` | `end_call(args)` | `Result` — terminal |
| every type | *(no continuation)* | `end()` | `Result` |

The absent steps are the README's absent productions: no `dot` on
`PropertyLambda`, no `option_call` or `end_call` on `OptionLambda`. A
printer that emits one of them does not compile, which is the same guard
the eager and lazy operators already have.

Both terminals are spelled `end_call`, and that is exact rather than a
convenience. On `PropertyLambda` no region is open, so `|()` and a `|!()`
coincide — the README's "there is no bit to clear" — and on
`OptionPropertyLambda` the step is `|!()`, which closes the region. One
name says "the call that ends the chain", and the type alone decides
whether a region closes with it. The vocabulary then reads as a rule: a
chain ends only through a method spelled `end` or `end_call`.

**Which operands are thunks.** Every operand that JavaScript may skip is
an `impl FnOnce() -> Result<Any<A>, Any<A>>`, the same thunk the lazy
operators take, and the signature is again the guard: a value printed
where a thunk belongs does not compile.

- Inside an open region everything is skippable: the `?.` node's own key
  (`u?.[todo()]` never calls `todo`, pinned by `chainsJs.shortCircuit` in
  [`../../proof.f.mjs`](../../proof.f.mjs) and `optionRegion.skips` in
  [`../../amnesia/proof.f.mjs`](../../amnesia/proof.f.mjs)), the `?.()`
  node's arguments, and the key or arguments of every step on
  `OptionLambda` and `OptionPropertyLambda`, `end_call` included — the
  README's `(a?.b)(...c)` short-circuits, *then* evaluates `c`, then calls
  `undefined`.
- `PropertyLambda::end_call` and `PropertyLambda::option_call` take their
  arguments as thunks for a different reason, below.
- The `.` node's key is a value: `a[k]` evaluates both operands whatever
  they are.

**A lambda carries a deferred throw.** `dot` answers a `PropertyLambda`,
not a `Result`, so a nullish receiver cannot throw there: the `TypeError`
waits inside the lambda until `end` or `end_call` surfaces it. That is
what makes the argument thunk on `PropertyLambda::end_call` necessary:
`a.b(...c)` on a nullish `a` throws at the access with `c` untouched
(README, "Where the host engines disagree"), and only a thunk lets the
terminal check the stored throw before it evaluates the arguments.

So each lambda type has three internal states, not two: *live*, with the
receiver and the current value it carries; *skipped*, a region that has
short-circuited; and *thrown*, with the thrown value. Every non-terminal
step is a no-op on the last two. The terminals tell them apart: `end`
answers `Err(thrown)` for the one and `Ok(undefined)` for the other, and
`OptionPropertyLambda::end_call` keeps a throw but *closes* a skipped
region and calls `undefined` — the throw `optionRegion.throw.closeStepOnUndefined`
pins in [`../../amnesia/proof.f.mjs`](../../amnesia/proof.f.mjs).

**What the types guarantee.** Three properties, each one sentence of the
README as a type:

- The structs are not `Clone`, and every method consumes `self`. A
  continuation "cannot be lifted out as a shared node": a lambda can be
  bound to a `let` and used once, never twice, so a receiver is handed to
  exactly one call. `Any<A>` is `Clone`, so this is a decision to record
  in a doc comment, not an accident to derive away.
- The structs are `#[must_use]`. Move semantics stop a chain from being
  used twice; `#[must_use]` stops it from being used zero times, so a
  printer bug that drops a chain midway is a Clippy failure.
- What a terminal answers is a `Result<Any<A>, Any<A>>`, which *is*
  `Clone` and shareable — "neither bit is ever the result of an `exp`".
  The boundary between shareable and not sits exactly at `end` and
  `end_call`.

**The receiver has nowhere to go yet.** `Function::call` in
`nanvm-lib/src/vm/function/mod.rs` takes arguments and no receiver, so
`end_call` can only read the property and call the value today — the very
composition the Problem forbids the *printer*. Behind the operation
boundary it is where that composition is allowed to live: when
`IFunction::call` gains a receiver parameter, `end_call` passes the one
the lambda has been holding, and every generated module is already right.
That change is `nanvm-lib`'s alone, which is the whole point.

**What the printer prints.** A `.` node with a continuation opens with
`Any::dot(a, k)`; each step is a method call on the result, its key or
arguments a thunk printed as `lazyOperand` prints one today; the chain
ends in `.end()` where the continuation operand is absent and in
`.end_call(|| …)` where it is a terminal step. The `|` prefix that keeps
a step from reading as a node has its counterpart here: a step is a method
of a lambda type and never of `Any<A>`, so `Any::call` (a value's
arguments) and `OptionLambda::call` (a thunk) cannot be confused by the
compiler even where a reader might.

### Tasks

- [ ] `nanvm-lib`: the three structs, `#[must_use]`, not `Clone`, with
      the three-state interior and a doc comment on each saying why.
- [ ] `nanvm-lib`: `Any::dot`, `Any::option_dot`, `Any::option_call`, and
      the step methods of the table above — no more, no fewer.
- [ ] `nanvm-lib`: tests for every row of the table, and for the order
      cases the README says JavaScript cannot pin: `a.b(...c)` against
      `(a?.b)(...c)` on a nullish base, and the skipped key and arguments
      inside a region.
- [ ] Printer: print a `.` node with a continuation, `?.`, `?.()` and the
      four steps; keep `member_access` for the bare `.` node; refuse
      nothing the README allows.
- [ ] `IFunction::call` gains a receiver, and `end_call` hands it over —
      the Stage 4 item in
      [`callable-function-objects.md`](../../../../nanvm-lib/todo/callable-function-objects.md).

### Related

- [`../module.f.mjs`](../module.f.mjs) — the printer, and the `.` case that
  refuses a continuation.
- [`../../README.md`](../../README.md) — Chains: the continuation operand,
  the two bits of state, the four steps, and the table this design is a
  transcription of.
- [`../../amnesia/proof.f.mjs`](../../amnesia/proof.f.mjs) — `optionRegion`,
  the skipped operands and the closing call this design has to reproduce.
- [`../../../../nanvm-lib/todo/callable-function-objects.md`](../../../../nanvm-lib/todo/callable-function-objects.md)
  — Stage 4, open for the method call this problem is about.
- `nanvm-lib/src/vm/any/member_access.rs`, `nanvm-lib/src/vm/any/call.rs` —
  the two value operations that do not compose into a method call, and
  that `end_call` composes behind the operation boundary until
  `Function::call` takes a receiver.
