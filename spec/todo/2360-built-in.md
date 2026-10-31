## Built-in Objects and Functions

**Priority:** P2
**Status:** open

The built-in objects are special. We can call a permitted function, but cannot
use its global namespace as an ordinary value. Some operations are permitted
only inside a complete recognized pattern, not as independent calls.

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects

Some of the JS built-in objects and functions are "not allowed" in FJS. It means, an FJS compiler rejects code that contains "not allowed" objects and functions.

### Global Scope

Global objects can't be assigned to a variable (`const r = Object`). They can only be used as namespaces (`Object.entries()`).

None of these names may be *bound* by a module either, or admitting one
later would change what a module already means:
[`2365-global-names.md`](./2365-global-names.md), which reserves each name
no later than this file admits any of it, a name at a time
([landing a name at a time](./2365-global-names.md#landing-a-name-at-a-time)).

A ticked box below marks a name the language is to admit, not one it admits
today. Implemented reserved globals are `Infinity`, `NaN` and `undefined`
([numbers](../values/numbers/README.md)), `Number` and `String`, as the
conversions `Number(exp)` and `String(exp)` — `String`'s alone — their
words reserved ([number conversion](../conversions/number/README.md),
[string conversion](../conversions/string/README.md)), and `Array`, as the
right operand of [`instanceof`](../operators/instanceof/README.md), and `Object` and
`Number`, as the namespaces of the static functions `Object.is` and the
four `Number` predicates, each a value
([built-in static functions](../built-ins/static-functions/README.md)). Other global uses need
a complete recognized pattern; an unrecognized global is refused as an
unbound name (`const not found`), so
`export default isFinite(1);` does not compile yet. An unticked box is a
name not yet decided, or, where it says so, never admitted.

#### Value Properties

- [x] `Infinity`
- [x] `NaN`
- [x] `undefined` — a literal global like the two above it
- [ ] `globalThis` — never, not not-yet: it is the global object itself

#### Function Properties

- [ ] `eval` — never, not not-yet: it runs source at run time. Binding the
      word is refused already, and by JavaScript rather than by us
- [x] `isFinite()`
- [x] `isNaN()`
- [x] `parseFloat()`
- [x] `parseInt()`
- [ ] `encodeURI()`
- [ ] `encodeURIComponent()`
- [ ] `decodeURI()`
- [ ] `decodeURIComponent()`

#### Fundamental Objects

- [x] `Object` — `Object.is` is implemented, the first static function: a
      value, read in either key spelling of the unguarded access — the
      guarded `Object?.is` is refused since, a namespace being no value to
      guard — and through `const { is } = Object`, its body in the runtime, the word reserved
      ([built-in static functions](../built-ins/static-functions/README.md),
      [`fjs/js/todo/runtime-static.md`](../../fjs/js/todo/runtime-static.md)).
      The namespace's other members stay unticked, each an admission of
      its own. `Object.entries` is admitted too, native in every executor,
      and `Object.fromEntries`, its body in the runtime (the records below)
- [ ] `Function`
- [ ] `Boolean`
- [ ] `Symbol`

##### `Object.entries` proposal and approval

**Problem.** The language enumerates no keys. The
[`entry` helper](../property-access/entries/README.md) reads a key a program
already holds, never the keys it does not, so a module that walks an
object — `structurallySame`, `definedEntries`, every `.f.mjs` that writes
`const { entries } = Object` — cannot be written in the language, and an
`.f.mjs` that does so cannot be renamed `.f.js`.

**Proposal.** Admit `Object.entries` as a static function beside
`Object.is`: a value in every spelling of the read, `Object.entries`,
`Object["entries"]` and the guarded forms — which a later decision refuses,
a namespace being no value to guard
([built-in static functions](../built-ins/static-functions/README.md)) — and through
`const { entries } = Object`; the EDAG node `['Object.entries']`; `length`
`1`; one function however often it is read. Its answer is JavaScript's: a
fresh array of fresh `[key, value]` pairs, one per enumerable own
string-keyed property, in JavaScript's own-key order — array-index keys
ascending, then every other key in insertion order — an array's elements
and a string's code units under their index strings, nothing for a number,
a boolean, a `bigint` or a function, and a failure on `null` and
`undefined`, as `ToObject` fails. An entry holding `undefined` is listed,
as JavaScript lists it.

**No body: every executor binds it natively.** The runtime's `static`
section holds bodies written in FunctionalScript, and no body can write
this one: enumerating keys is exactly what the language lacks, so
`Object.entries` is a primitive, as `String.fromCharCode` is
([runtime-static](../../fjs/js/todo/runtime-static.md)). The runtime
holds nothing at its path, and each executor answers the node itself: the
represented interpreter with a function value of its own,
`['Object.entries']`, called natively as `['entry']` is; NaNVM with the
closure over `Any::entries` the runtime value holds at the path
([the runtime's README](../../fjs/js/runtime/README.md), "How NaNVM finds
it"), so every read is
the one function.

**Destructuring.** `entries` is a prototype name, `Array.prototype`'s,
which every pattern refuses at the key. Over a namespace the namespace's
own list decides first, so `const { entries } = Object` is
`const entries = Object.entries`, destructuring being sugar; a key the
namespace does not admit is refused as before, a prototype name at the
key and any other name at the word.

**Text.** `String(Object.entries)` has no EDAG to render, so every
executor answers `function entries() { [native code] }`: what ECMA-262
requires of a built-in function
([`Function.prototype.toString`](https://tc39.es/ecma262/#sec-function.prototype.tostring)),
a string with the syntax of a NativeFunction whose name is the built-in's
[[InitialName]], `entries`. The grammar admits parameters; the text has
none, as most engines print it, V8's text exactly. The interpreter spells
it, `staticText` in `fjs/edag`, from the static node, and NaNVM forms the
same text from the built-in's name, `Function::text`. A text keeps
every conversion that never reads it, `Number` and the relational
operators, answering alike in the represented interpreter, which renders a
text before it converts, and NaNVM, which answers those without one, so
refusing it, as NaNVM refuses a native function with no text, was not
taken. `a => Object.entries(a)` was considered: a working implementation,
which `eval` or the `Function` constructor makes a function of, where a
NativeFunction does not parse, and its parameter shows the `length`; but
ECMAScript requires the NativeFunction of a built-in, and
**sergey-shandar** chose the standard's text in the session. JavaScript run
directly answers its own host's text, a NativeFunction too, which an engine
may spell otherwise, as JavaScriptCore breaks the line. Every other
runtime function answers the same, `function is() { [native code] }`, in
place of its body's EDAG text: a runtime function is the built-in, not
its body ([runtime-static](../../fjs/js/todo/runtime-static.md)).

**Benefits.** The JavaScript spelling for what modules already do on the
host, and the one enumeration from which the rest — keys, values, a
filtered copy — are FunctionalScript over arrays. Modules that enumerate
an object compile as written.

**Drawbacks.** The first static with no body: one more function value in
the represented interpreter and one more binding in NaNVM, kept in
agreement by the harness rather than by one body. Enumeration observes an
`undefined`-valued entry and key order in one more place
([undefined properties](./1010-undefined-property.md)), which object
spread already observes. A namespace key in a pattern may now be a
prototype name.

**Language-design approval.** **sergey-shandar** directed "Implement
`Object.entries` in FJS. Note, it can't be a runtime function." in
[the LLM working session](https://claude.ai/code/session_01R1c6kasjVwXAdm69VAd5oU),
before implementation began. The destructuring and text decisions above
are that session's reading of the direction, open to the owner's review.

**Implemented** as proposed: `fjs/js/static`'s `natives` lists the path,
the represented interpreter answers it from `fjs/edag/value/entries`, and
NaNVM with a closure over `Any::entries` in the runtime value, which the
`statics` table lists as the built-in itself;
`nanvm/harness/fixtures/object-entries.mjs` and
`object-entries-throws.mjs` hold the executors to Node.

##### `Object.fromEntries` proposal and approval

**Status:** approved and implemented; the recount below remains.

**Problem.** `Object.entries` takes an object apart; nothing admitted puts
one together from keys known only at run time. The one spelling that
compiles is a spread with a computed key,
`entries.reduce((o, [k, v]) => ({ ...o, [k]: v }), {})`, which copies the
whole object at every entry: O(n²) for n keys. The authored modules write
`Object.fromEntries` instead — at `35daed16`, 20 non-proof modules read it
directly, on 30 lines, among them `fjs/rtti/data` (8) and `fjs/rtti/parse`,
`fjs/types/object` (which destructures it from `Object`),
`fjs/compiler/parser/grammar`, `fjs/edag/value/object` and `fjs/media/json`
— and none of them can be renamed `.f.js` while it does. Modules that call
`fjs/types/object`'s helper or define a `fromEntries` of their own are not
counted: this name does not block them.

**Proposal.** Admit `Object.fromEntries` as a static function beside
`Object.entries`, read in the same spellings and through
`const { fromEntries } = Object`, with the EDAG node
`['Object.fromEntries']` and `length` `1`. Its answer is JavaScript's for
the one iterable the language builds, an array: a fresh plain object with,
for each element in order, the element's `[0]` converted to a property key
and its `[1]` as the value, defined as an own data property
(CreateDataProperty, so `__proto__` is a key like any other); a later
duplicate key replaces the value and keeps the first key's position. An
element that is not an object fails, as JavaScript's TypeError does.

**A body, and substitutions of it.** Unlike `Object.entries`, this one can
be written in FunctionalScript — a reduce like the one above that, after the
failure for a non-object element, reads the element's `[0]` and `[1]` rather
than destructuring it, since an array pattern iterates and JavaScript's
answer for `{ 0: 'a', 1: 1 }` is `{ a: 1 }` — so by [DESIGN.md §13](../../doc/DESIGN.md#13-one-source-of-truth-optimize-by-substitution)
the runtime's `static` section holds it, as it holds `Object.is`'s: the one
source of what the built-in answers. A backend may answer the node natively
to avoid the quadratic copy only as a substitution rule keyed on the node,
with the naive emission kept and the harness running its fixtures both ways
— never as a second implementation in the body's place. Its text is the
NativeFunction text every static in the runtime's `statics` table carries,
`function fromEntries() { [native code] }`, in place of its body's, as the
[runtime](../../fjs/js/runtime/README.md) requires and the `Object.entries`
record above holds.

**Benefits.** The JavaScript spelling for what 20 modules already do,
linear where the executor makes it so, and the inverse of the enumeration
the language already has: keys, values and filtered copies are then
round trips over arrays.

**Drawbacks.** One more static, and with it one more name the namespace
admits in a pattern. A non-array iterable — a `Map`, a generator — is no
value FunctionalScript builds, so the admitted function answers only for
arrays; a host that passes another iterable gets JavaScript's answer on
the host and is outside what the language promises.

**Language-design approval.** **sergey-shandar** approved this record as
proposed in
[the review of #3356](https://github.com/functionalscript/functionalscript/pull/3356#pullrequestreview-5681488293),
which added it, before implementation began
([DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)).

**Implemented** as proposed: `fjs/js/static`'s `statics` lists the path,
and the runtime's `statics` table holds the body, a `while` loop over the
array that spreads the object built so far with each entry's computed key,
refusing a value that is not an array and an element that is not an object;
every executor answers the node from it, NaNVM through the compiled runtime.
No executor substitutes a native for it yet, so `n` entries cost O(n²)
there. `nanvm/harness/fixtures/object-from-entries.mjs`,
`object-from-entries-throws.mjs` and
`object-from-entries-not-array-throws.mjs` hold the executors to Node.

**Tasks.**

- [x] Formal language-design approval, recorded here with a link.
- [x] `Object.fromEntries`'s body in the runtime's `static` section,
      through every executor, with harness fixtures holding them to Node,
      and the
      [built-in static functions](../built-ins/static-functions/README.md)
      page updated.
- [ ] Recount the modules this unblocks and rename those that then compile.

#### Number and Math

- [x] `Number` — the call `Number(exp)`, the conversion
      ([number conversion](../conversions/number/README.md)), and the four
      predicates `Number.isInteger`, `Number.isSafeInteger`, `Number.isNaN`
      and `Number.isFinite`, static functions
      ([built-in static functions](../built-ins/static-functions/README.md),
      the record below); the namespace's other members, its value
      properties `Number.MAX_SAFE_INTEGER` among them, stay unticked, each
      an admission of its own. A module reading one of the four, through
      `const { isFinite } = Number` as well, needs no rewrite to compile;
      a module reading another member is rewritten when that member is
      admitted or equivalent code can use existing syntax
- [ ] `BigInt` — not decided. `BigInt(n)` on an integral number is the
      importable function
      [`bigint`](../../fjs/types/bigint/from_number/module.f.js)
      meanwhile ([`doc/CONVERTING.md` §8](../../doc/CONVERTING.md#8-bigint))
- [ ] `Math`
- [ ] `Date`

##### Number predicates proposal and approval

**Problem.** Four `Number` members are pure predicates a module reaches for
by name — `Number.isInteger`, `Number.isSafeInteger`, `Number.isNaN` and
`Number.isFinite` — and the compiler refuses each (`reserved word`), so a
module imports a helper in its place
([`doc/CONVERTING.md`](../../doc/CONVERTING.md) §2–§4) and an `.f.mjs` that
reads the member cannot be renamed `.f.js` as written.

**Proposal.** Admit the four as static functions, as `Object.is` is
([built-in static functions](../built-ins/static-functions/README.md)): each
a value in every spelling of the read, `Number.isInteger`,
`Number["isInteger"]` and the guarded forms — which a later decision
refuses, a namespace being no value to guard
([built-in static functions](../built-ins/static-functions/README.md)) — and through
`const { isInteger } = Number`; each the EDAG node of its name,
`['Number.isInteger']`; each body the existing helper the runtime's `static`
section imports — `isInteger`, `isSafeInteger`, `isNaN_` and `isFinite_` of
`fjs/types/number` — which answer as the built-ins do for every kind of
value, none converting its argument. `Number` is reserved already, for the
conversion; it becomes a namespace beside it, `Number(x)` unchanged. The
global `isNaN` and `isFinite`, which convert, are not these and stay
undecided.

**Benefits.** The JavaScript spelling for what modules write today through
imported helpers, with one body per predicate shared by the runtime and the
modules that import it, so the two answer alike by construction. A module
reading one of the four needs no rewrite to compile.

**Drawbacks.** Four more EDAG node kinds, each a tag every executor and
writer has to read, unless they share one table of static names. The
namespace grows to a member that is a number, `Number.MAX_SAFE_INTEGER`,
which stays refused: a value property is a different admission from a
function.

**Language-design approval.** **sergey-shandar** chose "all four Number
predicates" when asked which function to admit next, in
[the LLM working session](https://claude.ai/code/session_01DCMj3aMojA86V6qjvW9fXs),
before implementation began.

**Follow-up.** The bodies have since moved into the runtime, with
`Object.is`'s, out of `fjs/types/number` and `fjs/types/object/is`: once
the built-ins were admitted, a helper beside each was a second public
spelling of one function, so modules call the built-in, and the runtime's
proof checks each body against the host's. **sergey-shandar** proposed
the move in the same session, after the admission.

#### Text Processing

- [x] `String` — implemented as `String(exp)`, the string conversion,
      and `String()`, the empty-string literal; the word is reserved
      ([string conversion](../conversions/string/README.md)). Namespace
      members remain unrecognized; spreads, multiple arguments and guarded
      calls are refused by design, the conversion being an operator
      ([operators and functions](../principles/README.md#operators-and-functions))
- [ ] `RegExp`

##### String conversion proposal and approval

**Problem.** The compiler refused `String(x)` even though the EDAG already
represented string conversion, so authored `.f.js` modules could not use the
familiar JavaScript spelling for that operation.

**Proposal.** Admit `String(exp)` as the existing conversion operation and
`String()` as the empty-string literal. Reserve the global name when admitting
it, as [global-names](./2365-global-names.md) requires. Namespace members and
other call shapes remain separate admissions; computed property keys retain
their existing `Number(...)` requirement. The implemented semantics are in
[String Conversion](../conversions/string/README.md).

**Benefits.** This preserves familiar JavaScript syntax and conversion behavior
for supported values, makes the existing operation available to source modules,
and reuses its evaluation and output backends. One conversion expression and
the empty-string literal add little language complexity.

**Drawbacks.** Reserving `String` breaks existing bindings with that name.
JavaScript's namespace members, multiple arguments, spreads, and guarded calls
are still refused, so source compatibility is partial. Function conversion
uses EDAG-derived code text rather than the original JavaScript source and
omits captured values. The new expression also needs traversal, lowering, and
serialization support throughout the compiler.

**Language-design approval.** **sergey-shandar** explicitly directed
"Implement it" in [the LLM working session](https://chatgpt.com/local/01a121ce-d4c3-71ca-a025-8e451349b01c),
after the existing `String(x)` TODO was identified and before implementation
began.
The design was also explicitly [approved on the PR](https://github.com/functionalscript/functionalscript/pull/2763#issuecomment-6088238083)
by **sergey-shandar** during review.

**Process deviation.** The fuller benefits-and-drawbacks record was added
during PR review. That ordering deviated from the
[proposal-first workflow](../../doc/DESIGN.md#new-language-features-start-with-a-todo).
Implementation followed the language designer's explicit instruction above;
the chronology and the prior approval are retained here for review.

#### Indexed Collections

- [x] `Array`
- [ ] `Int8Array`
- [ ] `Uint8Array`
- [ ] `Uint8ClampedArray`
- [ ] `Int16Array`
- [ ] `Uint16Array`
- [ ] `Int32Array`
- [ ] `Uint32Array`
- [ ] `Float32Array`
- [ ] `Float64Array`
- [ ] `BigInt64Array`
- [ ] `BigUint64Array`

#### Keyed Collections

- [ ] `Map`
- [ ] `Set`
- [ ] `WeakMap`
- [ ] `WeakSet`

#### Structured Data

- [ ] `ArrayBuffer`
- [ ] `SharedArrayBuffer`
- [ ] `Atomics`
- [ ] `DataView`
- [x] `JSON`

#### Control Abstraction Objects

- [ ] `Promise`

`Generator`, `GeneratorFunction`, `AsyncFunction` and
`AsyncGeneratorFunction` stood here and are gone: no global object has them
— they are intrinsics reached through a prototype — so admitting one would
mean inventing a global JavaScript does not have. `AsyncIterator` and
`AsyncGenerator` are the same case.

#### Reflection

- [ ] `Reflect`
- [ ] `Proxy`

#### Internalization

- [ ] `Intl`

#### WebAssembly

- [ ] `WebAssembly`
- [ ] `WebAssembly.Module`
- [ ] `WebAssembly.Instance`
- [ ] `WebAssembly.Memory`
- [ ] `WebAssembly.Table`
- [ ] `WebAssembly.CompileError`
- [ ] `WebAssembly.LinkError`
- [ ] `WebAssembly.RuntimeError`

### Object

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object

#### Reflection boundary

`Object.hasOwn`, `Object.getOwnPropertyNames` and
`Object.getOwnPropertyDescriptors` are prohibited in FJS source. They keep
their JavaScript meanings; do not redefine them over enumerable properties.
`obj.hasOwnProperty(...)` is not a replacement source spelling.

Use explicit enumerable-entry patterns instead:
[`entry`](../property-access/entries/README.md) reads a data value and `hasEntry`
beside it answers presence. `Object.getOwnPropertyDescriptor` is permitted only as
part of a complete approved AST pattern, never as an exposed descriptor API.

[Statement-aware recognition](../../fjs/compiler/parser/todo/statement-aware-intrinsics.md)
resolves statements, expressions and bindings before matching. No built-in
receives a whitespace-insensitive token-parser shortcut. A standard operation
must either retain its successful JavaScript behavior or remain prohibited.

The table below inventories side effects, **not unconditional admission**.
Having no side effects is necessary but not sufficient. It neither overrides
the reflection restrictions nor changes host-side implementation helpers.

|Function                 |side-effect                |
|-------------------------|---------------------------|
|assign                   |mutate                     |
|create                   |creates a special prototype|
|defineProperties         |mutate                     |
|defineProperty           |mutate                     |
|entries                  |no                         |
|freeze                   |mutate                     |
|fromEntries              |no                         |
|getOwnPropertyDescriptor |no                         |
|getOwnPropertyDescriptors|no                         |
|getOwnPropertyNames      |no                         |
|getOwnPropertySymbols    |return symbols             |
|getPrototypeOf           |return prototypes          |
|groupBy                  |return null-property object|
|hasOwn                   |no                         |
|is                       |no                         |
|isExtensible             |no                         |
|isFrozen                 |no                         |
|isSealed                 |no                         |
|keys                     |no                         |
|preventExtensions        |mutate                     |
|seal                     |mutate                     |
|setPrototypeOf           |mutate                     |
|values                   |no                         |

### Array

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array

|Function                 |side-effect|
|-------------------------|-----------|
|from                     |no         |
|fromAsync                |?          |
|isArray                  |no         |
|of                       |no         |

### BigInt

|Function                 |side-effect|
|-------------------------|-----------|
|asIntN                   |no         |
|asUintN                  |no         |

### JSON

|Function    |side-effect|
|------------|-----------|
|`isRawJSON` |no         |
|`parse`     |no         |
|`rawJSON`   |no         |
|`stringify` |no         |

### Others

|Function                 |side-effect|
|-------------------------|-----------|
|`decodeURI()`            |no         |
|`decodeURIComponent()`   |no         |
|`encodeURI()`            |no         |
|`encodeURIComponent()`   |no         |
|`eval()`                 |runs source; never admitted|
|`isFinite()`             |no         |
|`isNaN()`                |no         |
|`parseFloat()`           |no         |
|`parseInt()`             |no         |

|Property    |side-effect|
|------------|-----------|
|`Infinity`  |no         |
|`NaN`       |no         |

### Prohibited Properties

The two lists that decide this today — every prototype name refused as a
property read, `length` excepted, and the member functions refused as a
call — are [`fjs/js/prototype`](../../fjs/js/prototype/module.f.js)'s
`prototypeNames` and `prohibitedCalls`, with one row per name and its reason
in [its README](../../fjs/js/prototype/README.md). The notes below predate
them and are kept as the record of the reasoning.

#### Object

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object

- [ ] ! `constructor` — can create a new function, e.g. `(() => null).constructor('a', 'return a * a')`
- [ ] deprecated `__proto__`
- [ ] ! deprecated `__defineGetter__` — can mutate an object
- [ ] ! deprecated `__defineSetter__` — can mutate an object
- [ ] deprecated `__lookupGetter__`
- [ ] deprecated `__lookupSetter__`

#### Array

These instance methods mutate an array:

- [ ] ! `copyWithin`
- [ ] ! `fill`
- [ ] ! `pop`
- [ ] ! `push`
- [ ] ! `reverse`
- [ ] ! `shift`
- [ ] ! `sort`
- [ ] ! `splice`
- [ ] ! `unshift`

### String.fromCharCode proposal and approval

**Problem.** The shared runtime cannot construct arbitrary UTF-16 strings
without a native operation or a large code-unit lookup table.

**Proposal.** Admit `String.fromCharCode` as a native static value in every
executor. Preserve JavaScript's variadic ToUint16 conversion, empty call,
lone surrogates, function identity, native text and `length` of 1. Detached
calls, including `const { fromCharCode } = String`, read no `this`.
Other String statics remain prohibited.

**Benefits.** JavaScript compatibility and a small string-construction
primitive for shared runtime bodies, without a 65,536-entry table.

**Drawbacks.** Every executor must bind another native static.

**Approval.** The task owner explicitly requested native implementation and
FJS admission in this session, including detached calls and matching length,
before implementation.
