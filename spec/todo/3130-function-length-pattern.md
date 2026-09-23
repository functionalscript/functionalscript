# Function length pattern

**Priority:** P2
**Status:** open — a new language feature, so it waits on formal approval by
the language designer named in
[DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo)
before anything below is implemented. The same approval has to settle the
[decision](#the-decision-this-proposal-is-one-arm-of) between this pattern and
the closure record two open pull requests already take.

## Problem

[Parameters](./3120-parameters.md) preserves declared arity: a function
compiled from `(a, b) => a` must have `length === 2`, and every executor must
produce a callable with the recorded length. On `main`, two executors,
[amnesia](../../fjs/edag/amnesia/module.f.mjs) and
[memo](../../fjs/edag/memo/module.f.mjs), are FunctionalScript, they build a
host function per `=>` node, and no FunctionalScript expression can build such
a function with a positive length:

- The `=>` operation in [`operations`](../../fjs/edag/operations/module.f.mjs)
  builds `(...args) => invoke(frame, args, body)`, whose `length` is `0`.
- An arrow cannot recover the real argument count of a call, so no arrow
  wrapper is a fix. `(a0, ...rest) => f(a0, ...rest)` has length one, but
  turns `g()` into `f(undefined)`, which loses the distinction between an
  omitted argument and an explicit `undefined` that `['args']` keeps.
  `bind` only lowers a length.
- `.f.mjs` imports only `.f.mjs`
  ([fjs/AGENTS.md §3.5](../../fjs/AGENTS.md#35-functionalscript-module-rules)),
  so a host helper in a `.mjs` file is out of the evaluator's reach.

The count is a run-time value in the evaluator, since it comes from the node
being evaluated, and a constant in compiled source. Both need the same
primitive, and the language does not have one.

**Two open pull requests answer the same problem another way.**
[#2206](https://github.com/functionalscript/functionalscript/pull/2206)
removes the host function: a `=>` node evaluates to a closure record,
`{ mark, length, frame, body }`, called through the executor's exported
`call`, with `typeof` answered as `'function'`, property reads restricted to
`length`, a host method's callback position bridged through a `callbacks`
table in `fjs/js/prototype`, and `String(f)` refused until the graph's text
is rendered.
[#2200](https://github.com/functionalscript/functionalscript/pull/2200),
stacked on it, sets the record's `length` to the count and already carries
the count as an operand of `=>`, with `isCount` as the one predicate for it,
folding the parameter plan into the specification. On those branches the
executors build a positive-arity function value today, and the lowering
below is implemented. What they decide, and this proposal disagrees with, is
the value's representation: a record the executors interpret, which is the
first alternative below.

The need is already met once more, without a rule: `tupleRebuild` in
[`fjs/rtti/parse`](../../fjs/rtti/parse/module.f.mjs) configures a fresh array
with `Object.defineProperty` before returning it, and
[new-array-out-of-subset](../../todo/new-array-out-of-subset.md) records that
no document grants that exception. [Built-in](./2360-built-in.md) lists
`defineProperty` as `mutate`, prohibited.

### Alternatives considered

1. **Make functions special to the VMs**: a function is a record standing
   for a richer object the VM knows how to read. This is what #2206 does,
   and its cost is what this proposal was written against: the value is not
   a host function, so `typeof`, property reads, a call, an object spread, a
   host method that calls its argument, and string conversion each need an
   operation of the executor's, and every consumer calls through `call`.
   #2206 pays that cost deliberately and in full. The
   [decision](#the-decision-this-proposal-is-one-arm-of) below is between
   paying it and admitting the pattern.
2. **A capability supplied by the runner**, the way `import` became a named
   effect. It cannot be an effect per function: a `=>` node is evaluated
   inside expressions, often inside a call the host is already making, and
   nothing there can suspend. It can only be a value handed in once and
   threaded through every executor's context, which every runner then has to
   implement, and `.f.mjs` proofs could never observe `length`. Kept as the
   fallback if the language is not to grow and the record is not wanted.
3. **An admitted source pattern**, below. Pure FunctionalScript, JavaScript
   as written, provable in `proof.f.mjs`, a real host function as the value,
   and one primitive for the constant and the run-time case alike.

## Proposal

Admit one complete source pattern, recognized the way
[statement-aware intrinsics](../../fjs/fsc/parser/todo/statement-aware-intrinsics.md)
requires and the way [enumerable presence](./2345-has-own-property.md) plans
its `hasEntity`: the protected operation exists only inside the whole matched
pattern and nowhere else. Working name `withLength`; the source spells
exactly what it asks, with JavaScript's own names:

```js
/** @type {<F extends (...args: readonly unknown[]) => unknown>(length: number, f: F) => F} */
const withLength = (length, f) => {
    const r = (...args) => f(...args)
    Object.defineProperty(r, 'length', { value: length })
    return r
}
```

`withLength(n, f)` is a function that forwards its complete argument list to
`f` and whose `length` is `n`. The rest-and-spread forwarding is the point: it
is the one JavaScript spelling that keeps the argument list exact.

**What the matcher admits.** The whole definition, and nothing looser: a
parameter list of two names; a `const` bound to an arrow that spreads its
rest parameter into a call of the second parameter; one `defineProperty` on
that constant, key `'length'`, a descriptor that is exactly `{ value: <first
parameter> }`; `return` of the constant. `Object` must resolve to the
intrinsic, not a shadowing binding. A variation, another key, another
descriptor field, another statement between, any other use of the constant,
is not a partial match: it is refused like every `defineProperty` outside
the pattern, and that prohibition does not change.

The descriptor is `{ value: length }` and nothing more, by decision. An arrow
already owns a `length`, and `defineProperty` on an existing property keeps
every attribute the descriptor omits, so the result is a native function's
`length` in every attribute. Spelling `writable`, `enumerable` and
`configurable` would restate what the standard fixes and give the matcher
four more fields to check for no observable difference.

**Lowering.** The count is an operand of `=>`:

```js
['=>', count, frame, body]
```

The count and the frame are both evaluated when the function is *built*, in
the enclosing scope; only the body is deferred. Compiled source has a
constant there: `(a, b) => a` lowers to `['=>', 2, …]`, and an empty or
rest-only list to `['=>', 0, …]`. `withLength` itself lowers to a function
whose inner arrow's count is a read of the outer's first argument. Both are
one node meaning one thing, "this function's length is the value of this
operand": a constant operand participates in the graph's identity exactly as
metadata would, and the run-time case needs no second spelling. A separate
wrapper node, `['fn', count, f]`, was the alternative and would have been two
spellings of one length. #2200 implements exactly this node, so if it lands
first the lowering is not this proposal's work; this section then records why
the operand shape serves the pattern as well as the record, and the parameter
plan's "metadata, not an expression operand" is withdrawn by that landing
rather than by this one.

**The count's domain.** A count is a nonnegative integer below 2^32, `-0`
excluded. The upper bound is NaNVM's: `static_function` and the Rust
printer hold a function's length as a `u32`, and #2200 refuses a count past
it in the printer. This proposal makes that bound the language's, enforced
on every path where a count is made, the JavaScript executors included, so
a graph an executor accepts is one every executor accepts. Anything outside
the domain is refused when the function is built
([DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)),
never rounded, coerced or truncated. It is a bound chosen on purpose, so it
is part of the API and documented where the node is.

**Executors.** The `=>` operation in `operations` becomes the pattern applied
to what it builds on `main`: evaluate the count and the frame, then
`withLength(count, (...args) => invoke(frame, args, body))`. On a JavaScript
host the pattern runs as written and `defineProperty` does the work; a
FunctionalScript VM sees the pattern as its intrinsic. NaNVM and the Rust
printer in [`fjs/edag/rust`](../../fjs/edag/rust/module.f.mjs) have their own
function representation and store the arity in it; they never see a
`defineProperty`. [Analysis](../../fjs/edag/analysis/module.f.mjs) places the
count with the frame, in the enclosing scope, not in the body's. Under
#2206 the same operation builds the record instead, and this proposal, if
chosen, replaces the record with the pattern and the executor's `call` with a
plain call.

**Writer.** A function whose count is a constant and whose `['args']` reads
are all direct constant-index reads below that count renders as the named
parameter list the parameter plan describes, which is the boundary #2200's
writer enforces, and only up to a bound of the writer's own: a JavaScript
host refuses an arrow with tens of thousands of parameters (Node reports a
malformed parameter list), so the named rendering stops at a writer
constant chosen under every supported host's limit, and that constant is
documented where the writer is. Every other function renders as
`withLength(<count>, (...args) => …)`, with the helper emitted once per
module: a count that is not a constant, a constant count past the writer's
bound, and a constant count whose graph uses `['args']` in a way a named
list cannot spell, such as `['=>', 2, frame, ['.', ['args'], 'length']]`,
which the named rendering would pad from zero arguments to two. The pattern
builds no parameter list, so it renders any count in the domain. That
second rendering is the source form
[arity-complete-arguments](./arity-complete-arguments.md) asks for, and it
is only with both renderings that nothing an executor accepts is
unrenderable.

**`toString` is not in this proposal.** An own `toString` is the same shape
of need, and on a JavaScript host the same idiom carries it, but the
function-text decisions in
[serialization](./serialization.md#function-text-and-serialization) are still
open, and a NaNVM derives text from the EDAG rather than from a property. When
those close, a second admitted key in the same pattern is the natural
extension, with the key's meaning defined per executor. #2206 refuses
`String(f)` for a record for the same reason, so neither arm renders text
yet.

### The decision this proposal is one arm of

If #2206 and #2200 land, the count operand, the schema, the analysis, the
Rust printer and the writer's named-parameter boundary are done, and what
remains open is one question: **what a `=>` node evaluates to in the
JavaScript executors.**

| | closure record (#2206) | host function through the pattern |
|---|---|---|
| language | unchanged | one admitted pattern containing a `defineProperty` |
| the value | a record the executors interpret | a real function |
| `typeof`, reads, calls, spread, coercion | each an operation of the executor's | the host's |
| a host method calling its argument | bridged at the positions `callbacks` lists | native |
| consumers | call through the executor's `call` | call natively |
| `String(f)` | refused until rendered | refused until rendered, by a second key here |
| what the executors are | interpreters of a closed value | builders of host functions from a graph |

The record keeps the language closed and puts the cost in the executors;
the pattern opens the language by one spelling and takes the cost out of
them. Both are coherent. The one who decides is the language designer, and
the approval this proposal waits on is that decision. Until it is taken,
neither this document nor those pull requests should be built on as settled.

### Benefits

- One primitive serves the compiler's constant and the evaluator's run-time
  count; nothing outside the pattern, the node and the writer has to know.
- The evaluator and its proofs stay in `.f.mjs`, and a proof asserts
  `f.length` directly on a real function.
- The source is JavaScript with JavaScript's names, and it computes the same
  result on a host as under a VM for every admitted input
  ([DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)).
- A wrapped function's arguments reach the wrapped one exactly; omitted and
  explicit `undefined` stay distinct.

### Drawbacks

- The language admits a spelling that contains a mutation. The freshness
  argument, that `r` is configured before anything else can see it, is what
  makes it pure, and it holds only because the matcher admits the whole
  pattern and no variation. That is one more matcher in AST-to-EDAG
  compilation and one more paragraph in the specification.
- `=>` grows a third operand. That is a break of the stable EDAG format,
  planned by the parameter proposal and carried out by #2200; the old
  two-operand nodes must not be read as the new shape.
- The writer has two renderings of one node, chosen by whether the count is
  a constant under the writer's bound and the arguments are used the way a
  named list spells.
- The count's domain is a documented limit. A count of 2^32 or more is a
  valid nonnegative integer that no executor accepts, and a host running the
  pattern's source directly would accept it.
- Under an interpreter, a positive-arity function is one call frame deeper on
  a JavaScript host. Compiled source rendered by the writer has no wrapper.
- A count outside the domain is refused by a VM and accepted by a JavaScript
  host running the source directly, where `length` simply takes the value.
  That is the refusal-versus-host divergence every refused input has;
  whether the pattern's text should carry a guard, and how a host then
  reports it, is a task below.

## Tasks

- [ ] Record the approving language designer and a direct link to their
  explicit approval of the pattern, and their decision between the pattern
  and #2206's record for the JavaScript executors' function value.
- [ ] Whichever lands first corrects the other's document: this proposal
  withdraws the parameter plan's "metadata, not an expression operand", or
  #2200's function section of the [specification](../README.md#functions)
  gains the pattern's rendering.
- [ ] Decide whether the pattern's text carries a domain guard, and what a
  host reports for a count outside it.
- [ ] The count operand, its schema and types, analysis scoping the count
  with the frame, and the Rust printer's arity: from #2200 if it lands,
  otherwise as that pull request has them, with the `u32` bound enforced by
  the JavaScript executors as well as the printer.
- [ ] `operations`' `=>` built through the pattern, replacing #2206's record
  if that is the decision; amnesia and memo unchanged except for the
  operand, and their `call` a plain call.
- [ ] Compiler: recognize the complete pattern in AST-to-EDAG compilation,
  after its syntax, including named parameters, can be represented;
  `Object` resolved to the intrinsic; every variation refused.
- [ ] Writer: named parameters within #2200's boundary and under a
  documented bound below every supported host's parameter-list limit, the
  pattern for every other function, the helper emitted once.
- [ ] Proofs: `f.length` for constant and run-time counts, including unused
  parameters and functions passed through other functions; `g()` sees an
  empty `['args']` and `g(undefined)` sees `[undefined]`; a count outside the
  domain refused, 2^32 and `-0` included; a shadowed `Object` refused; each
  variation of the pattern refused; comparison with native JavaScript.
- [ ] Documents: the node table in [`fjs/edag/README.md`](../../fjs/edag/README.md),
  subject 7 of
  [edag-stage1-discussion](../../todo/edag-stage1-discussion.md#7-top-level-shape-of-a-function),
  the `.length` sentence in
  [execution-models](../../fjs/edag/execution-models.md), and the function
  section of the [specification](../README.md#functions).

## Related

- [#2206](https://github.com/functionalscript/functionalscript/pull/2206) —
  the closure record: the first alternative above, implemented.
- [#2200](https://github.com/functionalscript/functionalscript/pull/2200) —
  named parameters with the count as an operand of `=>`: the lowering
  above, implemented, and the parameter plan folded into the specification.
- [Parameters](./3120-parameters.md) — owns the syntax and the writer
  boundary until #2200 folds it in; this proposal supplies a primitive its
  executors can use.
- [Serialize arity and complete arguments](./arity-complete-arguments.md) —
  the pattern's rendering is the source form it asks for; whether that
  closes the issue is for it to decide.
- [Enumerable presence](./2345-has-own-property.md) — the precedent: a
  protected operation admitted only inside one complete pattern.
- [Statement-aware intrinsics](../../fjs/fsc/parser/todo/statement-aware-intrinsics.md)
  — how a pattern is recognized.
- [Built-in](./2360-built-in.md) — `defineProperty` stays `mutate` and
  prohibited outside the pattern.
- [Serialization](./serialization.md#function-text-and-serialization) — the
  open `toString` questions this proposal waits on before admitting a second
  key.
- [new-array-out-of-subset](../../todo/new-array-out-of-subset.md) —
  `tupleRebuild`'s ungranted exception; this proposal admits one pattern and
  does not legalize that one.
- [Amnesia](../../fjs/edag/amnesia/README.md) and
  [memo](../../fjs/edag/memo/module.f.mjs) — the FunctionalScript executors
  that build a length-0 host function on `main`.
