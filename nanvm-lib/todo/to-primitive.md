## to-primitive. Converting an object or a function: stock behavior, refusal, then own methods

**Priority:** P1
**Status:** open — Stages 1 and 2 are done; Stage 3, a function's text, is planned below and awaits the owner's decisions

### Problem

Every conversion the VM makes, `ToString`, `ToNumber`, `ToNumeric` and the
`+` and relational operators, goes through one function,
`PrimitiveCoercionOp` in `vm/primitive_coercion.rs`
(`Any::to_primitive`). Before Stage 1 it answered an object or a function
without looking at what JavaScript looks at. Stage 1 made each of these a
`TypeError`, and Stages 2 and 3 answer them:

| input | JavaScript | NaNVM before Stage 1 | since Stage 1 | since Stage 2 |
|---|---|---|---|---|
| `String({ toString: () => "b" })` | `"b"` | `"[object Object]"` | `TypeError` | `"b"` |
| `+{ valueOf: () => 1 }` | `1` | `NaN` | `TypeError` | `1` |
| `[0, 1].slice({ valueOf: () => 1 })` | `[1]` | `[0, 1]` | `TypeError` | `[1]` |
| `String(() => 1)` | `"() => 1"` | `"function"` | `TypeError` | `TypeError` |
| `(() => 1) + "!"` | `"() => 1!"` | `"function!"` | `TypeError` | `TypeError` |

Stage 1 also made one exception to the single entry: a function's
`ToNumber` is `NaN` for any text, so `NumberCoercion`, `Any::to_numeric` and
the relational operators answer it without asking `PrimitiveCoercionOp` for
a text it cannot give.

