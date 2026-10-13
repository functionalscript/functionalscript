## Write a tail self-call as a loop

**Priority:** P2
**Status:** wip — the recognizer, the function text and the source
spelling with its grammar are implemented, the grammar awaiting the
approval its proposal records; the Rust output is open

### Problem

Both serializers spell a function that calls itself as recursion. The
code-only JavaScript text
([`fjs/compiler/serializer/function_text`](../../compiler/serializer/function_text/module.f.mjs))
spells it as a named function expression, and the Rust output
([`fjs/edag/rust`](../rust/module.f.mjs)) as `Any::call` of `self_`. V8 —
Node, Chromium, Deno, Bun on it — implements no tail calls, and neither does
Rust, so a function that iterates by calling itself last overflows the stack
after some thousands of rounds in either output.

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
recursion.

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
FunctionalScript as the source writer's is; the Rust output, when its turn
comes, as `let mut` and `while`. Each keeps the
recursion for the same shapes, which no loop written as `let`/`while`
produces:

- a root assert, a `const` before the `while` running every round;
- a condition reaching a value shared with the block, which a `const`
  before the `while` would establish once, and which the function text
  would have to establish before the `while` tests it;
- a read of the rest array: each round of the recursion is a call of one
  argument, so from the second round on the array is empty
  ([spec: parameters](../../../spec/README.md#parameters)), and a loop
  that kept the first call's array would answer differently where that
  array had members;
- a next value that throws, a spread, or a second argument.

A `for(;;)` with `continue`, which could run a root assert or a shared
condition's cell before the condition each round, was considered and
dropped: it is a second spelling for graphs the front end never produces,
and the recursion is still correct for them.

The template is recognized in the analysis table
([`fjs/edag/analysis`](../analysis/module.f.mjs)) by one exported function in
a new `fjs/edag/loop` module, which both serializers import: the template's
parts for a function entry that matches, and `null` for any other function.
Anything else stays the recursion it is today, the author's own.

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

**The Rust output** writes the loop as `let mut r = init; while
COND.to_boolean() { … }` into the enclosing closure's body where the
function is called in place — the function is then no `static_function`
at all, and nothing could observe one, the program never holding it — and
as that `while` inside its own closure where the function is held as a
value; the temporaries a round binds are declared inside the loop.

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

- [x] `fjs/edag/loop`: recognize the template, with the refusals proven:
      another length, `self` read anywhere else, a call in the alternative,
      a shared `?:` or call, a comma whose last operand is not the call.
- [x] `fjs/compiler/serializer/function_text`: the loop form; a host proof
      runs a million rounds, which the named function expression could not,
      and the shapes above keep the recursion.
- [x] `fjs/edag/function-text.md` and the function-source paragraph of
      `spec/README.md`: a body reading its `self` renders as a named
      function expression unless it is a loop, which renders as the loop.
- [ ] `fjs/edag/rust`: the `while` form, in place and in a closure, and a
      `cargo test` over a generated module running a million rounds.
- [x] `fjs/compiler/serializer`: the `let`/`while` spelling in call context,
      a rest-reading function left as recursion, with the grammar
      ([spec: loops](../../../spec/README.md#loops)), proven by the round
      trip — landing once the grammar's proposal is approved.

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
