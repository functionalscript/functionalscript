## to-primitive. Converting an object or a function: stock behavior, refusal, then own methods

**Priority:** P1
**Status:** open — conversion through Stage 3 is implemented; D1's formal approval and the remaining native function-key corpus coverage are tracked below

### Problem

Object conversion for `ToString`, `ToNumber`, `ToNumeric`, `+` and the
relational operators goes through `PrimitiveCoercionOp` in
`vm/primitive_coercion.rs` (`Any::to_primitive`). Before Stage 1 it answered
an object or a function without looking at what JavaScript looks at.
Stage 1 refused the unsupported conversions; Stage 2 implemented own object
methods, and Stage 3 supplies a function's canonical, EDAG-derived text:

| input | JavaScript | NaNVM before Stage 1 | Stage 1 | Stage 2 | current, Stage 3 |
|---|---|---|---|---|---|
| `String({ toString: () => "b" })` | `"b"` | `"[object Object]"` | `TypeError` | `"b"` | `"b"` |
| `+{ valueOf: () => 1 }` | `1` | `NaN` | `TypeError` | `1` | `1` |
| `[0, 1].slice({ valueOf: () => 1 })` | `[1]` | `[0, 1]` | `TypeError` | `[1]` | `[1]` |
| `String(() => 1)` | `"() => 1"` | `"function"` | `TypeError` | `TypeError` | `"()=>1"` |
| `(() => 1) + "!"` | `"() => 1!"` | `"function!"` | `TypeError` | `TypeError` | `"()=>1!"` |

