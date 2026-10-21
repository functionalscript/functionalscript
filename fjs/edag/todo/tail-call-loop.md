## Write a tail self-call as a loop

**Priority:** P2
**Status:** wip — the recognizer, the function text, the Rust output and
the source spelling with its grammar are implemented, the grammar's
proposal approved; common FAST migration remains

The implemented writer behavior below records the current contracts. The
[FAST migration](#fast-migration) supersedes its writer ownership, including
permission for writer-specific recursion decisions; it does not change the
current implementation in this documentation-only proposal.

The [general loops and tail calls epic](../../todo/general-loops-and-tail-calls.md)
requires FAST and migration of existing consumers before broader behavior.
This file owns the output work: baseline migration in C and generalized
tail-call analysis in F. The implemented contracts below stay historical.

### Problem

Both serializers spell a function that calls itself as recursion. The
code-only JavaScript text
([`fjs/compiler/serializer/function_text`](../../compiler/serializer/function_text/module.f.mjs))
spells it as a named function expression, and the Rust output
([`fjs/edag/rust`](../rust/module.f.mjs)) as `Any::call` of `self_`. V8 —
Node, Chromium, Deno on it — implements no tail calls, and neither does
Rust, so a function that iterates by calling itself last overflows the stack
after some thousands of rounds in either output. JavaScriptCore, Bun's
engine, implements the proper tail calls ES2015 specifies, in strict code,
which a module is: the recursion runs in constant stack there alone, and a
program cannot count on one host of four.

A `const` whose function calls itself is the one way FunctionalScript
expresses a loop today, so every loop a program writes is affected. It is
also the shape a `while` lowers to
([stage 1 discussion §11](../../../todo/edag-stage1-discussion.md#11-let-loops-and-tail-calls)),
so the serializers must spell it as a loop before a `while` can land.

The EDAG interpreters are not affected: memo and amnesia make every call
in tail position in the invocation's place, under the general rule, whatever
the callee ([values.md](../values.md#operations-and-failures)). The template
below is the writers' concern, since their outputs run on hosts that
implement no tail calls.

### Implemented design

**One template.** The first implementation recognizes one shape of function,
the loop over one state value whose condition continues it:

```js
['=>', 1, FRAME, ['?:', COND, ['()', ['self'], [NEXT]], ['arg', 0]]]
```

which is `r => COND ? self(NEXT) : r`, the recursive spelling of
`while (COND) { r = NEXT; }`. `COND` and `NEXT` are any nodes over
`['arg', 0]` and the frame, and `self` is read nowhere but as that one
callee. Every node on the path — the `?:` and the call — is reached by one
edge: the writers spell the path as statements, and a shared node is written
once, as an expression, where no statement can stand.

A `const` the next value does not reach, an assert, lowers to a comma, so the
template admits one around the call, `[',', [...ASSERTS, CALL]]`, which is a
`const` inside the loop body, and one at the root, `[',', [...ASSERTS, TAIL]]`,
established before the condition each round. Without the first, the first
`const` written in a loop body would silently turn the loop back into
recursion. The two are divided between recognition and emission: the
recognizer reports both, the root's as the parts' `before`, so that the
parts say what the function is; every writer spells the body's and keeps
the recursion where `before` is not empty, since no loop written as
`let`/`while` runs a `const` before its condition every round — a writer
with a spelling for it would be the one to use the parts it already has.

**One spelling, or the recursion.** Every writer has two forms for a
function of the template and no third: the loop, spelled one way —

```js
while (COND) { ASSERTS; r = NEXT; }
```

the asserts as `const`s, the assignment omitted where the next value is the
variable itself — or the recursion the graph already is. The source writer
spells the loop as `let` and `while` where the function is called in
place; the function text as an arrow whose body is that same `let` and
`while`, the variable a `let` of the parameter, so that the text is
FunctionalScript as the source writer's is; the Rust output as the
function's closure whose body is Rust's `loop`. Each keeps the recursion
for the same shapes, which no loop written as `let`/`while` produces:

- a root assert, a `const` before the `while` running every round;
- a condition reaching a shared value — one the block reads too, or one
  the condition itself reads twice, `x === x` over a `const x = f()`:
  the recursion establishes it afresh per call, in the function text's
  memo cell, where a `const` before the `while` would establish it once,
  and a cell inside the body does not exist when the `while` tests the
  condition. The function text keeps the recursion for both, a shared
  value being a cell there whatever it holds. The source writer keeps
  it for one value only, a value it would name — a container, a
  function, a call, what a `const` establishes once — that the
  condition shares with the block; a shared read, `r[0]` in the
  condition and in the block, which the analysis table holds once, is
  written where each read stands, as it is written anywhere, and loops.
  A value the condition shares with itself is the `const` of a function
  called where written, the one way source spells a scope in expression
  position, and the writer writes the condition as that function again,
  as it writes any lazy operand holding such a `const`, so the value is
  established afresh at every test and the text reads back as the
  condition, a function called where written being admitted to read the
  variable. No `while` written in source produces the shape the source
  writer keeps the recursion for: a named value the condition shares
  with the block would be the `const` of a function called where
  written in both, two functions and two values.
  The Rust output loops for a condition sharing a value with itself as
  it prints any scope, by construction rather than by a second spelling:
  it has no cell, a value the condition reaches eagerly is a `let`
  inside the `loop` before the test, rebound each round, a lazy operand
  a thunk there, established only when the operation establishes it,
  and a value reached only through lazy operands is refused as it is
  anywhere, since a `let` would establish what the program may not — so
  `false && x` with `x` thrown reaches no `x`, in the loop as in the
  recursion. A value the condition shares with the arm keeps the
  recursion in Rust, as in every writer;
- a read of the rest array: each round of the recursion is a call of one
  argument, so from the second round on the array is empty
  ([spec: parameters](../../../spec/functions/parameters.md)), and a loop
  that kept the first call's array would answer differently where that
  array had members;
- a spread or a second argument as the next value. A next value that
  throws is no such shape: the grammar admits `r = (() => { throw 0; })();`,
  the lowering inlines the call, and every writer assigns the throw as it
  spells one in expression position — the source writer and the function
  text as that applied function, the Rust output as the `Err` the round's
  `?` returns — so the loop throws where the recursion threw;
- in the source writer alone, a function nested in the loop whose frame
  reads the variable, `r => typeof r === 'number' ? self(() => r) : r`:
  the recursion's closure holds the parameter of the call that made it,
  `loop(1)()` answering `1`, where a closure written inside a `while`
  holds the binding, the variable's last value — the capture the language
  proposal refuses in source, a function held as a value rather than
  called where written ([spec: let](../../../spec/todo/3220-let.md),
  refusals), so the spelling would read back as nothing. The function
  text captures by value, through the applied wrapper every nested
  function's frame is written as, `(($2)=>()=>$2)($1)`, and the Rust
  output's frame is a value, so both loop; the source writer, whose
  nested function captures by name, keeps the `const` the call reads. A
  computed slot, `() => r + 1`, is a `const` of the block in every
  writer, and loops.

A `for(;;)` with `continue`, which could run a root assert or a shared
condition's cell before the condition each round, was considered and
dropped: it is a second spelling for graphs the front end never produces,
and the recursion is still correct for them.

The template is one rule, this document's, recognized by one function:
`loopOf` in `fjs/edag/loop`, over the analysis table
([`fjs/edag/analysis`](../analysis/module.f.mjs)) — the template's parts
for a function entry that matches, and `null` for any other function. The
function text and the source writer ask it of the table they write from;
the Rust writer, which walks the graph by node identity and never builds
a table of the module, builds the table of the one function it asks
about, and reads the parts off the graph node once the table says it is
a loop. The shapes every writer keeps the recursion for, above, are the
second function of the same module, `keepsRecursion`, asked beside the
first: a root assert, a rest read, and a value minting identity — a
container, a function, a call, what the table's `mergeable` refuses to
merge — that the condition shares with the block. A shared read the
condition and the block repeat, `r[0]`, merges in the table, one value
however many times it is evaluated, and loops. So the writers agree on
every function: a shape kept in one is kept in all, and a writer keeps
the recursion for more only for a reason of its own spelling, said at
its own decision. Anything else stays the recursion it is today, the
author's own.

**The function text** writes a matching function as an arrow whose body is
the language's loop: a `let` of the parameter, the `while`, and the
`return` of the variable — the text the source writer writes for the same
loop called in place, and FunctionalScript where no memo cell stands in it.
The invocation memo cells are declared inside the loop's body, so each
round starts fresh as each call did; the `self` name is gone, since no read
of it survives:

```js
($0)=>{let $1=$0;while(COND){$1=NEXT;}return $1;}
```

That text is program-visible: `String(f)`, `f.toString()` and every
conversion that reaches the default function representation answer with
it, in the EDAG interpreters and in the Rust VM alike
([spec: function source](../../../spec/principles/README.md#function-source-representation-exception)).
Today the same function answers with a named function expression, which
the specification and the function-text contract promise for a body
reading its `self`. The loop changes that answer for every function of the
template, and the two documents change with it: a body reading its `self`
renders as a named function expression unless it is a loop, which renders
as the loop above. No program can tell the two texts apart by anything but
the text itself, which the exception already makes the VM's to choose.

**The Rust output** writes a matching function called where it is
written — the one place reaching it, with one argument — as the loop
where the call stands: the call's temporary bound to the argument, `let
mut cN = INIT;`, then Rust's `loop` — the condition's temporaries, `if
!COND.to_boolean() { break }`, the round's temporaries, the asserts among
them discarded, and `cN = NEXT;`, omitted where the next value is the
variable — the call's value the variable after it. No closure is built
and no call made, the function being a value nowhere; its slots are
temporaries of the scope around, bound once as a frame is built once. A
matching function held as a value is the closure it is,
`A::static_function`, whose body is the same loop over `let mut r` bound
to the first argument, and `Ok(r)`. A `loop` with the test at its top
rather than a `while`, since a `while` cannot hold the condition's
temporaries, which every round must rebind. A rest read
keeps the recursion as in every writer: the closure binds the rest array
once per call, and a loop would keep the first call's. Which function is
a loop, and which keeps the recursion, the Rust writer asks of the one
recognizer as the other writers do, over the table of the function it
builds for the question; a merged read the condition and the block
repeat is rebound each round, the same value either way.

**The source** spells the template as `let` and `while` only in one context,
the function called where it is written with one argument and referenced
from nowhere else:

```js
['()', LOOP, [INIT]]   →   let r = INIT; while (COND) { …; r = NEXT; }
```

and `r` is a `const` after the loop, the call's value. The context excludes
the root comma: a `const` before `while` runs once, where a root assert runs
every round. A loop function in any other position keeps the
`const loop = …` spelling, which round-trips today. This half waits on the
grammar: `let`, `while` and the assignment are a language feature, and
[`spec/todo/3220-let.md`](../../../spec/todo/3220-let.md) is their
proposal under
[DESIGN.md §12](../../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
— the syntax, the lowering to this template, the benefits and the
drawbacks, and the approval, recorded there. The round trip of a `while` —
source to EDAG to source to the same EDAG — is its proof.

**Later.** The epic extends the template through the shared FAST pipeline.
The [general analysis](#general-tail-calls) below owns that work; source
admission and [loop construction](./fast-loop-construction.md) have separate owners.

### FAST migration

Milestone C follows the architecture's FAST model and input migration.
Move `loopOf`, `keepsRecursion`, binding placement and eligible immediate-call
elimination into `fjs/edag/to_fast`. Common
[FAST preparation](../../todo/compiler-vocabulary-and-modularization.md#fast-contract)
establishes invocation values, captures, slots and memo lifetimes.
Serializers render its decisions without inspecting EDAG.

Preserve the existing recognized cases before broadening them:

- An eliminated immediate call establishes arguments and captures once at
  its execution point; a function used as a value retains its boundary and arity.
- A closure retains the creating invocation's value. For
  `r => typeof r === 'number' ? self(() => r) : r`, `loop(1)()` remains `1`.
- Condition/body bindings and lazy function-text memo cells keep their
  per-invocation evaluation regions and lifetimes.
- Keep current root-assert, rest-read and identity-sharing restrictions until
  the common representation handles the corresponding cases. Preserve every
  already stack-safe case, including Rust and function text.
- Preserve admitted source syntax, existing exact-graph cases and the explicit
  [function-text contract](../function-text.md). Any intended text change is
  recorded with its proofs.

Migrate consumers in small complete increments and retire their replaced
paths with them. All required consumers use common placement/preparation
before the epic's foundation gate C closes. Generalized recognition is then
implemented here, never first added to an old writer.

### Tasks

These tasks retain the implemented history and complete baseline migration C.
Broader milestone F work follows under [general tail calls](#general-tail-calls).

- [x] `fjs/edag/loop`: recognize the template, with the refusals proven:
      another length, `self` read anywhere else, a call in the alternative,
      a shared `?:` or call, a comma whose last operand is not the call.
- [x] `fjs/compiler/serializer/function_text`: the loop form; a host proof
      runs a million rounds, which the named function expression could not,
      and the shapes above keep the recursion.
- [x] `fjs/edag/function-text.md` and the function-source paragraph of
      `spec/principles/README.md`: a body reading its `self` renders as a named
      function expression unless it is a loop, which renders as the loop.
- [x] `fjs/edag/rust`: the loop form as the closure's body, and a
      `cargo test` over a generated module running a million rounds
      (`nanvm/harness/tests/while_loop.rs`).
- [x] `fjs/edag/rust`: the loop in place where the function is called
      where it is written, no closure built for it.
- [x] `fjs/edag/loop`: `keepsRecursion`, the shapes every writer keeps the
      recursion for, asked by every writer; the Rust writer asks `loopOf`
      of the function's own table rather than recognize the template on
      the graph again.
- [x] `fjs/compiler/serializer`: the `let`/`while` spelling in call context,
      a rest-reading function left as recursion, with the grammar
      ([spec: loops](../../../spec/control-flow/loops.md)), its proposal
      approved, proven by the round trip.
- [ ] Move the implemented loop decisions and eligible call elimination to
      common EDAG-to-FAST conversion, with the capture and region rules above.
      Migrate consumers incrementally once the shared path preserves their
      contracts; retire each replaced graph-aware path with its consumer and
      update JSDoc/specification ownership. The completed migration has one policy.
- [ ] Carry over the million-round, source-round-trip, closure-capture,
      shared-condition, lazy-failure, rest-read and root-assert cases. Verify
      the common FAST decision across JS and Rust, function text's invocation
      lifetimes, and the existing stack-safe cases before removing old paths.

### General tail calls

Milestone F follows canonical short-circuit removal and general loop
construction (epic D/E). It consumes their stable conditional and loop
contracts. Integrate candidate traversal with shared-value placement and
evaluation regions.

| Tail-position form | Candidate traversal |
| --- | --- |
| Direct call of this invocation's resolved self | Consider this call evaluation. |
| `A ? B : C` | Visit B and C, not A. |
| Sequence/comma | Visit its last operand, retaining earlier required evaluations. |
| Other expressions | These rules establish no candidate. |

Short-circuit operators have already become conditionals. Do not cross into
nested function bodies or identify self by printed names.

Tail position belongs to a call's evaluation/use, not globally to its graph
node. A return reading an established result is not a new call:

```js
const r = f(n - 1);
return r === 0 ? r : 1;
```

The condition requires that call first; reading `r` cannot become a loop
transition. Calls whose results feed conditions, arguments or arithmetic
remain ordinary where further work consumes them. Preserve prior eager
anchors and lazy sharing.

For each eligible direct self-call, produce a normalized FAST loop transition.
Other self calls/references may remain, with function identity preserved;
only eliminated paths gain constant stack use. Match the graph-construction
owner's [canonical root-loop contract](./fast-loop-construction.md#canonical-root-loops)
so conversion back does not add helpers or wrappers.

Common output preparation must retain a complete invocation:

- Establish every argument and spread under the current invocation before
  any state writes. `return f(b, a)` requires simultaneous next values,
  not sequential `a = b; b = a`.
- Preserve required evaluation/failures of unused extra arguments; missing
  arguments become `undefined`. Rebuild rest arrays with fresh identity.
- Run default/destructuring setup each invocation represented by an iteration,
  preserving the [parameter/arity contract](../../../spec/functions/parameters.md).
- Preserve iteration values in captures and recreate local shared objects,
  functions and memo storage at their original lifetimes.

For `f = (n, saved) => n === 0 ? saved : f(n - 1, () => n)`,
`f(2, null)()` must remain `1`.

Build the general conversions against normalized FAST/EDAG fixtures first.
The source serializer's broader loop spelling is enabled with the corresponding
source grammar in epic H. There is one implementation of conversion and
preparation; connecting the source feature later does not rewrite it.

#### General analysis tasks

- [ ] After D/E, implement eligibility on placed evaluations. Cover either/both
      conditional arms, sequences, the established-result example, lazy shared
      calls, nested functions and mixed tail/non-tail self uses.
- [ ] Produce the canonical invocation loop and common prepared output. Cover
      swapped/dependent values, missing/extra/failing arguments, spreads, rest,
      defaults/destructuring, arity and self identity.
- [ ] Carry capture snapshots and per-invocation memo/object/function lifetimes
      through all consumers; no backend-specific eligibility or placement.
- [ ] Verify EDAG -> normalized FAST -> EDAG for the declared graph domain,
      including stable repeated conversion and one-time setup.
- [ ] Prove generalized tail-only cases and repeated nested generated loops
      stack-safe in shared JS/Rust output. Lexical nesting may add stack depth;
      iteration count must not. Ordinary non-tail user recursion stays ordinary.
- [ ] Connect newly admitted source spellings in H with end-to-end source
      round-trip and execution proofs, using this same shared path.

### Related

- [General loops and tail calls](../../todo/general-loops-and-tail-calls.md)
  — FAST-first prerequisites and ordered integration gates.
- [FAST loop construction](./fast-loop-construction.md)
  — explicit normalized loop inputs/results and root-loop identity rules.
- [Short-circuit conditionals](./short-circuit-conditionals.md)
  — reduce canonical tail analysis to conditional and sequence forms.
- [Compiler vocabulary and modularization](../../todo/compiler-vocabulary-and-modularization.md)
  — the common conversion owns loop lowering in the MVP.
- [stage 1 discussion §11](../../../todo/edag-stage1-discussion.md#11-let-loops-and-tail-calls)
  — why a loop is a tail call and not a node.
- [spec: let](../../../spec/todo/3220-let.md) — the grammar half, a
  language proposal of its own.
- [spec: function source](../../../spec/principles/README.md#function-source-representation-exception)
  — the contract the function text changes under.
- [`function-text.md`](../function-text.md) — the text contract the
  JavaScript form lives under.
- [stack-safety](./stack-safety.md) — the writers' own recursion, a separate
  concern from the program's.
