## to-primitive. Converting an object or a function: stock behavior, refusal, then own methods

**Priority:** P1
**Status:** open

### Problem

Every conversion the VM makes, `ToString`, `ToNumber`, `ToNumeric` and the
`+` and relational operators, goes through one function,
`PrimitiveCoercionOp` in `vm/primitive_coercion.rs`
(`Any::to_primitive`). Before Stage 1 it answered an object or a function
without looking at what JavaScript looks at. Stage 1 made each of these a
`TypeError`, and Stages 2 and 3 answer them:

| input | JavaScript | NaNVM before Stage 1 | since Stage 1 |
|---|---|---|---|
| `String({ toString: () => "b" })` | `"b"` | `"[object Object]"` | `TypeError` |
| `+{ valueOf: () => 1 }` | `1` | `NaN` | `TypeError` |
| `[0, 1].slice({ valueOf: () => 1 })` | `[1]` | `[0, 1]` | `TypeError` |
| `String(() => 1)` | `"() => 1"` | `"function"` | `TypeError` |
| `(() => 1) + "!"` | `"() => 1!"` | `"function!"` | `TypeError` |

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
| `Object.prototype.valueOf` answers the object, not a primitive, so the next method runs | ✔ | ✔ `value_of` answers `None` |
| `Object.prototype.toString` answers `"[object Object]"` | ✔ | ✔ `obj_to_string` |
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

**An object with an own `toString`, or an own `valueOf` that is a function,
is refused.** The refusal is a `TypeError` that names the cause, whatever the
hint and whichever caller asked. A plain object is unchanged. The rule is
exactly the inputs the VM answered wrongly before it, and no others:

- An own `toString` or `valueOf` that is a function is called by JavaScript.
  Stage 1 cannot call it yet, so it refuses rather than answer
  `"[object Object]"`.
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
two `// TODO:`s above, replaced with a pointer to Stage 2.

**Changelog.** A behavior change of `nanvm-lib`: conversions that answered a
wrong value now throw a `TypeError`. It is not a break of `fjs`'s API.

### Stage 2: an object's own methods

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
agree.

The order of the two conversions becomes observable here, since a method
can throw. `>` and `<=` pass their operands to `is_less_than` swapped, and it
converts its first argument first, so today `a > b` converts `b` first.
ECMAScript's `LeftFirst` flag keeps the left operand first for all four
operators: with `a` and `b` whose `toString`s throw `"a"` and `"b"`, each of
`a < b`, `a > b`, `a <= b` and `a >= b` throws `"a"`. Stage 2 gives
`is_less_than` that flag, with a test per operator. Until then no test can
tell the orders apart, because every refusal is the same from either side.

A method's result can itself be an object with its own methods. Step 6 does
not convert it; it moves on. So the conversion cannot recurse through its
results, and the only recursion is the user's own call.

### Stage 3: a function's text

This stage is the EDAG default rendering, as specified in the documents
linked above. When it lands, the function rows of Stage 1 answer the text.
The refusals are deleted, with the unit tests that pin them, and the function
cases join the corpus with the renderer's text as their expected value.

### Related, not covered here

A property key is not converted either. `Object::member_access` answers
`undefined` for a key that is neither a number nor a string, where
JavaScript converts it with `ToPropertyKey`: `o[{}]` reads `o["[object
Object]"]`. That is the same missing conversion at a different entry. It
needs its own issue, and it lands with or after Stage 1.

### Tasks

- [x] Stage 1: refuse an object with an own `toString` or a function
      `valueOf`, and a function wherever its text is observable, keeping every
      text-independent result. Unit tests per row, and corpus cases with a
      `rust` reason.
- [x] The member functions that convert: the `// TODO:`s in `array_join`
      and `vm/string/search.rs` replaced with a pointer to Stage 2, tests
      that `join` and the searches refuse, a corpus case for a needle with
      its own `toString`, and the `toSorted` guard's test.
- [ ] Stage 2: call an object's own `toString` and `valueOf` per
      `OrdinaryToPrimitive`. Move the host-only cases into the corpus.
- [ ] Stage 3: a function's text, through the EDAG renderer (tracked with the
      `Function` checklist in `member-functions.md`).
- [ ] File the property-key conversion as its own issue.
