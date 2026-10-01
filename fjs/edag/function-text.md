# A function's text in the FunctionalScript evaluator

**We refuse this for now** ([DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
The evaluator in [`operations`](./operations/module.f.mjs) refuses the
conversions it performs itself when they would read a function's text. It
does not answer them with a wrong value. This is a mitigation, not the fix.
The fix is tracked in
[amnesia/todo/function-text.md](./amnesia/todo/function-text.md).

## What a function's text has to be

FunctionalScript fixes a function's default text: it is the EDAG-derived
rendering of the function's code
([function-source exception](../../spec/README.md#function-source-representation-exception)).
Under D2, captured values are written as slot names
([to-primitive, Stage 3](../../nanvm-lib/todo/to-primitive.md#stage-3-a-functions-text)).
So `x => x * 2` is `x=>x*2`, and `() => undefined` is `()=>undefined`.
`nanvm-lib` answers exactly that. The FunctionalScript writer renders the
text at compile time (`tryFunctionText` in
[`fjs/compiler/serializer`](../compiler/serializer/module.f.mjs)), and the
Rust VM keeps it beside the function (`IStaticFunction::static_function`).

## What the JavaScript-hosted evaluator answers

This evaluator runs on a JavaScript host. Its `=>` operation does not make a
function out of the EDAG. It makes a host closure with
`callable(length, body)` from
[`fjs/types/function/length`](../types/function/length/module.f.mjs). That
closure is one of seventeen fixed wrappers, one per parameter count, and
each wrapper hands its arguments back to the evaluator:

```js
g => (a0, ...rest) => g([a0], rest)
```

The host answers a function's text from the function's own source, and the
source of every evaluator function is its wrapper's. Before this change, on
`main`:

| FunctionalScript                | the evaluator answered               | the language requires |
| ------------------------------- | ------------------------------------ | --------------------- |
| `String(x => x * 2)`            | `'(a0, ...rest) => g([a0], rest)'`   | `'x=>x*2'`            |
| `String(x => x + 1)`            | `'(a0, ...rest) => g([a0], rest)'`   | `'x=>x+1'`            |
| `(x => x * 2) + '!'`            | `'(a0, ...rest) => g([a0], rest)!'`  | `'x=>x*2!'`           |
| `(x => x * 2) < (x => x + 1)`   | `false`                              | `true`                |

That is the worst kind of failure. It is not an error. It is a plausible
string, and it is the same for every function of one length, so two
different functions look equal. Nothing tells the program that the text is
fake. The parameter plan already names it:
[a wrong successful result](../../spec/todo/3120-parameters.md#default-function-text-render-or-refuse).
The rule there is to render or refuse.

## Why the evaluator cannot render it

The host asks the function itself for its text, so the function would have
to carry the right text. A host closure carries its own source and nothing
else. Every way to change that has been ruled out by the language design
([#2418](https://github.com/functionalscript/functionalscript/pull/2418)):

- **A `Proxy`** around the closure could answer `toString` with the
  rendered text. A `Proxy` is not a FunctionalScript object, so the
  evaluator's values cannot be one. #2418 built this and it was reverted.
- **Setting `toString`** on the closure with `Object.defineProperty` is
  property mutation, which FunctionalScript does not have.
- **A thin `.mjs` adapter** that does either of the above cannot be reached.
  A FunctionalScript module (`.f.mjs`, `.f.js`) cannot import a JavaScript
  one (`.mjs`, `.js`).

So, as long as this evaluator's functions are host closures, nothing in it
can make the host answer the right text.

## Who converts: the evaluator or the host

A function becomes text in one of two places, and the difference decides
what refusing can reach.

**The evaluator's own operations.** Some EDAG nodes run a conversion in the
operation table: the `String` node, binary `+`, and the relational
operators `<`, `<=`, `>` and `>=`. The operation sees its operands before
it converts them, so it can see a function and refuse.

**The host's conversions.** Everything else converts inside host code that
the evaluator only calls:

- `String([f])`, or `[f] + ''`. The operand is an array, and the host's
  `join` converts the function inside it.
- An admitted host method that is handed a function, such as
  `['a', f].join()` or `'x'.startsWith(f)`.
- A comparison or `+` with an object or array that holds a function.

These never pass through an evaluator node with the function as an operand,
so the evaluator never sees them. They still answer the wrapper's text.

## The options

1. **Refuse** where the evaluator converts a function itself. Those
   conversions throw instead of answering the wrapper's text.
2. **Leave as is.** Keep the wrong value, documented in the todo. The
   corpus's `host` marker keeps the function-text cases on the Rust side.
3. **Functions as data.** Redesign the evaluator so that a function value
   carries its EDAG and frame, and the evaluator calls it and renders its
   text itself. This is large. It also changes what a function is to host
   code: a value handed to a host method or returned to a JavaScript caller
   would no longer be callable there, which breaks supported calls,
   callbacks and exports.

## Why Refuse, for now

- **It is the rule.** [DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
  says a case the code cannot handle is refused, never approximated, and
  [3120-parameters](../../spec/todo/3120-parameters.md#default-function-text-render-or-refuse)
  says a default-text conversion that cannot render must fail rather than
  return wrapper text. Leaving it as is keeps a wrong value on purpose.
- **It loses no right answer.** Every conversion it refuses used to answer
  the wrapper's text, which was never correct. A comparison whose result
  does not depend on the text stays answered (below), and so does every
  call, return, export and `length`.
- **It is small and local.** It adds three checks to the operation table and
  changes no data format, corpus case or public API. Removing it later is
  just as small.
- **It makes the gap loud where it can.** A program that reaches a refused
  conversion learns at once that the evaluator cannot answer it. The
  failure points at this document, not at a wrong string found much later.
- **It leaves the fix open.** It chooses nothing about how the text will be
  carried, so any later mechanism replaces it without having to undo a
  design.

Functions as data might give the right text everywhere. It is a redesign
with costs of its own (above), and nothing here should wait on it.

## The exact rule

| operation                 | refused when                                                         | answered otherwise |
| ------------------------- | -------------------------------------------------------------------- | ------------------ |
| `String(a)`               | `a` is a function                                                    | as the host does   |
| `a + b` (binary)          | `a` or `b` is a function                                             | as the host does   |
| `a < b`, `<=`, `>`, `>=`  | one operand is a function and the other, made primitive, is a string | as the host does   |

A relational operator compares as strings only when both operands, made
primitive, are strings ([spec](../../spec/README.md)), and a function made
primitive is its text. The other operand is made primitive as the operator
makes it: a string stays one, a function is its text, an array is its
elements joined, and an object is what its own `valueOf` answers, or failing
that its own `toString`, or `"[object Object]"` with neither. Against
anything that is not then a string, such as a number, `null` or an object
whose `valueOf` answers `0`, a function becomes `NaN`, and the result is
`false` whatever its text. So `f < 5` and `f < { valueOf: () => 0 }` stay
answered as `false`.

Unary `+` and `Number` of a function are `NaN` for any text, so they stay
answered too. A function's text is never numeric.

The refusal is an assert in the operation, so it throws:
`function text: the evaluator refuses it, see fjs/edag/function-text.md`.
[`amnesia`'s proofs](./amnesia/proof.f.mjs) (`functionText`) pin every row
from both sides.

## What it does not do

- **It does not cover the host's conversions** listed above, which still
  answer the wrapper's text. 3120-parameters says that intercepting only
  the explicit `String` operation is not enough. This is a mitigation of
  the parts the evaluator can reach, not compliance.
- **It does not change Rust.** `nanvm-lib` renders the text, and the
  corpus's function-text cases keep their `host` marker
  ([`fjs/nanvm/types.ts`](../nanvm/types.ts)), so they run on the Rust
  side only.
- **It does not refuse a function as a property key.** A property name in
  the schema is a string, a number or a `Number` cast, never a function,
  and `own` already asserts a string key.
  [`entry`](./todo/entry.md) owns key conversion for code supplied as data.

## When this goes away

When the evaluator can answer a function's text legally, it renders the
text in these three operations and the refusal is removed. That needs a
function value that carries its EDAG, or a host boundary that can find the
EDAG from the value, without a `Proxy`, without mutation and without
importing JavaScript. Until then, this is the honest answer.
