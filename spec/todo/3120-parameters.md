## Named and rest parameters

**Priority:** P1
**Status:** open — parameter syntax and default rendering implemented; approval, migration proofs and native metadata follow-ups remain

### Implementation status

Fixed and rest parameters shipped: the plan in
[#2220](https://github.com/functionalscript/functionalscript/pull/2220) and
the implementation in
[#2237](https://github.com/functionalscript/functionalscript/pull/2237).
The user requested: “Implement named/required parameters as we described on
top of PR 2220. `fjs compile` should support the syntax `(a, b, c, ...x) => ...`”.
That request also authorized the original pre-generated
`g => (a0, ...rest) => g([a0], rest)` factory table.

Parsing, binding, fixed/rest EDAG, source output and Rust output are
implemented, and the accepted syntax is in the
[specification](../README.md#functions). A function's `length` is at most 16,
the approved language limit. The old three-element function tuple is a
breaking format change: recompile source, or migrate zero-arity
function-owned `args` to `rest`, retaining module import bindings.

Amnesia, memo and compiler initialization now keep function bodies and
evaluated captures as [EDAG values](../../fjs/edag/values.md). Their shared
conversion uses the implemented code-only
[function renderer](../../fjs/edag/function-text.md), including indirect
coercions. Captures are slot names; `self` uses a generated named function
expression. Compiled native functions also carry EDAG-derived text. These
paths no longer depend on factory-wrapper text or a host `toString` hook.

Ordinary callable exports are produced separately by
[runtime compilation](../../fjs/edag/values.md#runtime-compilation), which
intentionally erases EDAG reflection. Their later host conversions retain
the host-text exception; they do not require a reverse callable-to-EDAG
registry. Full native/AOT semantic metadata association is still a separate
[follow-up](../../fjs/compiler/todo/associate-edag-with-functions.md).

**What remains:** record the outstanding language-design approval and
module-import migration proofs in the task list, and retain the native
metadata follow-up. Shared default rendering is implemented, not a blocker
on these parameter or export paths. The unchanged
[`types/range`](../../fjs/types/range/module.f.js) compilation candidate
compiles whole and carries the `.f.js` extension.

### Blocking review: factory text escapes through exports

**Historical, superseded by represented values.**
[PR #2237's review](https://github.com/functionalscript/functionalscript/pull/2237#discussion_r4097743166)
reported factory text escaping through Amnesia and memo at `32d18d87`:

```js
const f = (a) => a;
export default f.toString();
// Historical result: '(a0, ...rest) => g([a0], rest)'
```

The proposed fresh-arrow `Object.defineProperty` renderer hook was not
adopted. Retaining functions as represented EDAG values removed the need to
patch host callables, while ordinary runtime compilation kept the host-text
exception. The current renderer and its direct/indirect conversion proofs
supersede the old requirement to intercept every host conversion through
exported factory arrows. The original review and prototype remain historical
evidence, not instructions to add property mutation or reopen the
implemented capture-slot and `self` spellings.

### Problem

Before this implementation, `fjs compile` accepted only empty and rest-only
arrow parameter lists. The task extends that syntax
without losing the function's observable `length` when compiling, executing
or writing its EDAG.

The previous [`=>` operation](../../fjs/edag/operations/module.f.mjs) constructs
`(...args) => ...`, whose `length` is zero. Merely lowering named parameters
to indexed reads of the existing `['args']` would therefore change results.

### Proposal

The implemented parameter contract admits fixed named parameters and an
optional final rest parameter. EDAG represents fixed values and the rest
array separately; interpreters retain the function's length, body and frame
as represented values. Ordinary callable construction belongs to the target
runtime compilation boundary.

This replaces this TODO's earlier positive-arity/full-`['args']` design and
its restricted writer boundary. The implementation request and original
factory-table authorization are recorded above. The language limits
`length` to 16 ([functions](../README.md#functions)).

**Benefits:** familiar JavaScript syntax, preserved arity, and a shared
argument representation for the compiler, writers and FJS interpreters.

**Costs:** parameter/group disambiguation, a coordinated EDAG/API migration
and the approved fixed-parameter limit. Positive-arity EDAG functions no
longer expose the original argument count within the fixed prefix. This
does not preserve the earlier hypothetical contract combining positive
arity with the complete supplied argument list. The implemented shared
renderer supplies code-only text independently of callable construction.

### Parsing and binding

Accept these forms, with either existing body form:

```js
const empty = () => 0;
const all = (...args) => args;
const one = a => a;
const parenthesized = (a) => a;
const fixed = (a, b, c) => [a, b, c];
const trailing = (a, b, c,) => [a, b, c];
const mixed = (a, b, c, ...args) => [a, b, c, args];
```

Here "required parameters" means the fixed named positions, not a requirement
that callers supply them. Missing fixed arguments bind to `undefined`; extra
arguments remain permitted.

1. Extend the shared [source AST](../../fjs/compiler/parser/syntax/types.ts) to retain an
   ordered list of fixed bindings and an optional rest binding. Preserve
   source locations, blocks and explicit returns. Names are erased only after
   binding and syntax validation.
2. Extend the [parameter and parenthesis grammar](../../fjs/compiler/parser/grammar/module.f.mjs).
   Named parameters overlap the identifier/grouped-expression prefix: factor
   that shared prefix and distinguish a parameter list from a group using
   the arrow continuation. Do not add an independent token-pattern parser or
   treat arbitrary expressions as binding names. Keep the shared LL(1)
   approach and prove that the grammar builds; bare `a => ...`, `(a)`,
   `(a) => ...` and `(a + b)` need distinct correct interpretations.
3. After each fixed name, accept `)`, a comma followed by another fixed name,
   a comma followed by the final `...name`, or an ordinary trailing comma.
   After `...name`, require `)`; no following parameter, second rest, default
   initializer or trailing comma. Preserve `[no LineTerminator here]` before
   `=>`, including newlines in comments, and existing statement termination.
4. Resolve parameters with the existing scope/name rules. Reject duplicate
   bindings, including a rest name duplicating a fixed name, reserved names,
   parameter/body declaration collisions and invalid binding expressions.
   Do not expand captures or shadowing rules as a side effect of this task.

Default initializers and destructuring are separate syntax work, not part of
this first implementation. Refuse them explicitly rather than partially
interpreting them. The AST should leave room for later binding patterns.

### EDAG: fixed prefix and rest

Proposed nodes:

```js
['=>', length, slots, body]
['arg', N]
['rest']
```

`length` is finite, nonnegative integer metadata, not an expression operand.
Zero must be positive zero: reject `Object.is(length, -0)`, rather than
silently normalizing it. For this syntax it is the number of fixed parameters,
including unused ones. A rest parameter adds zero. Keep the count in canonical
function content: different lengths are observable even when the bodies and
frames match.

`['arg', N]` reads a fixed parameter. `N` must be a constant finite integer
with `0 <= N < length` and must not be negative zero; it is not an EDAG
expression. Validation checks it against the function whose invocation the
node reads. A missing supplied argument produces `undefined`.

For both metadata fields, the numeric predicate is
`Number.isInteger(value) && value >= 0 && !Object.is(value, -0)`, followed
by the owning-length bound for `N`. Compiler output uses canonical positive
zero. This restriction is on metadata only: `-0` remains a distinct, valid
ordinary value in fixed parameters, rest arrays and other expressions.

`['rest']` reads the array of arguments supplied at positions `length` and
above. Its length is `max(actualArgumentCount - length, 0)`. Evaluate it as a
read of the invocation's binding, not as a fresh slice on each occurrence.
Repeated reads return the same array; distinct calls get distinct rest arrays
under the JS-compatible identity profile. Captured outer parameters/rest use
the existing frame mechanism, not the inner function's argument context.

For `(a, b, c, ...args) => ...`, lower `a`, `b` and `c` to `['arg', 0]`,
`['arg', 1]` and `['arg', 2]`; lower `args` to `['rest']`; record `length = 3`.
Functions without a source rest binding simply have no source reference to it.
At `length = 0`, `['rest']` is the complete supplied argument array.

**New function invocation scopes have no complete-list `['args']` operation.**
For positive arity, omitted arguments and explicit `undefined` in the fixed
prefix are intentionally indistinguishable. The rest tail still distinguishes
absence from a supplied `undefined`. Code needing the exact complete argument
list uses a rest-only function, whose length is zero.

#### Module import bindings are unchanged

An unresolved module is not a function invocation. Its `['args']` remains the
ordered array of imported module export objects, as specified by the
[unresolved-module plan](../../fjs/compiler/todo/compile-modules-to-edag.md#resolve-unresolved-modules-to-one-edag).
For example, `['.', ['.', ['args'], 0], 'default']` still reads the first
import's default export. Import order, attributes, evaluation anchors and
sharing are unchanged; no synthetic function arity or factory limit is added
to module imports.

Keep `['args']` in the shared node schema for that use. Scope validation
permits it in an unresolved module's evaluation scope, but rejects it in a
new-format function's invocation scope. Conversely, `['arg', N]` and
`['rest']` require an owning function and are invalid at module scope.
After linking, no unresolved module-scoped `['args']` may remain; valid
function-local `arg`/`rest` bindings remain untouched.

A function's slots are evaluated in its enclosing scope; only `body` opens
the function's invocation scope. Thus a module-level closure's frame may read
import `['args']`, while a nested closure's frame may capture its parent's
`arg`/`rest`. Import substitution and reachability analysis traverse frames
in the enclosing scope, never substitute inside function bodies, and preserve
node sharing. The module plan's old function-argument examples describe the
current format; their function-owned `['args']` migrate below, not the import
binding. No module-loading protocol or replacement import opcode is proposed.

### Instantiating functions from EDAG

Amnesia and memo construct represented function values
`['=>', length, evaluatedSlots, body]`, not host arrows. Each call binds
fixed positions and one rest array in a new invocation; `['self']` denotes
that represented function and nested closures retain their captures.
The [value contract](../../fjs/edag/values.md#construction-and-identity)
specifies allocation and sharing.

`toUnknown` converts represented data to ordinary runtime values. Callable
graphs request target compilation of a generated factory module, which
constructs fresh values while retaining shared captures and function arity
([runtime compilation](../../fjs/edag/values.md#runtime-compilation)). Native
backends use their callable representation with the same fixed/rest
contract and associate compiled function text at construction.

The original implementation used the handwritten table in
[`fjs/types/function/length`](../../fjs/types/function/length/README.md),
covering lengths 0–16. Its `(fixed, rest)` callback split demonstrated
ordinary JavaScript argument binding:

```js
const f = factories[2]((fixed, rest) => [fixed[0], fixed[1], rest]);

f.length;            // 2
f();                 // [undefined, undefined, []]
f(1);                // [1, undefined, []]
f(1, 2, undefined);   // [1, 2, [undefined]]
f(1, 2, 3, 4);        // [1, 2, [3, 4]]
```

That table remains a utility and a historical construction strategy; the
represented interpreters do not select or export its wrappers. The
language's arity limit remains in force independently of that strategy.

### Source serialization boundary

Write a function of length `L` as `(a0, ..., aL_1, ...rest) => body`, with
fresh names. Render `['arg', N]` as its fixed binding and `['rest']` as its
rest binding. For zero arity, use `(...rest) => body`. Keep unused fixed
parameters: dropping one changes both `length` and the start of the tail.
Generate the parameter list directly from `L`, without consulting the executor's
factory table. Source-to-EDAG compilation and EDAG-to-source writing inherit the
language's limit on `L`, which the table equals, and refuse a larger one as an
error Result.

This removes the earlier arity/complete-argument writer obstruction for the
new nodes. It does not promise that unrelated unsupported EDAG capabilities
can be serialized. Preserve captured sharing, scope and the selected identity
profile. Callable serialization and default function conversion follow the
existing [function-text contract](./serialization.md#function-text-and-serialization);
their output contracts are not automatically identical.

### Default function text: render or refuse

The shared renderer is implemented for represented FJS functions, including
Amnesia, memo and compiler initialization. Their conversion paths use
EDAG-derived default text for `f.toString()`, the `String` EDAG operation,
array/string conversion, property-key conversion and admitted member
methods. They retain the function graph rather than materializing a host
wrapper for interpretation
([function text](../../fjs/edag/function-text.md)).

The renderer writes code, not captured values. Every external frame slot
gets a generated name, and declarations across nested scopes share the
same name counter. A function reading `self` is rendered as a named
function expression with its self binding allocated before its parameters.
The total text renderer may use JavaScript expressions outside the FJS
parser's source grammar; the structural source serializer has a separate,
partial round-trip contract. These are implemented spellings, not open
choices about whether captures or `self` are supported.

Compiled native functions carry this text for direct and indirect
conversion. A native function without associated text is refused at the
conversion boundary. Retaining full semantic EDAG for native metadata or
hashing remains [separate work](../../fjs/compiler/todo/associate-edag-with-functions.md);
it is not a missing prerequisite for the compiled text already supplied.

Ordinary JavaScript source execution and ordinary runtime callables created
by `toUnknown` use the host's function text under the
[function-source exception](../README.md#function-source-representation-exception).
The historical host-closure ruling on
[#2469](https://github.com/functionalscript/functionalscript/pull/2469) does
not exempt the represented EDAG interpreters from their current canonical
renderer. Runtime compilation intentionally erases EDAG reflection rather
than installing a `toString` override or a reverse lookup registry.

Function creation, calls, returns, exports, arity and captured identity
retain their existing contracts in each profile. A data output may refuse
a selected callable, but rendering is not a reason to ban callable exports.
Broader callable interchange serialization and conditional streaming frame
production remain in the [serialization design](./serialization.md#open-questions);
they do not reopen the implemented code-only default representation.

### Length limit and migration

A function has at most 16 fixed parameters
([functions](../README.md#functions)), approved as a language limit
([approval](https://github.com/functionalscript/functionalscript/pull/2295#issuecomment-5831266299)) so
that every valid function is materializable, with the right `length`, by every
backend. A 17th fixed name is a compile error, and `checked` refuses an
EDAG function whose `length` is above 16, so every writer returns an error
Result for it. The table covers exactly the valid lengths; it does not limit
supplied argument count or rest-array length.

Coordinate the format/API break across schema, compiler, analysis, operations,
executors and writers. Existing three-element function nodes have arity zero;
convert their function-owned `['args']` reads to `['rest']`, including reads
in a nested closure's frame that belongs to that function. Preserve
module-owned import `['args']`, including reads in a module-level closure's
frame. Migration visits each body in its own scope; a global tag replacement
is incorrect. Do not silently reinterpret old nodes. Positive-arity/full-`['args']`
graphs from previous design sketches have no general semantics-preserving conversion to
this contract; refuse such input rather than claim a lossless migration.

Reconcile pending design documents in this proposal, before implementation:
[stage-1 subjects 2 and 7](../../todo/edag-stage1-discussion.md#2-arguments-reference),
the [native callable plan](../../nanvm-lib/todo/callable-function-objects.md),
which also covers captured frames in Rust,
and the [function-frame plan](./3111-function-frame.md) follow this
`length` / `arg` / `rest` contract, not a count-only extension of complete
`['args']`. This addresses the
[argument-model review](https://github.com/functionalscript/functionalscript/pull/2220#discussion_r4094709899)
and the [remaining-plan review](https://github.com/functionalscript/functionalscript/pull/2220#discussion_r4095100756).
Their current-format and historical descriptions remain explicitly labeled.

Current EDAG/schema documentation and executable consumers now use the
fixed/rest format. Module-import `args` semantics remain unchanged. The
[complete-arguments alternative](./arity-complete-arguments.md) is not a
prerequisite for this proposal's arity construction, and its `withLength`
length pattern is retired. The default-text
obligation above remains regardless of which construction technique is used.

If default parameters are added later, JavaScript's `length` stops before the
first parameter with a top-level default. `['rest']` can still mean the raw
tail starting at that length; later fixed bindings and the source's named
rest binding must then be derived from it. Do not equate EDAG rest with the
source rest binding in that future case or silently admit initializers now.

### Tasks

- [ ] Record language-design approval, including the EDAG/writer change.
      The limit on `length` is approved by `sergey-shandar`
      ([approval](https://github.com/functionalscript/functionalscript/pull/2295#issuecomment-5831266299)).
- [x] Extend source parameter AST, shared grammar and binding. Cover empty,
      rest-only, bare single, parenthesized fixed and fixed-plus-rest forms;
      retain correct grouping, commas, trivia, scopes and early errors.
- [x] Implement the coordinated EDAG change: canonical length metadata,
      constant `['arg', N]` validation and per-invocation `['rest']`. Reject
      negative zero for both metadata fields without normalizing ordinary
      `-0` argument values. Update schema, lowering, analysis, operations,
      executor contexts and native consumers.
- [x] Write and share the factory table, by hand in
      [`fjs/types/function/length`](../../fjs/types/function/length/README.md)
      (generated at first), covering every length the language admits: EDAG
      validation refuses a longer one, so materialization has no separate
      capacity check. Keep unsupported new execution paths refused until they
      preserve length and bindings, without regressing existing
      calls/returns/exports. Add co-located proofs for the table.
- [x] Implement the shared EDAG-derived code-only default renderer and use
      it for represented direct and indirect conversion. Captures use slot
      names and `self` has a finite named-function spelling; source and
      runtime-value serialization retain their separate contracts.
- [ ] Retain the native/AOT semantic EDAG association follow-up in
      [`associate-edag-with-functions.md`](../../fjs/compiler/todo/associate-edag-with-functions.md).
      Ordinary runtime compilation intentionally erases reflection and does
      not require that association for callable exports.
- [x] Update source writers and migrations; remove the old complete-argument
      writer boundary for the new format and document the breaking change.
- [ ] Preserve unresolved-module imports through schema validation, migration
      and linking. Test ordered imports alongside fixed/rest functions, an
      imported value captured in a module-level closure's frame, a nested
      closure capturing its parent's rest, and migration of old zero-arity
      bodies. Reject function-local `args` in the new format and module-local
      `arg`/`rest`; prove linking removes only module import bindings and keeps
      function bindings, import failures and sharing intact.
- [x] Add source -> tokens -> AST -> EDAG -> executor/source round-trip
      proofs against native JavaScript. Cover all supported arities, unused
      parameters, omitted/explicit `undefined`/extra arguments, returning and
      forwarding rest, captured parameters, repeated rest identity and
      distinct calls/callables under each executor's profile. A standalone
      JavaScript factory test is not an FJS pipeline test.
- [x] Prove represented direct/indirect and built-in-method conversion
      against the EDAG renderer, including captures, nested functions and
      `self`: see the
      [conversion proofs](../../fjs/edag/value/convert/proof.f.mjs),
      [function-text proofs](../../fjs/compiler/serializer/function_text/proof.f.mjs)
      and [shared corpus](../../fjs/nanvm/proof.f.mjs).
- [x] Preserve ordinary callable exports, nested returns, arity, callbacks
      and sharing at the reflection-erasing runtime boundary: see
      [runtime conversion proofs](../../fjs/edag/value/to_unknown/proof.mjs),
      [module export proofs](../../fjs/compiler/transpiler/proof.mjs) and
      [native text fixtures](../../nanvm-harness/fixtures/function-text.mjs).
      Host callables retain the host-text exception; these proofs do not
      require overriding their native conversion.
- [x] Add validation refusals for invalid length metadata (negative,
      fractional, non-finite or negative zero), negative-zero/nonconstant/
      out-of-range `arg` indices, `arg` at length zero, duplicate names,
      invalid bindings, misplaced/rest trailing commas, newlines before `=>`,
      and deferred default/destructuring syntax. Test positive-zero metadata
      round trips and preservation of ordinary `-0` arguments.
- [x] Retry the unchanged [`types/range`](../../fjs/types/range/module.f.js)
      compilation candidate: it compiles whole and is a `.f.js` now.
- [ ] Run generation and repository-required checks.
      Move implemented decisions into the current specification/EDAG docs and
      retire the completed TODO without claiming unrelated features landed.

### Related

- [Current functions](../README.md#functions) — accepted syntax today.
- [Arity-cap review](https://github.com/functionalscript/functionalscript/pull/2220#discussion_r4094327220)
  — distinguish executor capacity from language validity; superseded by the
  language's limit on `length`.
- [Default-text review](https://github.com/functionalscript/functionalscript/pull/2220#discussion_r4094801475)
  — EDAG-derived default rendering is required, not optional customization.
- [Export-preservation review](https://github.com/functionalscript/functionalscript/pull/2220#discussion_r4095048191)
  — require rendering without regressing supported callable exports.
- [Negative-zero review](https://github.com/functionalscript/functionalscript/pull/2220#discussion_r4095048215)
  — canonical positive-zero arity and index metadata.
- [Statement-aware compilation](../../fjs/compiler/parser/todo/statement-aware-intrinsics.md)
  — preserve JavaScript syntax and bindings before EDAG admission/lowering.
- [Destructuring](./2450-destructuring.md) — separate binding-pattern work.
- [Function frame](./3111-function-frame.md) — capture semantics.
- [ECMAScript arrow functions](https://tc39.es/ecma262/multipage/ecmascript-language-functions-and-classes.html#sec-arrow-function-definitions)
  — parameter syntax, early errors and function creation.
- [ECMAScript parameter binding](https://tc39.es/ecma262/multipage/syntax-directed-operations.html#sec-runtime-semantics-iteratorbindinginitialization)
  — fixed argument values and rest-array initialization.