The current function rows describe compiled functions with associated text.
Their spelling follows the
[function-source exception](../../spec/README.md#function-source-representation-exception),
rather than the host's source spelling. A native function with no associated
text still refuses a conversion that needs it; it does not need to retain the
semantic EDAG to carry text.

Stage 1 also made one exception to the single entry: a function's
`ToNumber` is `NaN` for any text, so `NumberCoercion`, `Any::to_numeric` and
the relational operators can answer text-independent cases without asking
`PrimitiveCoercionOp` for text. This remains true when associated text is
absent: numeric conversion gives `NaN`, and relational comparison against a
non-string primitive gives `false`.

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
| `Function.prototype.toString` answers the function's text | ✔ | ✔ associated EDAG-derived text; `error::function_text` when text is absent |

A plain object, `{ a: 1 }`, converts exactly as in JavaScript, and so does
an array whose elements do: an array converts through `join`, calling an
object element's own conversion methods and using a function element's text.
A native function element without text still refuses when that text is read.
FunctionalScript has no symbols, so `Symbol.toPrimitive` and
`Symbol.toStringTag` cannot be reached and are out of scope.

### Where an override can come from

Only an object can own a `toString` or a `valueOf`. The compiler restricts
only the `__proto__` key, so `{ toString: f }` and `{ valueOf: f }` compile.
An array owns only its elements and `length`, and a function owns only its
`length` (`vm/lambda/member.rs`). A value is never mutated, so neither can
gain one later. An own property shadows the built-in, as it already does for
an explicit call: `{ toString: f }.toString()` calls `f` (`Member`). Stage 2
also calls it during implicit conversion, in the order the hint selects.

A function's text uses the stock method and the shared EDAG default rendering in
[`spec/todo/serialization.md`](../../spec/todo/serialization.md#function-text-and-serialization)
and
[`spec/todo/3120-parameters.md`](../../spec/todo/3120-parameters.md#default-function-text-render-or-refuse),
and `member-functions.md` tracks its remaining corpus coverage. Native
functions store the compiler-rendered text; represented Amnesia and memo
functions use the same renderer during conversion. This issue records the
staged implementation and the refusal boundary when native text is absent.

### Stage 1: refuse what cannot be answered

This section preserves Stage 1's historical design and proofs. Stage 2
replaced the own-method refusals with calls, and Stage 3 replaced function
refusals wherever text is available. The text-independent paths and refusal
of text-needed conversions without associated text remain current.

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
can throw. `>` and `<=` passed their operands to `is_less_than` swapped, and
before Stage 2 it converted its first argument first, so `a > b` converted
`b` first. ECMAScript's `LeftFirst` flag keeps the left operand first for
all four operators: with `a` and `b` whose `valueOf`s throw `"a"` and `"b"`,
each of `a < b`, `a > b`, `a <= b` and `a >= b` throws `"a"`. Stage 1 could
not show the order: the only throw a conversion made was
`OWN_CONVERSION_METHOD`, one value whichever side made it, and a function
side did not throw while it converted. Stage 2 converts both operands in
source order before they are compared. The unit test
`left_operand_first` pins that for every binary operator, the other twelve
having converted left first already. The array searches answer an empty
array before converting their position, which the corpus pins with a
`valueOf` that throws.

A method's result can itself be an object with its own methods. Step 6 does
not convert it; it moves on. So the conversion cannot recurse through its
results, and the only recursion is the user's own call.

### Stage 3: a function's text

This stage implements the EDAG default rendering that the
[function-source exception](../../spec/README.md#function-source-representation-exception)
adopts. Native functions with associated text answer the function rows of
Stage 1, and represented Amnesia and memo functions render their retained
bodies. The corpus uses canonical text as its expected value. Refusal tests
remain for native functions without associated text, alongside tests that
their numeric and non-string relational results remain available.

#### What shapes the plan

- **The shared renderer is implemented.** The FunctionalScript writer,
  [`fjs/compiler/serializer`](../../fjs/compiler/serializer/module.f.mjs),
  already wrote a function node as text: `['=>', 1, [], ['arg', 0]]` was
  `($a_0,...$a)=>$a_0` historically (now `($0)=>$0`, with an unused
  rest parameter omitted), and a shared array in a body became a `const`.
  Historically it had no spelling for operators or calls; steps 1 and 2
  closed that gap. The current `functionText` renders every admitted body
  as one expression. Where the partial FJS source serializer cannot
  reconstruct a body, function text uses general JavaScript with local lazy
  memo cells ([function-text](../../fjs/edag/function-text.md)). It does not
  promise a FJS source round trip.
- **The Rust VM has no EDAG at run time.** A generated function is a code
  pointer, a `length`, a frame and optional static text. The text comes from
  the one renderer, which is FunctionalScript, at compile time. A second
  renderer written in Rust would drift from it.
- **A captured primitive is already written into the body**
  ([spec: functions](../../spec/README.md#functions)). So
  `const x = 3; const f = () => x;` gives `f` an empty frame, and its text
  is `()=>3` with no frame rendering at all. A primitive known during
  lowering is inlined; other captured nodes are frame slots, and each slot's
  run-time value can be anything. That includes arrays, objects,
  functions (an imported helper included), an enclosing function's
  parameters, and computed values such as `x` in
  `(...a) => { const x = a[0] + 1; return () => x; }`, which is a number.
- **`['self']` is reached as any value is.** A function that names itself
  is the compiler's `['self']` ([functions](../../spec/README.md#functions)),
  and Stage 5 of [callable-function-objects](./callable-function-objects.md)
  landed with it: the renderer spells the node as a named function
  expression, the one spelling of a function that reaches itself without a
  `const` ([function-text](../../fjs/edag/function-text.md)).
- **Represented interpreters share the renderer.** Amnesia and memo retain
  function bodies and captures as `EdagValue`s. Their shared conversion
  renders canonical text without creating or modifying a host callable.
  The independent JavaScript reference and ordinary runtime callables
  produced across a boundary that erases EDAG reflection keep the host-text
  exception (step 6).

#### Design: a compile-time template with holes

The original plan described an **expression template** whose frame-slot
reads were holes. D2 selected code-only text: slot names fill those holes at
compile time, so the stored template is already the complete canonical text.
The Rust printer passes it to the function value as an `Option<&'static str>`:

- `None` means that no text is associated with the function. Text-needed
  conversion refuses with `error::function_text`; numeric conversion and
  non-string relational comparison do not need text. A hand-written
  function can supply `Some(text)` without retaining its semantic EDAG.
- The template belongs to the code, not to each function value. It is
  static data in the binary, shared by every value from that code, without
  a per-value text allocation. This does not implement or require the
  [lazy frame rendering](../../spec/todo/serialization.md#conditional-requirement-lazy-frame-rendering)
  requirement, which applies if a future profile renders captured values.
- **An empty frame:** the template is the text.
- **A non-empty frame:** a slot is its generated name, and `make(0)` and
  `make(1)` share one text, as they do in JavaScript. Instantiating the
  frame, not chosen for default text, would instead need a run-time value
  renderer that keeps sharing, a function's frame rendered in place, and
  lazy text. That remains a separate serialization-profile question.

Hashing needs the EDAG itself, not its text, so this does not decide
[Stage 7](./callable-function-objects.md)'s embedded-or-lookup question.
The compiler already has the graph needed to render the template; retaining
semantic EDAG metadata at run time is separate work and is not a prerequisite
for this text.

#### Decisions

These record the decisions behind the implemented text. D1's formal approval
is still tracked below; its proposed spelling is already implemented.

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
- **D4, a function without associated text.** Refused where text is needed,
  as above. This is independent of retaining a full semantic EDAG; numeric
  and non-string relational results remain available without text.

#### Steps

1. **The writer spells operators** (done), precedence- and
   associativity-correct, grouping an operand only where the ladder needs
   it.
2. **The writer spells calls and chains** (done): `f(a)`, `a.b(c)`, and a
   callee that is an access through a `const`.
3. **`functionText` in FunctionalScript** (done): the trusted, analyzed
   function entry in [`fjs/compiler/serializer`](../../fjs/compiler/serializer/module.f.mjs)
   renders every admitted body, each slot named `$i` (D2). Its checked
   `tryFunctionText` entry returns admission diagnostics for separately
   supplied expressions. Represented conversion and the Rust printer,
   `fjs/edag/rust`, share this renderer. `['self']` is the named function
   expression's own name there. The FJS source serializer remains partial;
   function text falls back to general JavaScript when source reconstruction
   is unavailable. The source-reconstructible cases retain the original
   module-text/read-back proofs; the
   [function-text proofs](../../fjs/compiler/serializer/function_text/proof.f.mjs)
   cover the general rendering, which is not a FJS source round trip.
4. **Rust, for an empty frame** (done). `static_function` takes the text,
   `Option<&'static str>`, and `IFunction::text` answers it. The printer
   emits the shared renderer's text for admitted function nodes; its
   checked entry produces `None` on an admission failure. Hand-written
   functions may also pass `None`, while the harness's `function_any()` is
   `()=>undefined`. `ToPrimitive` of a function answers its text, and
   refuses a function without one with `error::function_text`; `<` against a
   number or a bigint still answers without it. The corpus's function-text
   cases carry the writer's text as `expected` and a `host` marker that
   skips only the independent JavaScript reference, as `rust` skips the
   Rust side; represented Amnesia and memo check canonical text. They and
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
6. **Follow-up issues** (settled): Amnesia and memo now render represented
   functions through shared conversion
   ([function-text.md](../../fjs/edag/function-text.md)). Historically,
   changing their host wrappers with a `Proxy` or a custom `toString` was
   rejected: a `Proxy` is not a FunctionalScript object and setting the
   property is mutation. Retaining represented code removes the need for
   those changes. The corpus's `host` marker stays for the independent
   JavaScript reference, whose host callables have host-defined text; the
   same exception applies after runtime compilation erases EDAG reflection.
   The property-key conversion is implemented in `entry`, with native
   function-key corpus coverage remaining below. A `const` only a lazy
   operand reaches, which the writer refused at first, is now the operand's
   own block, an IIFE the front end inlines. The corpus's
   `() => undefined` is now the node a compiled one is (a function's slots
   are a list since #2395), so the Rust printer writes both as
   `function_any()`, whose text is `()=>undefined`.

The signature change in step 4 touches every hand-written function in the
tests. Bundling the code, the `length` and the text into one static
descriptor would be the cleaner API, but Rust has no generic `static`, so
that needs a spike first.

### Related, not covered here

General property-key conversion is implemented by `Any::entry`, through the
[`entry`](../../spec/README.md#reading-an-entry-at-run-time) helper.
`Object::member_access` receives only a string or number under its EDAG
contract; it is not the general conversion boundary. `entry` checks for a
nullish receiver before converting its key with `ToString` (FunctionalScript
has no symbols), then reads an enumerable own entry. An object key invokes
its own conversion methods. A function key uses associated canonical text,
or refuses if text is needed and absent. Native function-key corpus proofs
remain tracked by [member-functions](./member-functions.md); the conversion
itself is implemented. Direct
[property access](../../spec/README.md#property-access) has its own restricted
key syntax.

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
      [function-text.md](../../fjs/edag/function-text.md) records canonical
      represented conversion and the separate host-callable exception.
- [x] Place the property-key conversion: it is
      [`entry`](../../spec/README.md#reading-an-entry-at-run-time)'s key conversion.
- [ ] Finish native function-key corpus coverage in
      [member-functions](./member-functions.md)'s `Function` checklist.
