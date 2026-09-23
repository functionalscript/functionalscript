# Function length pattern

**Priority:** P2
**Status:** open — a new language feature, so it waits on formal approval by
the language designer named in
[DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo)
before anything below is implemented.

## Problem

[Parameters](./3120-parameters.md) preserves declared arity: a function
compiled from `(a, b) => a` must have `length === 2`, and every executor must
produce a callable with the recorded length. Two executors,
[amnesia](../../fjs/edag/amnesia/module.f.mjs) and
[memo](../../fjs/edag/memo/module.f.mjs), are FunctionalScript, and no
FunctionalScript expression can build such a callable:

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

The need is already met once, without a rule: `tupleRebuild` in
[`fjs/rtti/parse`](../../fjs/rtti/parse/module.f.mjs) configures a fresh array
with `Object.defineProperty` before returning it, and
[new-array-out-of-subset](../../todo/new-array-out-of-subset.md) records that
no document grants that exception. [Built-in](./2360-built-in.md) lists
`defineProperty` as `mutate`, prohibited.

### Alternatives considered

1. **Make functions special to the VMs**: a function is a thunk standing for a
   richer object the VM knows how to read. Rejected: the result is not a real
   function, so `typeof`, `===` and a plain call all need the VM's cooperation,
   and an executed EDAG stops being interchangeable with a compiled module.
2. **A capability supplied by the runner**, the way `import` became a named
   effect. It cannot be an effect per function: a `=>` node is evaluated
   inside expressions, often inside a call the host is already making, and
   nothing there can suspend. It can only be a value handed in once and
   threaded through every executor's context, which every runner then has to
   implement, and `.f.mjs` proofs could never observe `length`. Kept as the
   fallback if the language is not to grow.
3. **An admitted source pattern**, below. Pure FunctionalScript, JavaScript
   as written, provable in `proof.f.mjs`, and one primitive for the constant
   and the run-time case alike.

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

**Lowering.** The pattern is what makes the count an operand of `=>`:

```js
['=>', count, frame, body]
```

The count and the frame are both evaluated when the function is *built*, in
the enclosing scope; only the body is deferred. The count must be a
nonnegative integer, and anything else is refused at that moment
([DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)),
never rounded or coerced. Compiled source has a constant there:
`(a, b) => a` lowers to `['=>', 2, …]`, and an empty or rest-only list to
`['=>', 0, …]`. `withLength` itself lowers to a function whose inner arrow's
count is a read of the outer's first argument. Both are one node meaning one
thing, "this function's length is the value of this operand", which is why
this proposal supersedes the parameter plan's "metadata, not an expression
operand": a constant operand participates in the graph's identity exactly as
metadata would, and the run-time case needs no second spelling. A separate
wrapper node, `['fn', count, f]`, was the alternative and would have been two
spellings of one length.

**Executors.** The `=>` operation in `operations` becomes the pattern applied
to what it builds today: evaluate the count and the frame, then
`withLength(count, (...args) => invoke(frame, args, body))`. On a JavaScript
host the pattern runs as written and `defineProperty` does the work; a
FunctionalScript VM sees the pattern as its intrinsic. NaNVM and the Rust
printer in [`fjs/edag/rust`](../../fjs/edag/rust/module.f.mjs) have their own
function representation and store the arity in it; they never see a
`defineProperty`. [Analysis](../../fjs/edag/analysis/module.f.mjs) places the
count with the frame, in the enclosing scope, not in the body's.

**Writer.** A constant count renders as the named parameter list the
parameter plan describes, with that plan's writer boundary unchanged. Any
other count renders as `withLength(<count>, (...args) => …)`, with the helper
emitted once per module. Nothing an executor accepts is unrenderable.

**`toString` is not in this proposal.** An own `toString` is the same shape
of need, and on a JavaScript host the same idiom carries it, but the
function-text decisions in
[serialization](./serialization.md#function-text-and-serialization) are still
open, and a NaNVM derives text from the EDAG rather than from a property. When
those close, a second admitted key in the same pattern is the natural
extension, with the key's meaning defined per executor.

### Benefits

- One primitive serves the compiler's constant and the evaluator's run-time
  count; nothing outside the pattern, the node and the writer has to know.
- The evaluator and its proofs stay in `.f.mjs`, and a proof asserts
  `f.length` directly.
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
  already planned by the parameter proposal; this merges the two breaks into
  one, and three-operand nodes from before must not be read as the new shape.
- The writer has two renderings of one node, chosen by whether the count is a
  constant.
- Under an interpreter, a positive-arity function is one call frame deeper on
  a JavaScript host. Compiled source rendered by the writer has no wrapper.
- A count that is not a nonnegative integer is refused by a VM and accepted
  by a JavaScript host running the source directly, where `length` simply
  takes the value. That is the refusal-versus-host divergence every refused
  input has; whether the pattern's text should carry a guard, and how a host
  then reports it, is a task below.

## Tasks

- [ ] Record the approving language designer and a direct link to their
  explicit approval of the pattern and the `=>` operand.
- [ ] Amend [parameters](./3120-parameters.md): the count is an operand of
  `=>`, evaluated when the function is built, a constant in compiled
  source; withdraw "metadata, not an expression operand".
- [ ] Decide whether the pattern's text carries an integer guard, and what a
  host reports for a non-integer count.
- [ ] Schema and types: `['=>', count, frame, body]` in
  [`fjs/edag`](../../fjs/edag/module.f.mjs), `types.ts` pinned against it,
  validation proofs for the new shape and the refusal of the old one.
- [ ] `operations`' `=>` built through the pattern; amnesia and memo
  unchanged except for the operand; analysis scoping the count with the
  frame; the Rust printer and NaNVM storing the arity.
- [ ] Compiler: recognize the complete pattern in AST-to-EDAG compilation,
  after its syntax, including named parameters, can be represented;
  `Object` resolved to the intrinsic; every variation refused.
- [ ] Writer: named parameters for a constant count, the pattern otherwise,
  the helper emitted once.
- [ ] Proofs: `f.length` for constant and run-time counts, including unused
  parameters and functions passed through other functions; `g()` sees an
  empty `['args']` and `g(undefined)` sees `[undefined]`; a non-integer count
  refused; a shadowed `Object` refused; each variation of the pattern
  refused; comparison with native JavaScript.
- [ ] Documents: the node table in [`fjs/edag/README.md`](../../fjs/edag/README.md),
  subject 7 of
  [edag-stage1-discussion](../../todo/edag-stage1-discussion.md#7-top-level-shape-of-a-function),
  the `.length` sentence in
  [execution-models](../../fjs/edag/execution-models.md), and the function
  section of the [specification](../README.md#functions).

## Related

- [Parameters](./3120-parameters.md) — owns the syntax and the writer
  boundary; this proposal supplies the primitive its executors need.
- [Serialize arity and complete arguments](./arity-complete-arguments.md) —
  the pattern is one source form that preserves both; whether it answers that
  issue's writer question is for that issue to decide.
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
  that cannot build a positive-arity function today.
