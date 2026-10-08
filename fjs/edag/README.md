# EDAG

An **e**xpression **DAG** — the canonical data representation of a function
body. A body is a single root expression node; a shared subexpression is one
node referenced from several places, not a copy — sharing is observable
(`{} === {}` is `false`), so it is part of the function's meaning, not a
serialization trick. Evaluation memoizes every node by identity within one
invocation — shared nodes evaluate once, per the baseline in
[edag-stage1-discussion.md](../../todo/edag-stage1-discussion.md), and each
call starts fresh, per the per-invocation memo scope in
[interpret-edag.md](../compiler/todo/interpret-edag.md). There is no normal form: a function's hash is the
structural identity of its graph as written, the name-erased source.
Lowering rules make agreed-on spellings coincide; hash equality does not
decide semantic equivalence. The schema in [module.f.mjs](module.f.mjs) owns
node kinds and operand shapes independently of its producers and executors.
The [FunctionalScript](../compiler/) compiler lowers parsed modules to EDAG
([compile-modules-to-edag.md](../compiler/todo/compile-modules-to-edag.md));
the interpreter and Rust code generation execute it. Value conversion reuses
the compiler serializer's function-text renderer.

[`value`](value/module.f.mjs) defines the evaluated-value subset's type and
shape schema: data and functions with evaluated captures and unevaluated
bodies. Both FJS interpreters and compiler module initialization use this
representation; [EDAG values](values.md) records its construction, identity,
failure and runtime-compilation contracts.
[`validateMetadata`](value/metadata/module.f.mjs) checks unique, correctly
ordered object keys in evaluated data and captures,
preserving value identity.
[`validateClosure`](value/closure/module.f.mjs) checks closure bindings,
function-body scopes and function lengths, including nested function creation,
and also preserves value identity. These checks require shape-checked FJS data
and serve explicit boundaries accepting EDAG supplied as data. VM constructors
must maintain the value invariants directly, without revalidating every result.
FJS data is acyclic by construction, so it needs no cycle preflight.

Both FJS interpreters return language results as
`Result<EdagValue, EdagValue>`. An operation's own implicit failure, such as
calling a non-function or dividing a bigint by zero, returns
`error(['undefined'])`. An explicit `throw` returns its evaluated operand as
the error payload. Failures from operands and invoked callbacks propagate
unchanged, retaining container and callable identities. Module initialization
preserves that payload alongside its source path; admission and loading
diagnostics keep their separate channels. The [joint interpreter
proofs](memo/proof.f.mjs) exercise actual throwing callbacks through array
methods and an enclosing operand; [compiler proofs](../compiler/transpiler/proof.f.mjs)
cover direct and imported module initialization.

[`value/semantics`](value/semantics/module.f.mjs) provides truthiness, `typeof`,
strict equality and `Object.is` for represented values. Distinct
`['undefined']` tuples denote the same primitive; arrays, objects and functions
compare by their value-node identity. These infallible helpers are shared
building blocks for the VM operation layer. Its `unary` table supplies `!`
and `typeof`; its `binary` table supplies `===`, `!==` and `is`. Both tables
accept evaluated values and return `Result` successes. Callers own operand
evaluation and failure propagation.

[`value/control`](value/control/module.f.mjs) adds Result-based `throw`, `&&`,
`||`, `??` and `?:`, taking an evaluated first operand and deferring the rest
with thunks. Its `sequence` helper runs deferred operands in order and returns
the first failure or last success unchanged; an empty sequence yields tagged
undefined. Earlier values may be discarded, but their failures still stop the
sequence. The helpers provide stateless control flow; executor state belongs
to the invocation/cache layer.

[`value/array`](value/array/module.f.mjs) constructs evaluated arrays from
deferred items, resolving array and string spreads in order. Construction
stops at the first failure, preserves element identity and creates a fresh
array value. A non-iterable spread returns `error(['undefined'])`.

[`value/object`](value/object/module.f.mjs) constructs evaluated objects from
deferred string-key properties and object, array and string spreads. It
preserves property value identity, stops at the first failure and creates a
fresh object with unique keys in JavaScript enumeration order. Property
thunks perform key resolution before value evaluation; key coercion belongs
to the operation/invocation layer.

[`value/function`](value/function/module.f.mjs) constructs function values
from deferred captures and valid body templates. Captures evaluate in order,
retaining their identities and propagating the first failure unchanged.
Each function gets a fresh copy of its body graph, including nested function
templates, while sharing within that graph is preserved. Body code stays
unevaluated; captured values stay outside the copy. Memo's `invoke` interprets
the retained body with a fresh invocation cache.

[`value/call`](value/call/module.f.mjs) prepares bare calls over represented
values. It resolves deferred arguments and spreads, pads missing fixed
arguments with tagged undefined and creates a fresh rest array per call.
Callee and argument failures propagate unchanged; arguments resolve before
a non-function fails. An executor callback receives the original function
and its fixed/rest bindings and owns body evaluation and invocation state.
The memo interpreter threads its immutable cache around these stateless helpers.