Those were plausible wrong values, which
[DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
forbids. The gap predates the `Array` and `String` member functions. Those
functions made it reachable from many more calls: `join`'s separator and
elements, every string-method argument, and every numeric position or count.
Review of that stack kept finding it. Two of its pull requests left a
`// TODO:` for it, which reaches here through the `ToPrimitive` task of
`member-functions.md`: `array_join` in `vm/lambda/method.rs` (#2321) and the
searches in `vm/string/search.rs` (#2328).

### What already works: the stock methods

When neither the object nor anything else overrides a method, JavaScript's
`OrdinaryToPrimitive` calls the built-in `valueOf` and `toString`, in the
order the hint sets. That part is already right:

| stock behavior | JavaScript | NaNVM |
|---|---|---|
| `Object.prototype.valueOf` answers the object, not a primitive, so the next method runs | ✔ | ✔ `VALUE_OF`'s stock answer is `None` |
| `Object.prototype.toString` answers `"[object Object]"` | ✔ | ✔ `TO_STRING`'s stock answer |
| `Array.prototype.toString` is `join(",")` | ✔ | ✔ `arr_to_string`, through `Array::join` |
| the `number` hint tries `valueOf` first, `string` tries `toString` first, no hint means `number` | ✔ | ✔ `obj_to_primitive` |
| `Function.prototype.toString` answers the function's text | ✔ | ❌ refused since Stage 1 (it was the placeholder `"function"`); the text is Stage 3 |

A plain object, `{ a: 1 }`, converts exactly as in JavaScript, and so does
an array whose elements do: an array converts through `join`, so an element
with its own `toString`, or a function element, carries its gap into the
array's text. FunctionalScript has no symbols, so `Symbol.toPrimitive` and
`Symbol.toStringTag` cannot be reached and are out of scope.

### Where an override can come from

Only an object can own a `toString` or a `valueOf`. The compiler restricts
only the `__proto__` key, so `{ toString: f }` and `{ valueOf: f }` compile.
An array owns only its elements and `length`, and a function owns only its
`length` (`vm/lambda/member.rs`). A value is never mutated, so neither can
gain one later. An own property shadows the built-in, as it already does for
an explicit call: `{ toString: f }.toString()` calls `f` today (`Member`).
Only the implicit conversion is missing, and Stage 1 refuses it.

A function's text is a different problem: it is the stock method itself that
is missing. Its contract is already decided, the EDAG default rendering in
[`spec/todo/serialization.md`](../../spec/todo/serialization.md#function-text-and-serialization)
and
[`spec/todo/3120-parameters.md`](../../spec/todo/3120-parameters.md#default-function-text-render-or-refuse),
and `member-functions.md` tracks it. This issue does not restate that
contract. It only decides what a conversion does until that text exists.

### Stage 1: refuse what cannot be answered

The object rule is one change in `primitive_coercion.rs`, which every caller
inherits. The function rule also needs the callers that can answer without
the text: `ToNumber`, `ToNumeric` and the relational operators, below.

**An object with an own `toString` is refused, and so is one with an own
`valueOf` that is a function, wherever the hint reaches it.** Stage 2
replaced this refusal by the call. The refusal was a `TypeError` that names
the cause, whichever caller asked. A plain object is unchanged. The rule is
exactly the inputs the VM answered wrongly before it, and no others:

- An own `toString` or `valueOf` that is a function is called by JavaScript,
  when the hint reaches it. Stage 1 cannot call it yet, so it refuses rather
  than answer `"[object Object]"`.
- The `string` hint tries `toString` first, and the stock one answers
  `"[object Object]"`, so it never reaches `valueOf`: `String({ valueOf: f })`
  is `"[object Object]"` in JavaScript and in the VM, and is not refused. The
  `number` hint, and no hint, try `valueOf` first: `+{ valueOf: f }` is
  refused.
- An own `toString` that is not a function is skipped. The stock `valueOf`
  then answers the object, and JavaScript throws a `TypeError` for both hints:
  `String({ toString: "h" })`. The refusal matches this exactly.
- An own `valueOf` that is not a function is skipped too, and then the stock
  `toString` answers: `String({ valueOf: "x" })` is `"[object Object]"` and
  `+{ valueOf: "x" }` is `NaN`. The VM already answers that, because it never
  looks at `valueOf`, so it is not refused: refusing it would be a
  regression.

**A function is refused wherever its text would be observable, and nowhere
else.** Some results do not depend on the text at all, and the corpus
already pins them against the host, so they must not become refusals, which
would be a regression:

| operation on a function `f` | JavaScript | Stage 1 |
|---|---|---|
| `ToNumber` and `ToNumeric`: `+f`, `-f`, `f * 1`, `f - 1`, numeric arguments | `NaN`, for any text | `NaN`, unchanged (the `function` cases of unary `+` and `-`, `*`, `/`, `**`, binary `-` and `%`) |
| `~f` and the other integer operators | `-1`, from `NaN` | unchanged (the `~` case) |
| `f < 5`, where the other side is not a string after `ToPrimitive` | `false`, from `NaN` | unchanged (the `<`, `<=`, `>`, `>=` cases) |
| `f < "z"`, where the other side is a string | compares the text | **refused** |
| `ToString`: `String(f)`, `join`, string-method arguments | the text | **refused** |
| `ToString` whose result the algorithm discards: `[].join(f)`, `[1].join(f)`, `"a".split(f, 0)` | the text is computed, never read | answered, unchanged: `""`, `"1"`, `[]` |
| `f + x`, which uses the default hint | the text, concatenated | **refused** |
| `typeof f`, `!f`, `f ?? x`, `f \|\| x` | no conversion | unchanged |

The line between the last two `ToString` rows is whether the algorithm reads
the text. Where it reads it, Stage 1 refuses, even when every text would give
the same answer: `"".includes(f)` is `false` and `"".split(f)` is `[""]` for
any non-empty text. So is a function inside an array: it is converted through
the array's text, a string, so `+[f]` is refused, although `NaN` would be
exact. Telling those apart needs reasoning about every possible text, so they
stay refused until Stage 3 gives the text itself.

No function's text converts to a number: it starts with `(`, `function`,
`async` or a name. So `NaN` is exact for every text, and the numeric path can
answer it without the text. The cleanest split is probably a `ToNumber` of a
function that answers `NaN` directly, instead of converting a text that does
not exist. The relational operators then refuse only when the other side's
primitive is a string. The implementation chooses the mechanism; the table
above is the contract.

**Tests.** Rust unit tests beside the coercion, one per row of each list
above: the refused inputs throw a `TypeError`, and the unchanged ones keep
their value. They also check that a refusal is a throw, not a wrong answer,
through the built-ins that reach it: `join` (separator and element), a string
search, `slice`'s position, and the `+` and `<` operators.

Where the host answers an **object** case and the VM refuses it, the case
also joins the shared corpus with a `rust` reason naming Stage 2. The host
still pins JavaScript's value, and Stage 2 turns the case on by deleting the
reason. A **function** case does not join the corpus: the host's text of a
function is not the oracle, the EDAG-rendering contract is
(`member-functions.md`), and Stage 2 does not give a function a text anyway.
Its refusals are pinned by the Rust unit tests alone, and Stage 3 adds its
cases against the renderer.

Stage 1 also made a check possible that no test could make before: conversion
can throw, so `toSorted`'s guard (`vm/array/to_sorted.rs`, which leaves
fewer than two defined elements unconverted) becomes observable.
`[x, undefined].toSorted()` answers, and `[x, x].toSorted()` throws, where
`x` owns a `toString`. The guard's test lands with Stage 1, and so do the
two `// TODO:`s above, replaced with a pointer to Stage 2. Stage 2 keeps the
test, with a `toString` that throws, and points both at Stage 3 alone.

**Changelog.** A behavior change of `nanvm-lib`: conversions that answered a
wrong value now throw a `TypeError`. It is not a break of `fjs`'s API.

### Stage 2: an object's own methods (done)

`obj_to_primitive` follows
[`OrdinaryToPrimitive`](https://tc39.es/ecma262/#sec-ordinarytoprimitive)
in full:

1. The hint picks the order: `valueOf` then `toString` for `number` and for no
   hint, and `toString` then `valueOf` for `string`.
2. For each name, the own property if there is one (`Object::own_property`,
   the lookup `Member` uses), else the stock method.
3. A method that is not a function is skipped, as JavaScript skips it.
4. A function is called with no arguments, through `Function::call`. The
   receiver is not passed: no FunctionalScript function reads `this`, which
   is already why `Member`'s call does not pass it.
5. A throw propagates unchanged.
6. A primitive result is the answer. An object result moves on to the next
   method.
7. If neither method answers a primitive, the result is a `TypeError`.

Stage 2 removes Stage 1's refusal for objects, and deletes the `rust`
reasons of those cases. The host-only cases in `fjs/nanvm/proof.f.mjs`
(`toStringMethod`, `toStringThrows`, `toStringNotAFunction`,
`toStringNotPrimitive`) move into the shared corpus, since both sides then
agree. To write them there, the corpus gains `returns(v)`, a function value
that answers `v`, beside `functionValue`; `returns(unreached)` throws when
called. The unit tests are in `vm/primitive_coercion.rs`, one per step
above, and the corpus covers each step for `String`, unary `+` and `-`,
binary `+` and `slice`'s position.

The order of the two conversions becomes observable here, since a method
can throw. `>` and `<=` pass their operands to `is_less_than` swapped, and
before Stage 2 it converted its first argument first, so `a > b` converted
`b` first. ECMAScript's `LeftFirst` flag keeps the left operand first for
all four operators: with `a` and `b` whose `valueOf`s throw `"a"` and `"b"`,
each of `a < b`, `a > b`, `a <= b` and `a >= b` throws `"a"`. Stage 1 could
not show the order: the only throw a conversion made was
`OWN_CONVERSION_METHOD`, one value whichever side made it, and a function
side did not throw while it converted. Stage 2 converts both operands in
source order before `is_less_than` compares them. The unit test
`left_operand_first` pins that for every binary operator, the other twelve
having converted left first already. The array searches answer an empty
array before converting their position, which the corpus pins with a
`valueOf` that throws.

A method's result can itself be an object with its own methods. Step 6 does
not convert it; it moves on. So the conversion cannot recurse through its
results, and the only recursion is the user's own call.

### Stage 3: a function's text

This stage is the EDAG default rendering that the
[function-source exception](../../spec/README.md#function-source-representation-exception)
adopts. When it lands, the function rows of Stage 1 answer the text. The
refusals are deleted, with the unit tests that pin them, and the function
cases join the corpus with the renderer's text as their expected value.

#### What shapes the plan

- **A renderer mostly exists.** The FunctionalScript writer,
  [`fjs/compiler/serializer`](../../fjs/compiler/serializer/module.f.mjs),
  already wrote a function node as text: `['=>', 1, [], ['arg', 0]]` was
  `($a_0,...$a)=>$a_0` historically (now `($0)=>$0`, with an unused
  rest parameter omitted), and a shared
  array in a body became a `const`. It had two gaps. It had no spelling
  for operators or calls, so most real bodies were refused; steps 1 and 2
  closed that. And it writes a module, `export default …;`, where a
  function's text is one expression.
- **The Rust VM has no EDAG at run time.** A generated function is a code
  pointer, a `length` and a frame. The text must come from the one renderer,
  which is FunctionalScript, at compile time. A second renderer written in
  Rust would drift from it.
- **A captured primitive is already written into the body**
  ([spec: functions](../../spec/README.md#functions)). So
  `const x = 3; const f = () => x;` gives `f` an empty frame, and its text
  is the owner's preferred `() => 3` with no frame rendering at all. Only a
  literal primitive is inlined: every other captured node is a frame slot,
  and its run-time value can be anything. That includes arrays, objects,
  functions (an imported helper included), an enclosing function's
  parameters, and computed values such as `x` in
  `(...a) => { const x = a[0] + 1; return () => x; }`, which is a number.
- **`['self']` is reached as any value is.** A function that names itself
  is the compiler's `['self']` ([functions](../../spec/README.md#functions)),
  and Stage 5 of [callable-function-objects](./callable-function-objects.md)
  landed with it: the renderer spells the node as a named function
  expression, the one spelling of a function that reaches itself without a
  `const` ([function-text](../../fjs/edag/function-text.md)).
- **The JavaScript evaluators are not FJS VMs.** Amnesia and the operations
  layer convert a function with the host's wrapper text, so a function-text
  corpus case cannot be checked on the host side. They cannot carry the
  text either: a FunctionalScript function has no custom `toString` (step 6).

#### Design: a compile-time template with holes

The renderer turns a function node into an **expression template**: the
function's canonical text, in which every read of a frame slot is a hole.
The Rust printer passes the template to the function value as an
`Option<&'static str>`:

- `None` is a function that has no EDAG, a host or hand-written one. It
  keeps refusing with `FUNCTION_TEXT`: not every function has an EDAG
  ([associate-edag-with-functions](../../fjs/compiler/todo/associate-edag-with-functions.md)).
- The template belongs to the code, not to each function value. It is
  static data in the binary, so it allocates nothing, and no value retains
  its own complete source, as the
  [lazy frame rendering](../../spec/todo/serialization.md#conditional-requirement-lazy-frame-rendering)
  requirement asks.
- **An empty frame:** the template is the text. That holds under every
  answer to the open questions in
  [serialization](../../spec/todo/serialization.md#open-questions).
- **A non-empty frame:** only filling the holes depends on question 2, and
  D2 answers it code-only: a hole is a name, and `make(0)` and `make(1)`
  share one text, as they do in JavaScript. Instantiating the frame, not
  chosen, would have made a hole the rendered value, needing a run-time
  value renderer that keeps sharing, a function's frame rendered in place,
  and lazy text.

Hashing needs the EDAG itself, not its text, so this does not decide
[Stage 7](./callable-function-objects.md)'s embedded-or-lookup question.
The template is rendered from the same associated EDAG that choice will
keep.

#### Decisions

Each needs the owner's approval before the step that depends on it.

- **D1, the spelling (implemented as proposed).** One line, normalized, with the writer's
  leaves and one `$0`, `$1`, … counter for all generated bindings,
  including nested scopes. External frame slots take the first numbers. An expression, not a module. A
  rest parameter the body never reads is not written, so `() => 1` is
  `()=>1`, not `(...$0)=>1`. Both denote one node, and the shorter one is
  what a reader expects.
- **D2, the frame (question 2): code-only, approved by the owner,
  @sasha-gil, on 2026-09-30
  ([recorded on #2418](https://github.com/functionalscript/functionalscript/pull/2418)).** A captured value is written as the name of its slot, `$0`,
  `$1`, …, so `const make = x => () => [x];` gives every function it makes
  the text `()=>[$0]`, as JavaScript gives them one text. It is small, it
  matches JavaScript, and it needs no run-time renderer: the template has
  no holes left, so step 5 is step 4. Instantiating, the alternative, would
  replace each name with the rendered value, which would cost the run-time
  renderer, an IIFE to keep the text one expression, and lazy text; it
  would change no text of a function with an empty frame.
- **D3, `self` (question 3).** Landed. The renderer spells `['self']` as the
  name of a named function expression, `(function $0(){…})`, since an
  arrow function cannot name itself
  ([function-text](../../fjs/edag/function-text.md)); the compiler produces
  the node for a function that names itself
  ([functions](../../spec/README.md#functions)).
- **D4, a function without an EDAG.** Refused, as above.

#### Steps

1. **The writer spells operators** (done), precedence- and
   associativity-correct, grouping an operand only where the ladder needs
   it.
2. **The writer spells calls and chains** (done): `f(a)`, `a.b(c)`, and a
   callee that is an access through a `const`.
3. **`functionText` in FunctionalScript** (done): `tryFunctionText` in
   the writer, [`fjs/compiler/serializer`](../../fjs/compiler/serializer/module.f.mjs),
   a function node to its text, each slot named `$i` (D2). It is the
   writer itself, so the compiler's output and the Rust printer share one
   owner; the Rust printer, `fjs/edag/rust`, imports it, which makes no
   cycle, since the writer imports nothing of the printer. `['self']` is the
   named function expression's own name there, and the writer refuses any
   kind it cannot spell.
   Proofs: a text without a frame is the module text of the same node,
   which reads back to it.
4. **Rust, for an empty frame** (done). `static_function` takes the text,
   `Option<&'static str>`, and `IFunction::text` answers it. The printer
   emits the writer's text for every function node, `None` where the
   writer refuses the body, and the harness's `function_any()` is
   `()=>undefined`. `ToPrimitive` of a function answers its text, and
   refuses a function without one with `FUNCTION_TEXT`; `<` against a
   number or a bigint still answers without it. The corpus's function-text
   cases carry the writer's text as `expected` and a `host` marker that
   skips the JavaScript side, as `rust` skips the Rust side. They and
   `nanvm-harness/fixtures/function-text.mjs` cover every path in
   [member-functions](./member-functions.md)'s `Function` checklist except
   the property key: `f.toString()`, `String(f)`, `+`, a function in an
   array joined, a string method's argument, a returned, exported and
   nested function, and identity checks, where two functions with one text
   stay two identities under `===`. A function an export's consumer only
   calls is the harness's `Action::Call`, unchanged. `ToNumber` of a
   function stays `NaN` without its text, since that is exact for any text.
5. **Rust, for a frame** (done, with step 4): under D2's code-only answer
   the text is complete at compile time, so no run-time value renderer is
   needed.
6. **Follow-up issues** (settled): rendering in the FJS interpreter is
   ruled out, and so is refusing there
   ([function-text.md](../../fjs/edag/function-text.md)). A FunctionalScript
   function cannot be given a custom `toString`, since a `Proxy` is not a
   FunctionalScript object and setting the property is mutation. The
   JavaScript-hosted evaluators answer the host's text, so the corpus's
   `host` marker stays. The property-key conversion needs no issue of its
   own (below). A `const` only a lazy operand reaches, which
   the writer refused at first, is now the operand's own block, an IIFE the
   front end inlines. The corpus's
   `() => undefined` is now the node a compiled one is (a function's slots
   are a list since #2395), so the Rust printer writes both as
   `function_any()`, whose text is `()=>undefined`.

The signature change in step 4 touches every hand-written function in the
tests. Bundling the code, the `length` and the text into one static
descriptor would be the cleaner API, but Rust has no generic `static`, so
that needs a spike first.

### Related, not covered here

A property key is not converted either. `Object::member_access` answers
`undefined` for a key that is neither a number nor a string, where
JavaScript converts it with `ToPropertyKey`: `o[{}]` reads `o["[object
Object]"]`. A module reaches it through the
[`entry`](../../spec/README.md#reading-an-entry-at-run-time) helper alone: a
key is otherwise a literal
([spec: property access](../../spec/README.md#property-access)), and the
helper names its key conversion, `entry(o, f)` included, as its own work.

### Tasks

- [x] Stage 1: refuse an object with an own `toString`, or a function
      `valueOf` the hint reaches, and a function wherever its text is
      observable, keeping every text-independent result. Unit tests per row,
      and corpus cases with a `rust` reason.
- [x] The member functions that convert: the `// TODO:`s in `array_join`
      and `vm/string/search.rs` replaced with a pointer to Stage 2, tests
      that `join` and the searches refuse, a corpus case for a needle with
      its own `toString`, and the `toSorted` guard's test.
- [x] Stage 2: call an object's own `toString` and `valueOf` per
      `OrdinaryToPrimitive`. Move the host-only cases into the corpus.
- [ ] Stage 3 decisions: approve D1. D2's code-only answer is approved.
- [x] Stage 3 steps 1 and 2: the writer spells operators and calls.
- [x] Stage 3 step 3: `functionText`, the function's text with its slots
      named.
- [x] Stage 3 step 4: Rust answers the text of a function with an empty
      frame (tracked with the `Function` checklist in `member-functions.md`).
- [x] Stage 3 step 5: a function with a frame, per D2 (code-only).
- [x] Stage 3 step 6: settle the FJS-interpreter rendering issue:
      [function-text.md](../../fjs/edag/function-text.md) records why the
      evaluator answers the host's text.
- [x] Place the property-key conversion: it is
      [`entry`](../../spec/README.md#reading-an-entry-at-run-time)'s key conversion.
