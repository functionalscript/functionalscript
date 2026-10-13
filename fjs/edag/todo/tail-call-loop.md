## Write a tail self-call as a loop

**Priority:** P2
**Status:** wip

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

### Proposal

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
  condition — unless the function would read the variable, which the
  language reads as a capture and refuses, when the recursion, which
  reads back as itself, is kept. No `while` written in source produces
  the shapes the source writer keeps the recursion for: a named value
  the condition shares with the block would be the `const` of a
  function called where written in both, two functions and two values.
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
  ([spec: parameters](../../../spec/README.md#parameters)), and a loop
  that kept the first call's array would answer differently where that
  array had members;
- a next value that throws, a spread, or a second argument;
- in the source writer alone, a function nested in the loop whose frame
  reads the variable, `r => typeof r === 'number' ? self(() => r) : r`:
  the recursion's closure holds the parameter of the call that made it,
  `loop(1)()` answering `1`, where a closure written inside a `while`
  holds the binding, the variable's last value — the capture the language
  proposal refuses in source ([spec: let](../../../spec/todo/3220-let.md),
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

The template is one rule, this document's, recognized over two walks.
In the analysis table ([`fjs/edag/analysis`](../analysis/module.f.mjs)) by
one exported function in a new `fjs/edag/loop` module, which the function
text and the source writer import: the template's parts for a function
entry that matches, and `null` for any other function. On the graph by the
Rust writer, which never builds the table and walks the graph by node
identity, as it decides everything: it reads the same parts off the
function node, under the same rules, and consumes nothing from the table's
recognizer, since the table's indices name nothing in its walk. The two
agree on every function the front end produces, except where what is
shared differs — the Rust paragraph below says how. Anything else stays
the recursion it is today, the author's own.

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
([spec: function source](../../../spec/README.md#function-source-representation-exception)).
Today the same function answers with a named function expression, which
the specification and the function-text contract promise for a body
reading its `self`. The loop changes that answer for every function of the
template, and the two documents change with it: a body reading its `self`
renders as a named function expression unless it is a loop, which renders
as the loop above. No program can tell the two texts apart by anything but
the text itself, which the exception already makes the VM's to choose.

**The Rust output** writes a matching function as the closure it is,
`A::static_function`, whose body is the loop: `let mut r` bound to the
first argument, Rust's `loop` — the condition's temporaries, `if
!COND.to_boolean() { break }`, the round's temporaries, the asserts among
them discarded, and `r = NEXT;`, omitted where the next value is the
variable — and `Ok(r)`. A `loop` with the test at its top rather than a
`while`, since a `while` cannot hold the condition's temporaries, which
every round must rebind; a closure whether the function is called in
place or held as a value, one form rather than two, the call of a closure
costing one frame where the recursion cost one per round. A rest read
keeps the recursion as in every writer: the closure binds the rest array
once per call, and a loop would keep the first call's. Which function is
a loop the Rust writer decides on the graph it walks, where sharing is
identity: the function text and the source writer decide on the analysis
table, where two reads of one property are one shared node, so a function
the table shows a condition sharing with its block may still loop in Rust,
the two reads rebound each round — the same value either way.

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
drawbacks, and the approval it waits on; the source task below lands only
once that approval is recorded there. The round trip of a `while` — source
to EDAG to source to the same EDAG — is its proof.

**Later.** The template is a strict subset of the general rule, under which
a function is a loop whenever every reference to `self` is the callee of a
call in tail position — the body root, an arm of a `?:` there, the last
operand of a `,` there — whatever the number of state values, the arm the
call stands in, or the number of exits. Widening to it changes no spelling
written for the template, so it is a later step, taken with the grammar for
`break` that the swapped arm needs.

### Tasks

- [ ] `fjs/edag/loop`: recognize the template, with the refusals proven:
      another length, `self` read anywhere else, a call in the alternative,
      a shared `?:` or call, a comma whose last operand is not the call.
- [ ] `fjs/compiler/serializer/function_text`: the loop form; a host proof
      runs a million rounds, which the named function expression could not,
      and the shapes above keep the recursion.
- [ ] `fjs/edag/function-text.md` and the function-source paragraph of
      `spec/README.md`: a body reading its `self` renders as a named
      function expression unless it is a loop, which renders as the loop.
- [ ] `fjs/edag/rust`: the loop form as the closure's body, and a
      `cargo test` over a generated module running a million rounds.
- [ ] `fjs/compiler/serializer`: the `let`/`while` spelling in call context,
      a rest-reading function left as recursion, once the grammar's
      proposal is approved and lands, proven by the round trip.

### Related

- [stage 1 discussion §11](../../../todo/edag-stage1-discussion.md#11-let-loops-and-tail-calls)
  — why a loop is a tail call and not a node.
- [spec: let](../../../spec/todo/3220-let.md) — the grammar half, a
  language proposal of its own.
- [spec: function source](../../../spec/README.md#function-source-representation-exception)
  — the contract the function text changes under.
- [`function-text.md`](../function-text.md) — the text contract the
  JavaScript form lives under.
- [stack-safety](./stack-safety.md) — the writers' own recursion, a separate
  concern from the program's.