[`value/property`](value/property/module.f.mjs) reads resolved string keys
from represented values, preserving stored field and element identities.
Arrays, strings and functions expose their lengths; string indices read
UTF-16 code units. Missing properties return tagged undefined and nullish
receivers fail. Its `entry` is what a call of the `entry` helper reads,
over a key already converted: the enumerable own property, so an array's
or a string's elements and never a `length`, and nothing of a function.
Callers own operand evaluation order, key resolution and source-name
admission. Memo connects these reads to chains and to the helper's calls;
[`value/method`](value/method/module.f.mjs) dispatches admitted built-ins, with
represented array callbacks in [`value/array_method`](value/array_method/module.f.mjs).
[`value/convert`](value/convert/module.f.mjs) supplies primitive conversion for
objects, arrays and functions, using the shared function-text renderer in both interpreters.
[`compiler/transpiler.interpret`](../compiler/transpiler/module.f.mjs) uses memo
to evaluate each module with represented dependency exports. The AST value
evaluator is retired; both FJS EDAG VMs and compiler initialization use this
representation. [Runtime compilation](values.md#runtime-compilation) converts
these values, including evaluated closures, through the target backend.

[`value/coercion`](value/coercion/module.f.mjs) converts ordinary objects to
primitives by trying `valueOf` and `toString` in the hint's order. Own methods
shadow stock behavior, including noncallable values. Represented functions
run through the call helper; their first primitive result or failure returns
unchanged. Its primitive helpers convert the represented `Primitive` subset
to strings and numeric values, decoding tagged undefined through the shared
semantics helper. Abstract ToNumber rejects bigint; ToNumeric preserves it.
[`value/convert`](value/convert/module.f.mjs) composes these helpers with array
and function conversion; memo owns operation dispatch.

[`value/numeric`](value/numeric/module.f.mjs) supplies a `unary` operation
table over evaluated primitives. Unary `+` fails on bigint, `-` and `~`
preserve bigint, and explicit `Number` converts it. Its `binary` table supplies
`+`, `-`, `*`, `/`, `%`, `**`, `&`, `|`, `^`, `<<`, `>>` and `>>>`.
Addition concatenates when either primitive is a string; otherwise arithmetic
preserves the numeric type. Bitwise operations use signed 32-bit numbers or
exact bigints, except `>>>`, which returns an unsigned 32-bit number and fails
on bigint. Number shift counts wrap modulo 32; negative bigint counts reverse
the shift direction. Mixed number/bigint operands, bigint zero divisors and
negative bigint exponents fail with tagged undefined. Both tables return
`Result` values. Callers own operand evaluation and conversion to primitives.
For ordinary objects, pass `'number'` to `objectToPrimitive` for all these
operations, including addition's default conversion.

[`value/relational`](value/relational/module.f.mjs) supplies a `binary` table
for `<`, `<=`, `>` and `>=` over evaluated primitives. Two strings compare
by UTF-16 code unit; mixed number/bigint comparisons preserve numeric value,
and bigint/string comparisons parse the string as an integer. NaN, tagged
undefined and invalid bigint/string comparisons succeed with false. Every
result uses `Result`; operand evaluation and conversion of containers or
functions remain with the caller, using the number hint for ordinary objects.

The [`value/array`](value/array/module.f.mjs) join helper consumes an evaluated
array and a resolved string separator. Nullish elements contribute empty text;
other elements use the supplied string converter in order, preserving the
first failure unchanged. The converter also owns nested-array and function
text. Separator conversion/defaulting and full value conversion remain with
operation dispatch.

[`value/at`](value/at/module.f.mjs) supplies relative indexing for evaluated
arrays and strings with primitive indices. It applies abstract ToNumber,
truncates fractions toward zero, and counts negative indices from the end.
Array elements retain their identities; strings yield UTF-16 code units.
Out-of-range reads succeed with tagged undefined; bigint indices fail even
for empty receivers. Callers own method dispatch, operand evaluation and
conversion of nonprimitive indices, using the number hint for ordinary objects.

[`value/slice`](value/slice/module.f.mjs) slices evaluated arrays and strings
with primitive start/end bounds. Tagged undefined means an omitted bound:
start defaults to zero and end to the receiver's length. Other bounds use
abstract ToNumber, with bigint failing even for empty receivers or ranges.
Array results are fresh values sharing the selected elements; strings retain
UTF-16 substring semantics. Callers own method dispatch, operand evaluation
and conversion of nonprimitive bounds, using the number hint for ordinary objects.

The shared [serializer](../compiler/serializer/module.f.mjs) exposes
`functionText(analysis, index): string` for a function whose analysis and body
bindings are already established. It renders every admitted body without
repeating admission; `tryFunctionText` remains the checked raw-expression entry
and returns `Result<string, string>` for admission failures. Both preserve
capture-slot names and allow unused slots, including in nested functions.
Existing canonical text stays unchanged. Bodies the source writer cannot
reconstruct use general JavaScript expression text, with invocation-local lazy
memo cells preserving shared nodes, lazy branches and nested captures. The
emitted text may use local mutation; its FJS renderer is immutable.

This is code-only function text, used by both interpreters' direct and indirect value
conversion. It does not save captured values or implement callable runtime
compilation. Source serialization with `tryStringify` remains partial and
requires every slot to survive its structural round trip.

[`value/to_unknown`](value/to_unknown/module.f.mjs) exposes
`toUnknown(value): Effect<CompileValue, unknown, IoChannel>`. Data-only graphs
materialize without a host operation. Callable graphs request `compileValue`
with a generated construction module, and a runner can provide the
[`javascriptOperationMap`](value/to_unknown/module.mjs). For example,
`asyncRun(javascriptOperationMap)(toUnknown(value))` returns an ordinary runtime
value inside a `Result`, including functions that accept ordinary callbacks.
Partial runners report an unavailable operation through the standard effect
error channel; loading failures use that same channel.

Each conversion creates fresh containers and functions while preserving sharing
inside the result. The host loads a factory module and calls the factory once
per conversion, so cached code never caches a converted value. The `Result`
wrapper also prevents asynchronous loading from interpreting a value's own
callable `then` property. `toData` is the synchronous data-only converter; it
continues to refuse functions for consumers that require data.

[`compiler/serializer/value`](../compiler/serializer/value/module.f.mjs) emits
closed value graphs as JavaScript modules, including executable functions with
their evaluated captures. Its `stringify` API preserves shared data and function
references under the JavaScript/memo profile; calls have fresh body allocations
and can accept ordinary runtime callbacks. The generated module exports the
complete runtime value as its default. Its `factoryStringify` variant wraps the
same construction in a default-exported factory for runtime loading. This
value-emission contract does not require the FJS source parser to reconstruct
the original graph.

"No normal form" is a statement about the module as a whole, not a licence for
each node kind to admit several spellings of one thing. Where a set of
spellings *can* be cut down to one in the schema, it is: [Chains](#chains) is
the worked case, where four node kinds and three continuation types replace a
flat array of steps that admitted four families of duplicates, and the
uniqueness is structural — the wrong shapes are unspellable rather than
rejected by a validation pass a producer has to remember to run.

The shape is defined once, as an [RTTI](../rtti/) schema in
[module.f.mjs](module.f.mjs) — the specification of record, checkable at
runtime with `validate(exp)` (shape only — see Caveats). [types.ts](types.ts) carries the same shape at
the type level, pinned against the schema with `Assert<Check<...>>` so the
two cannot drift. Every tuple in the schema is closed — none of them says
`open`, which is what an rtti tuple needs to admit more than it declares — so
the static tuples and the runtime ones agree exactly, an exact-length
[TupleTs](../rtti/ts/types.ts) rendering over an exact-length set.
[proof.f.mjs](proof.f.mjs) pins what the schema accepts and rejects, node
kind by node kind — validation behavior, not execution semantics — with
`comma` pinned by the compiler that emits it, `fjs/compiler/edag`. Its `ownJs` and
`chainsJs` sections are the exception that proves the rule: they run the JS
whose behavior the nodes are built around, which is how those semantics were
pinned before anything executed an EDAG. [amnesia](amnesia/README.md) now
does — a tree-walking evaluator for testing the semantics, and deliberately
not a VM to run FunctionalScript on — over represented
[operations](operations/module.f.mjs), parameterized by how an
operand is evaluated and which interpreter invokes a function. Both Amnesia
and memo return `Result<EdagValue, EdagValue>`; their different reuse policies
are preserved. [Module initialization](values.md#module-initialization) uses
memo with represented dependency exports.
[analysis](analysis/module.f.mjs) reads
a graph into one table — every operation node once, in walk order, its
operands by index, its scope, and which entries are shared — so that a
writer can hoist what is shared and an executor can cache it without a
structure keyed by node identity. It returns `Result<Analysis, string>`:
structural failures, such as a node shared across function scopes or a
noncanonical function length, return a diagnostic. Complete executable
graphs compose the result with `checked` to check their invocation bindings.
It returns the same analysis on success or an invocation-binding diagnostic;
an optional function index limits the check to that function and its nested bodies.
`operandsOf(node)` lists every operand in written order, preserving primitives,
repeated occurrences and reference identity. It includes lazy positions and a
function's captures followed by its body. The serializer uses the same helper,
keeping only captures when walking a function in its enclosing scope.
`itemOperand(item)` unwraps a spread or returns a plain operand unchanged;
analysis and the serializer share it for array items and call arguments.
[memo](memo/module.f.mjs) is that
interpreter: it returns `Result<EdagValue, EdagValue>`, evaluating every shared
entry once per invocation with an immutable cache. Functions retain their
bodies and evaluated captures; invocation does not construct host callables.
Conversion of value graphs to ordinary FJS/JS values is **runtime compilation**,
separate from **EDAG interpretation**. The broader identity and memoization
choices, including JS-compatible executors, global memoization, and the CAVM,
are compared in [execution-models.md](execution-models.md).

## Literal descriptions

`fromValue(other)(value)` in [module.f.mjs](module.f.mjs) encodes a typed
`Plain<F>` description as an EDAG expression. Primitive leaves stay primitive;
`undefined`, arrays and objects become literal nodes. Object members follow
enumeration order and retain explicitly present `undefined` values. Every
occurrence gets fresh nodes, including repeated input containers.

The `other` hook translates function leaves into expressions and can supply
shared nodes. The [NaNVM corpus](../nanvm/module.f.mjs) uses it for its function
markers and explicit shared references. JSON imports use the same encoder
with no function leaves. This conversion describes literals; it does not
recover the code or identity of runtime values after reflection is erased.

## Nodes

A node is a primitive or a tagged tuple `[tag, ...operands]`. In the schema
and the type-level API, operation nodes are grouped by their `exp`-operand
count — `op0` (`undefined`, `args`, `rest`), `op1` (unary), `op2` (binary),
`op3` (the conditional), and `op12` for the two tags legal at both of the
first two counts (`+`, `-`)
— not by semantic category. The four chain nodes follow a different rule and
are their own kinds, because what distinguishes them is the hidden control
flow they own rather than how many operands they take; see
[Chains](#chains). This table is an overview; the contract of
record for each node is the JSDoc in [module.f.mjs](module.f.mjs) — on the
node's export and, for the operations, on the `op0Id`/`op1Id`/`op2Id`/`op12Id`/`op3Id`
vocabularies.

| form | meaning |
|---|---|
| `null`, `boolean`, `number`, `string`, `bigint` | itself |
| `['undefined']` | `undefined` — tagged, because a bare `undefined` is indistinguishable from a missing tuple position |
| `['[]', items[]]`, each an `exp` or a `spread` | array literal; `[a, ...b]` splices `b`'s elements in at that position |
| `['{}', properties[]]`, each `[':', key, value]` or a `spread` | object literal; ordered entries applied in written order, duplicates allowed with the later winning; the key is an `exp`, one form for `a:`, `"a":`, and computed `[exp]:` keys; the `:` descriptor is a structural operand, not a node — only its key and value are; `{...a}` splices `a`'s own properties in at that position |
| `['...', exp]` | spread — only valid as an `items`/`properties` entry above, never a top-level `Exp` |
| `['args']` | unresolved module imports, in import order |
| `['arg', N]` | fixed parameter `N` of the owning function |
| `['rest']` | the invocation's rest array, after the fixed prefix |
| `['self']` | the owning function itself, as a value, the same every read: recursion is `['()', ['self'], args]`, and a nested function captures its parent's `self` as a slot |
| `['entry']` | the language's `entry` helper, as a value: a function of `length` `2` capturing nothing, fresh where it is established as every `=>` is, whose call `['()', ['entry'], [a, b]]` reads the enumerable own property `b` names of `a` |
| `['=>', length, slots[], body]` | function; integer length metadata, the slots of its frame — each an `exp` evaluated in the enclosing scope, `[]` for no captures — and the invocation-scope body |
| `['frame', N]` | slot `N` of the owning function's captured frame |
| `['()', exp, items[]]` | call with no receiver, `exp(…)` over the argument list `items[]` — see [Chains](#chains) |
| `['.', exp, index]`, `['.', exp, index, propertyLambda]` | property access `exp0[exp1]`, owning whatever its receiver is used for |
| `['?.', exp, index]`, `['?.', exp, index, optionPropertyLambda]` | optional property access `exp0?.[exp1]`, owning the rest of its optional region |
| `['?.()', exp, items[]]`, `['?.()', exp, items[], optionLambda]` | optional call `exp?.(…)`, likewise |
| `['\|()', items[], k?]`, `['\|.', index, k?]`, `['\|?.()', items[], k?]`, `['\|!()', items[]]` | a chain step and, where the chain continues, its continuation — only valid in the continuation operand of a node above, or of another step |
| `[',', exps]` | comma: establish all operands, take the value of the last |
| `[id, exp]` | unary operation, `id` one of `String` `Number` `!` `~` `typeof` `throw` — `throw` establishes its operand and fails with it as the thrown value, so it is the one node that never has a value |
| `[id, exp, exp]` | binary operation, `id` one of `is` `===` `!==` `>` `>=` `<` `<=` `*` `/` `%` `**` `&` `\|` `^` `<<` `>>` `>>>` `&&` `\|\|` `??` |
| `[id, exp]`, `[id, exp, exp]` | `id` one of `+` `-`: unary plus or negation, addition or subtraction — one tag at two arities, the node's length deciding, as a chain step's does; unary `+` is JS's and throws on a bigint where `Number` converts |
| `['?:', exp, exp, exp]` | conditional: the condition, then exactly one arm — the one `ToBoolean` selects; the other is never established |

Where a form is listed twice above, the two are the node's arities: the
shorter one ends the chain and the longer one hands it on, and the schema is
their union. A `k?` in the step row says the same thing one level down. That
is the whole of how a chain ends — there is no terminator value, so `null` in
a continuation position is simply not one of these forms.

A `[]` suffix in the form column marks an operand that is an array of the
named schema, not one of it: `['[]', items[]]` holds a whole array of
`items`, a call's `items[]` is the same list, `exps` is likewise `exp[]`,
and a function's `slots[]` is the same
`exp[]` — an array of slots, not a node evaluating to one, so that a slot
read has a count to be checked against and no spread can leave that count
unknown. The distinction is easy to lose in
prose and load-bearing in the schema — a single element where the array
belongs still validates plenty of values, just the wrong ones.

**Why an array operand rather than a variadic tail.** `['[]', [a, b]]`
rather than `['[]', a, b]`, and the same one position further in for
`['{}', …]`. An rtti `Tuple` pins one schema per position, so "this literal
tag, then any number of further positions, all matching this one schema" is
not spellable inline in a bigger `Const` tuple; `array`/`record` say exactly
that, but only as their own single operand. Growing the `Type` ADT to admit
a fixed prefix followed by a homogeneous rest has no other consumer here, so
the array operand is the decided representation rather than a stand-in for a
flat one — [`todo/edag-stage1-discussion.md`](../../todo/edag-stage1-discussion.md)
writes the same shape.

A continuation is **not** an array. It is one step holding the next
continuation, so a chain is a linked list whose link type changes as it goes —
which link type is legal where is the whole of [Chains](#chains) below. The
list ends by **arity**: the step or node that ends it is simply the shorter
tuple, with no continuation operand at all, which is why every kind that can
end is a union of its two closed lengths.

Function `length`, `arg` indices and `frame` indices satisfy
`Number.isInteger(n) && n >= 0 && !Object.is(n, -0)`. An `arg` index also
requires `N < length`, and a `frame` index `N < slots.length` of the owning
function — the analysis refuses either, and the executors refuse a read
past the end rather than answering `undefined`. They are metadata, not
operand nodes. Missing fixed arguments bind to `undefined`; rest begins at
`length`, has stable identity within a call, and is fresh between calls.
`arg`, `rest`, `frame` and `self` require a function scope; `args` is only a
module binding. `self` is the function whose body holds it, the innermost one,
so a nested function reaches its parent's through a slot holding `['self']`,
evaluated in the parent's scope. Frames retain their enclosing scope, including for nested captures:
`['frame', N]` reads the frame of the function whose body holds it, and the
slots of `=>` are evaluated in the scope around that function, so a nested
capture is a slot holding a read of the parent's slot.

This format replaces `['=>', frame, body]` and the later
`['=>', length, frame, body]` whose `frame` was a general `exp` — an array
literal, or `null` for no captures — and `['frame', N]` replaces the bare
`['frame']` binding and the `['.', ['frame'], N]` read over it. Recompile
source or migrate function-owned `args` to `rest` and insert length `0`;
retain module import `args`, including in module-level slots. Old tuples
are rejected rather than reinterpreted, with one corner the two encodings
share: an old array-literal frame, `['[]', items]`, reads under this format
as two slots, the string `'[]'` and `items`, wherever `items` itself spells
a node — which takes a string in its first position, so a frame the
compiler built, whose slots are all nodes, never does. A graph in that corner
validates as two slots and is not refused; its body's reads of the old
frame, `['.', ['frame'], N]`, still are, so only a frame no read reached is
ever reinterpreted. Earlier positive-arity/full-argument experiments have no
general lossless migration to this format.

A function's `length` is at most 16, the language's limit: `checked`
refuses a larger one. Both Amnesia and memo read length and fixed/rest
bindings from represented functions, without an arrow factory. Their function
text uses the total shared renderer described above. Callable runtime
compilation uses the [explicit conversion boundary](values.md#runtime-compilation); the broader
default-text contract is recorded in
[the parameter plan](../../spec/todo/3120-parameters.md).

An `index` — the property operand of `.`, `?.`, and the `|.` step — is a
`string`, a `number`, or `['Number', exp]`, a computed index cast to a
number. Widening those positions to a bare `exp` was weighed and rejected:
`exp` and `index` overlap, since `['Number', e]` is both a `numberCast` and
an `op1`, so it would buy a second spelling of every computed key and no new
expressive power. A property named at run time is read by no binary id
but by a call of `['entry']`, the language's `entry` helper as a value,
which reads the enumerable own property a key names once converted,
bypassing the prototype chain (including `__proto__`) and reading no
`length` of an array, a string or a function — the helper is the one
source spelling of the node (see the `entryJs` proof); calling a function
is not among the binary ids — a call's
receiver comes from the node holding it, which no `op2` id has anywhere to
put. A call's arguments — the last operand of `()`, the second of `?.()`,
the operand of every call step — are an item list, the list `[]` holds, read
by position: `f(a, b)` is `['()', f, [a, b]]`, and `f(a, ...b)` is
`['()', f, [a, ['...', b]]]`. The list is no node of its own, so it is never
shared or hoisted, and its position, not its first item, says it is a list:
`f('.', x)` is `['()', f, ['.', x]]`. A spread argument is a `...` item,
`f(...xs)` included: it is `['()', f, [['...', xs]]]`, and forwarding a rest
parameter, `(...r) => f(...r)`, is `['()', f, [['...', ['rest']]]]`. A spread
iterates its operand, so `f(...'ab')` passes `'a'` and `'b'`. Every callee
builds its own rest array from the arguments, so the caller's array is never
the callee's.

**An engine may form the arguments the way the callee reads them.** The
semantics are one array, the item list evaluated left to right with each
spread iterated, which the callee then splits: a function of `length` `N`
reads its first `N` arguments as `['arg', 0]` … `['arg', N - 1]`, `undefined`
past the end of a short call, and the arguments after them as `['rest']`. No
node observes the one array — a function has no `['args']` of its own — so a
runtime that checks how many fixed parameters the callee takes at the call
may build the two arrays it reads instead: the fixed `[args; N]` and the rest.
The items are still evaluated in order, a spread still iterated, and the
boundary between the two arrays falls at the `N`th value, wherever a spread
puts it. A call to a function that reads no `['rest']` need not build one.
And where `N` is `1` an engine may pass the one fixed argument as the value
itself, no array around it: a curried function, `a => b => a + b`, then takes
each argument with no allocation at all, where the one-array reading would
allocate one per call.

## Chains

A JS member chain carries two kinds of hidden control flow that its operand
values do not: a property access hands its receiver to a following call as
`this` (`[42].at(0)` is `42`, but `const at = [42].at; at(0)` throws), and an
optional link skips the rest of its chain (`undefined?.a.b` is `undefined`,
but `(undefined?.a).b` throws). Parentheses move both boundaries, so both are
part of what a graph means.

Neither is ever the result of an `exp`. Evaluating an `exp` produces an
ordinary value and nothing else, which is what keeps a node
context-independent and shareable by identity wherever it appears. So the
control flow has to be born, carried, and consumed inside one node — and the
node's **continuation** operand is where it is carried. A continuation is a
*lambda*: a function of the chain's current value whose argument is elided,
which is what the name says. It is not an `exp` and cannot be lifted out as a
shared node — `['|.', 'b']` means nothing on its own.

### Two bits, three lambda types

Those two kinds of control flow are two bits of state:

- **P** — a receiver is live
- **O** — a short-circuit region is open

Neither bit live is the definition of a node boundary, so there are three
continuation types and not four:

| | outside an option | inside an option |
|---|---|---|
| **receiver live** | `propertyLambda` | `optionPropertyLambda` |
| **value only** | *(an `exp`)* | `optionLambda` |

Each node hands its continuation the state it produces — `.` a property, `?.`
a property inside a region, `?.()` a value inside a region — and `()`
produces a bare value, which is why it alone has no continuation operand.

### Four steps

| step | effect | meaning |
|---|---|---|
| `['\|.', index, k]` | sets P, keeps O | property access; the input becomes the receiver |
| `['\|()', items[], k]` | clears P, keeps O | call the current value with the current receiver |
| `['\|?.()', items[], k]` | clears P, **sets** O | the same, `undefined` on a nullish current value — and the region it opens owns the rest of the chain |
| `['\|!()', items[]]` | clears P, **clears** O | the same as `\|()`, but *outside* the region: the parentheses ended it, so a short-circuit does not skip this step |

`?` adds a guard and `!` escapes one, which makes the three call steps a
complete taxonomy of how a call can relate to the region it sits in:

| step | relationship | example |
|---|---|---|
| `\|()` | inherits the region's guard | `a?.b(...c)` — skipped when `a` is nullish |
| `\|?.()` | adds its own | `a?.b?.(...c)` — also checks `b` |
| `\|!()` | escapes it | `(a?.b)(...c)` — happens regardless, receiver kept |

There is no fourth combination, and `!` pairs only with `()` because only
calls consume receivers — a close-then-access `|!.` would just be a `.` node
over the whole chain node, which nesting already spells.

### Which step is legal where

A step needs a production in a state exactly when moving it into a nested
node would be **observable**. Every alternative is justified by a live bit,
and which bit says why it cannot be a node instead:

| state | step | justified by | hands on |
|---|---|---|---|
| `propertyLambda` | `\|()` | P — nesting loses `this` | *(terminal)* |
| | `\|?.()` | P | O |
| `optionLambda` | `\|()` | O — the region must cover the call | O |
| | `\|.` | O | OP |
| `optionPropertyLambda` | `\|()` | O and P | O |
| | `\|.` | O alone | OP |
| | `\|?.()` | O and P | O |
| | `\|!()` | P — the region is closing anyway | *(terminal)* |

Leaving the continuation operand out is every state's third exit — the chain
simply ends and any live bit is dropped, which is also the correct spelling of
a bare `(a?.b)`, since closing a region with nothing after it is
unobservable. Ending is therefore an absence, not a value: `null` is a
primitive again, and it has no reading in a continuation position.

What is *absent* carries as much as what is present. `|!()` outside a region
is not a design decision — there is no bit to clear. The three real decisions
are `|.` in `propertyLambda` and `|?.()`/`|!()` in `optionLambda`: in each,
no live bit would be destroyed by moving the step into its own node, so the
production would be nothing but a second spelling. The sharpest case is `|.`,
which is in `optionPropertyLambda` and not in `propertyLambda` — same step,
same wasted receiver both times, and the difference is that O is live in one,
so the region will not let it leave. That single asymmetry is why `(a?.b).c`
throws where `a?.b.c` does not.

### Spellings

In this table `(...c)` stands for a call's whole argument list and `c` for
its item list: `f(a, b)` has `c = [a, b]`, and `f(...xs)` has
`c = [['...', xs]]` ([nodes](#nodes), above).

| JS | EDAG |
|---|---|
| `a.b` | `['.', a, 'b']` |
| `a.b.c` | `['.', ['.', a, 'b'], 'c']` |
| `a.b(...c)` | `['.', a, 'b', ['\|()', c]]` |
| `(0, a.b)(...c)` | `['()', ['.', a, 'b'], c]` |
| `a.b?.(...c)` | `['.', a, 'b', ['\|?.()', c]]` |
| `f(...c)` | `['()', f, c]` |
| `a?.b` | `['?.', a, 'b']` |
| `a?.b.c` | `['?.', a, 'b', ['\|.', 'c']]` |
| `(a?.b).c` | `['.', ['?.', a, 'b'], 'c']` |
| `a?.b(...c)` | `['?.', a, 'b', ['\|()', c]]` |
| `a?.b?.(...c)` | `['?.', a, 'b', ['\|?.()', c]]` |
| `(a?.b)(...c)` | `['?.', a, 'b', ['\|!()', c]]` |
| `(a?.b.c)(...d)` | `['?.', a, 'b', ['\|.', 'c', ['\|!()', d]]]` |
| `(a?.b).c(...d)` | `['.', ['?.', a, 'b'], 'c', ['\|()', d]]` |
| `a?.b(...c).d(...e)` | `['?.', a, 'b', ['\|()', c, ['\|.', 'd', ['\|()', e]]]]` |
| `a?.(...c)` | `['?.()', a, c]` |
| `a?.(...c).d` | `['?.()', a, c, ['\|.', 'd']]` |
| `(a?.(...c))(...d)` | `['()', ['?.()', a, c], d]` |

The `chains` section of [proof.f.mjs](proof.f.mjs) pins the shape of every
spelling above, `chainsJs` next to it runs them as JS on the host engine, and
[amnesia/proof.f.mjs](amnesia/proof.f.mjs) evaluates them as nodes.

### What cannot be written

The uniqueness is structural: the duplicate families a flat array of steps
admitted are not forbidden, they are unspellable, and the `unspellable`
section of [proof.f.mjs](proof.f.mjs) is one case per family.

| family | why |
|---|---|
| `a?.b?.c` | no lambda has a `?.` production; `?.` is only ever a node tag, so a guarded property access always starts a node |
| `a.b(...c)?.d` | `propertyLambda`'s `\|()` is terminal, so the chain exits |
| `(a?.(...b))(...c)` | `optionLambda` has no `\|!()`; the outer call is a plain `()` |
| `a?.b(...c)?.(...d)` | `optionLambda` has no guarded step either — the property variant `a?.b(...c)?.d` is family 1 |

The same holds for dead prefixes: `propertyLambda` has no `|.` production, so
plain property paths nest and `a.b.c` has exactly one spelling. "Exactly one"
is literal rather than "up to trailing junk", because every tuple in the
schema is closed — `['.', a, 'b', k, 'extra']` does not validate.

Two things the vocabulary makes disjoint deserve stating, because neither is
cosmetic. **The `|` prefix is a correctness requirement.** Unprefixed,
`['()', f, k]` would read as a well-formed `()` node — call `f` with `k` as
its arguments — and as a well-formed step — call the chain's value with `f` as
its arguments, then continue with `k`. Closedness bounds a tuple's length and
says nothing about its tag, so no arity separates those readings; only
disjoint vocabularies can, and the prefix does it without anyone having to
prove that a continuation could never also be an expression.
**Closedness by length is what a terminal rests on.** `propertyLambda`'s
`|()` and `optionPropertyLambda`'s `|!()` end the chain and have only the
two-element arity, so a continuation handed to one is a third element the
tuple does not declare, and the value is rejected rather than accepted with
the rest silently dropped — which is exactly what the length check gives and
what an `open` tuple would take away.

### Where the host engines disagree

One spelling is not checked in `chainsJs`, because the engines disagree about
it. When `u` is nullish, `(u?.b)(d)` must throw: the parentheses end the
chain, so `undefined` is called. V8 does throw; JavaScriptCore (hence
`bun test`) carries the short-circuit through the parentheses and evaluates to
`undefined` instead. That case is exactly the `|!()` step, so no JavaScript
oracle can establish it on every supported runner. The EDAG follows the
specification — `['?.', u, 'b', ['|!()', d]]` denotes the throwing
reading, and an executor must produce it whatever its host does — as
[amnesia](amnesia/module.f.mjs) does, where
`optionRegion.throw.closeStepOnUndefined` in
[amnesia/proof.f.mjs](amnesia/proof.f.mjs) evaluates the node and pins the
throw on every runner. `(u?.b).c`, the property counterpart, throws everywhere
and is what `chainsJs` pins for this boundary.

One pair of spellings has no proof **anywhere**, and it is worth being exact
about why. `a.b(...c)` and `(a?.b)(...c)` are both `TypeError` on a nullish
base and differ only in whether the arguments ran: the first throws at the
access with `c` untouched, the second short-circuits, evaluates `c`, and
throws at the call. `(a?.b.c)(...d)` against `(a?.b).c(...d)` is the same pair
one step further in. JavaScript cannot pin them, because they are `|!()`
terms; and neither can the node, because *both* readings throw, this language
has no mutation for a skipped operand to record itself with, and a `throw`
case is pass/fail rather than payload-inspecting (`fjs/AGENTS.md` §1.5). What
`amnesia/proof.f.mjs` pins is that each side throws where it should. The order
itself is carried by the shape of `callProperty` in
[amnesia/module.f.mjs](amnesia/module.f.mjs) — it takes the argument *node*
and evaluates it inside the call expression, so JavaScript's own order applies
— and by that function's JSDoc, which says so. Take an evaluated array there
instead and every test still passes.

Two further points about that disagreement, both worth knowing before reading
the commented cases in `chainsJs.throw`. It is the *engine*, not bun's
transpiler: `(u?.b)(d)` is equally wrong through `eval` and `new Function`
under bun, which hand the source straight to JavaScriptCore. And there is a
second, separate defect next to it — bun rejects `` (u?.b)`tag` `` at parse
with `SyntaxError: Cannot use tagged templates in an optional chain`, where
`eval` of the same text throws correctly, so that one *is* the transpiler.
It is [oven-sh/bun#31812](https://github.com/oven-sh/bun/issues/31812), filed
for the `new` sibling `new (baz()?.qux)()`; one root cause, the parenthesis
ceasing to end the chain, so restrictions that hold inside it leak past.
Both halves are tracked, with the versions they were measured on and what
unblocks them, in
[bun-optional-chain-parentheses.md](../../todo/blocked/bun-optional-chain-parentheses.md).

### The cost

A plain `a.b` is `['.', a, 'b']`, so a property access that ends its chain
costs nothing beyond the access itself — the continuation operand is present
only where a chain actually continues. The price is paid in the schema
instead: every kind that can end is written twice, once per arity, so the
shared prefix appears in both arms. There is no ambiguity, since
`propertyLambda` has no `|.` production and a property path keeps its unique
spelling.

The deeper cost is purity, and it is unchanged from any other shape that
spells chains out of steps. A continuation is structured now, but it is still
not an `exp`: the `a.b` inside `['.', a, 'b', ['|?.()', c]]` cannot be
shared, substituted, or hashed. That is the price of expressing control flow
that no value can carry, and it is confined to exactly the positions that
need it.

## Caveats

- Neither `validate` nor `parse` is identity-aware, each in its own way:
  `validate` returns the original value — sharing intact — but re-walks a
  shared subgraph once per incoming edge (exponential in depth); `parse`
  rebuilds every container, so sharing is lost —
  [identity-aware-parse.md](../rtti/todo/identity-aware-parse.md).
  So `validate` is shape validation, not complete EDAG validation:
  identity-dependent canonicality — the rule that an operation-node
  identity may be shared only within one function's scope,
  never across a `=>` boundary — goes unchecked. The Stage 2 validator for
  that boundary is tracked in
  [compile-modules-to-edag.md](../compiler/todo/compile-modules-to-edag.md).
  In particular `parse` is not a way to canonicalize a graph: it constructs a
  fresh container at every position it visits, so two edges reaching the same
  input reference come back as two distinct outputs, flattening the one
  property the representation exists to carry.
- `[',', exps]` is shape-checked only. Its contract — at least two operands,
  the last the result, each earlier operand a true root: not reachable from
  another operand of the same `,` — is the emitter's to keep, as the `=>`
  scope rule is; a single-operand `,` is the identity, an operand a sibling
  reaches a redundant anchor, both non-canonical. `fjs/compiler/edag` keeps it:
  the operands before the result are the roots of what a module's export
  does not reach, in source order (the order among them is not yet
  canonical — the discussion's candidate is content-hash order).
- `['...', exp]` is shape-checked only, and what its operand must evaluate
  to differs by the container it sits in — neither constraint expressible in
  a shape-only schema. In an array the operand must be iterable (`[...1]`,
  `[...null]`, and `[...{a: 1}]` all throw); in an object anything goes,
  contributing the operand's own enumerable properties — of which a number,
  boolean, bigint, symbol, `null`, or `undefined` has none (`{...null}` is
  `{}`), while a string has its indices (`{...'ab'}` is `{0: 'a', 1: 'b'}`).
  Object spread reads those properties *through* getters, unlike the
  `entry` helper, which reads the descriptor's value and never calls one.
- `index` does not yet exclude `constructor`/`__proto__` —
  [excluded-string-values.md](../rtti/todo/excluded-string-values.md).

## Design

The semantics and operation vocabulary are decided subject by subject in
[edag-stage1-discussion.md](../../todo/edag-stage1-discussion.md). The module
boundary is the one stated at the top of this file: the compiler's temporary
`Unresolved { imports, edag }` wrapper, module resolution and serialization
stay in `fjs/compiler`, since import paths are not part of an EDAG. Generating the
Rust types and validation from this schema is
[rust-schema-codegen.md](./todo/rust-schema-codegen.md). The discussion
predates [Chains](#chains) above and describes the chain nodes as one call tag
carrying a flat `lambdas` array of steps; that array is gone, and this file is
the record for what replaced it and why.
