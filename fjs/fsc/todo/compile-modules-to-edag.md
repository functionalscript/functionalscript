## Compile modules to EDAG before loading imports

**Priority:** P2
**Status:** open

**Function support:** the initial rest-only, non-capturing rollout is historical.
The compiler now supports fixed/rest parameters and captures; #2237 uses
`['=>', length, frame, body]`, fixed `['arg', N]` reads and `['rest']`, following
the [parameter plan](../../../spec/todo/3120-parameters.md). The remaining
module-resolution and integration tasks below do not restore the old function
tuple or require rejecting supported captures. Default function-text rendering
remains open in the parameter plan.

### Problem

The current DJS transpiler couples two separate operations:

1. parse a module into `AstModule`;
2. recursively load every imported module and only then evaluate the module body
   with `run(module[1])(args)`.

This means the source-to-computation representation is not available independently
of dependency loading. A source module should be compilable before its imports are
resolved, with imported values represented as parameters of its EDAG.

EDAG alone is not enough to represent an unresolved parsed module: module resolution
also needs the source import specifiers and attributes from that file. Keep that
information in a small temporary wrapper rather than adding module metadata to EDAG itself.

The AST preserves the ordered object-entry representation EDAG requires:
`AstObject` is `['object', members]`, the members in the order written, a
repeated key written twice, and `run` builds the object JavaScript builds from
the same literal. It was a plain object until this task's first step, and
before that it sorted the members through an `OrderedMap`, which the subset law
over the DataJS corpus found and the normalizer's landing fixed (#2028); a
plain object kept the written order of ordinary keys and the last value of a
repeated one, and could
not keep the position of an integer-like key, which JavaScript lists first, or
the duplicates themselves. Conversion to `['{}', [...entry]]` reads the members
as the syntax holds them.

### Proposal

Split module compilation and module resolution, and introduce the missing EDAG/parser
operations in two stages.

This TODO coordinates the **DJS parser/module rollout**; it does not replace the
existing semantic and VM-design TODOs. The canonical EDAG vocabulary and validation
rules are developed in
[`edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md), property and
method-access safety is owned by
[`2330-property-accessor.md`](../../../spec/todo/2330-property-accessor.md), source
functions are in the language
([functions](../../../spec/README.md#functions)) and capture semantics are tracked by
[`3111-function-frame.md`](../../../spec/todo/3111-function-frame.md), and VM-internal
call lowering belongs to
[`9100-call-like-instructions.md`](../../../spec/todo/9100-call-like-instructions.md).
This task should reuse and cross-reference those decisions rather than duplicate them.
The source AST/admission boundary belongs to
[statement-aware compilation](../parser/todo/statement-aware-intrinsics.md).
[Module-resolution compatibility](./module-resolution-compatibility.md) owns the
**P1 correction** to filesystem-based resolution and module identity. The
rollout below records existing work; it does not authorize retaining that defect.

### Stage 1: property access and unresolved modules

**Where it stands.** The EDAG side is there — `['.', object, property]` is in
[`fjs/edag`](../../edag/module.f.mjs)'s schema, `dot`, with the index
restriction below — and so are the unresolved module and its resolution:
[`fjs/fsc/edag`](../edag/module.f.mjs) compiles a parsed module to
`Unresolved { imports, edag }`, anchoring required computations the export does
not reach. `resolve` asks the shared host resolver for the entry and imported
module identities, and memoizes by identity within the link. The Node file
profile supplies canonical file URLs; unsupported classes remain refused as
tracked in the [resolution TODO](./module-resolution-compatibility.md). The binding is done where a reference is lowered — the
importing module is lowered over the imported modules' EDAGs, its parameters
never built — rather than by rewriting a finished `Unresolved`, which would
need a memo keyed by node identity to keep sharing; a cache that stores
`Unresolved` ([cache-compiled-modules](./cache-compiled-modules.md)) is what
would need that rewrite. `fjs compile` writes the linked graph as a DataJS
document when the output name ends with `.edag.data.js` or `.edag.data.mjs`,
and left the other outputs alone. Their names have moved since, and the route
is [`../module.f.mjs`](../module.f.mjs)'s to state: the value outputs are
`.data.js` and `.json`, and every other JavaScript name is the FunctionalScript
writer's. The parser reads `a.b` and `a[key]`
on any value, a numeric literal included, the key a string or a number, `__proto__` and `constructor`
refused at the key, and the lowering carries the access as the EDAG's own
`['.', base, key]`. On the value path an access reads an own property, never
the prototype chain; `undefined` where there is none; and a `null` or
`undefined` base fails the module as JavaScript's throw does, which is what
made `run` fallible. **The basic Stage 1 rollout shipped; module-resolution
compatibility remains an open P1 correction.**

The first missing EDAG operation was property access:

```js
['.', object, property]
```

Introduce `.` into EDAG first. Then introduce the corresponding source syntax into the
DJS parser:

```js
a.b
a[b]
```

Both forms lower to the EDAG `.` operation only when the property operand satisfies the
canonical EDAG property-access restriction from
[`2330-property-accessor.md`](../../../spec/todo/2330-property-accessor.md). The full
EDAG rule permits:

- a permitted **string constant** (not a prohibited prototype-chain name such as
  `constructor` or `__proto__`);
- a **number constant**;
- later, a `Number` node — guaranteed to yield a number, or throw. The EDAG does
  spell unary `+` (`["+", node]`, an `op12`; see `edag-stage1-discussion.md`'s
  "Operators" table), but FunctionalScript does not parse it, and JS's own unary
  `+` throws on a `bigint` rather than converting it, so `Number` is the language's
  one numeric-coercion form and the only coercion an index position admits.

Stage 1 does not introduce `Number`, so its parser/compiler accepts only
the permitted string-constant and number-constant cases. A runtime-computed string,
a prohibited string literal, or any other unsupported property expression is rejected
rather than compiled to `.`. For example, `a.x`, `a['x']`, and `a[0]` can lower to `.`,
while `a['constructor']` and `a[x]` (when `x` is a runtime string value) do not.

This stage is required before EDAG can replace the current AST as the representation of
an **unresolved module**, because module export objects are parameters and default
imports select their `default` property, for example:

```js
['.', ['.', ['args'], 0], 'default']
```

#### Temporary `Unresolved`

Compile each FunctionalScript source module **without loading its imports**.
The JavaScript-subset AST must pass checked AST-to-EDAG compilation; merely
parsing a function or a protected operation does not admit it. Import records
remain unresolved while local binding, early-error and FJS checks are applied.

Use the temporary representation:

```ts
type Unresolved = {
    readonly imports: readonly AstImport[]   // { specifier, json }
    readonly edag: EDAG
}
```

`imports` is an **array of import records, not a map**: each is the specifier as
written and whether the import carries `with { type: "json" }` — see
[`ast/types.ts`](../ast/types.ts). Preserve this declared module type for the
resolver/loader to validate under the host contract, even on cache hits. Its order
defines the import parameter positions in `edag`. `edag` is the parameterized computation for the module,
with the complete module export object as its root/result
([named and default exports](../../../spec/README.md#exporting-a-value)).

`Unresolved` is a compiler/loading structure only. It is **not part of EDAG**, and
import specifiers and resolved loading locations must not be embedded into EDAG
merely to make an unresolved module self-contained.

For example:

```js
import a from './a.f.js'

const x = [a, 1]
export default { x: x, y: x }
```

can compile conceptually to:

```js
const args = ['args']
const a = ['.', ['.', args, 0], 'default']
const x = ['[]', [a, 1]]
const value = ['{}', [
    [':', 'x', x],
    [':', 'y', x],
]]
const edag = ['{}', [[':', 'default', value]]]
```

with temporary unresolved metadata:

```js
{
    imports: [{ specifier: './a.f.js', json: false }],
    edag,
}
```

`x` is one shared EDAG node, so both object properties reference the same constructed
array. DJS `const` is serialization-level sharing, not an EDAG operation.

Stage 1 must also preserve the current module body's failure behavior. The current
`run` evaluates every body entry, including a `const` whose value is not reachable from
`export default`. For example:

```js
const check = null.x
export default 1
```

must not silently become the successful EDAG constant `1`. The `','` operation anchors
it: the module lowers to
`[',', [['.', null, 'x'], ['{}', [[':', 'default', 1]]]]]`, every operand evaluated
and the last one's value taken, so the failure stays in the graph. The operands
before the result are the **roots** of the part the export does not reach — an unreached `const`
another unreached `const` reaches is anchored through it, since an operand a sibling
reaches is a redundant anchor — in source order, and a module the export reaches
entirely has no `','` at all.

The same rule holds across a **module boundary**. The transpiler loads and evaluates
every imported module before running the importing module body, even when the imported
binding is never referenced, so an import parameter the export does not reach is
anchored the same way, and the linker puts the imported module's EDAG in its place.
This is deliberately a reachability rule, not an effect analysis: nothing inspects
whether the anchored part happens to throw, so the EDAG's shape does not depend on any
analysis's precision.

Persisting unresolved values under `.fjs/unresolved/` and using them for incremental
compilation is deliberately a separate task; see
[`cache-compiled-modules.md`](./cache-compiled-modules.md).

#### Resolve unresolved modules to one EDAG

Recursively resolve `Unresolved.imports` through the shared
[module-resolution contract](./module-resolution-compatibility.md):

```text
importer identity + source specifier + import attributes
    → declared host resolver → resolved module identity
    → loading location and reader
```

Validate module types/import attributes under that contract before reusing a
module or selecting its reader. For filesystem loading, convert the resolved
URL to a path only at that boundary; the current raw-specifier/path-extension
checks are not the target algorithm. Each loaded JavaScript source passes
checked compilation to its own temporary `Unresolved`; resolve its dependencies
relative to its resolved identity. JSON is read as data and has no imports.

A bare specifier such as `pkg` uses the declared host's package/import-map rules
or is explicitly refused until that class is supported. It is never treated as
a sibling filesystem path. Unsupported URL forms or attributes are refused,
not silently normalized into another meaning. The CLI's root filesystem input
also needs a host module identity before resolving its imports.

Resolution binds the imported modules' export objects to the corresponding import
parameter positions; default bindings select `.default`. The current linker lowers
over those selected computations directly, preserving their evaluation anchors and
sharing. Imported JSON exposes `{ default: document }` at this boundary. The import
array order remains significant: position `i` in `imports` corresponds to import
parameter `i` in the EDAG.

**Import binding is scope-aware.** At module scope, `['args']` is the import-parameter
array described above. In `['=>', length, frame, body]`, only `body` opens a new
invocation scope: it reads fixed positions through `['arg', N]` and its tail through
`['rest']`. Function-local `['args']` is invalid. Module linking must not substitute
import parameters inside that body. The `frame` operand belongs to the enclosing
scope, so linking must still reach import reads used to construct a captured frame.
Nested frame expressions can instead capture their enclosing function's fixed/rest
bindings. Import reachability checks use the same ownership; `length` is metadata,
not an expression to traverse.

One link operation must memoize resolved modules by the **resolved module
identity** supplied by that contract, not by their loading path or source hash.
The same identity must govern in-progress/cycle tracking. Different accepted
spellings of one identity, including diamond imports, reuse the same resolved
EDAG. Distinct identities supplied by a host remain distinct.
Import-attribute validation still applies to each
request; a memo hit cannot bypass it.

EDAG sharing affects exported array/object identity. Preserve the sharing
required within one module instance without conflating distinct instances.
The optional `.fjs/unresolved/` cache reuses compiled templates, not module
instances; identical cached source can resolve its imports differently under
different importer identities. Warm and cold linking use the same resolver
contract. No resolved module identity or loading metadata is added to EDAG.

After all module dependencies are resolved, the temporary unresolved wrappers
disappear. The **final compilation result is an EDAG, not an `Unresolved`**:

```text
source module
  -> Unresolved { imports, edag }
  -> recursively resolve imported Unresolved values
  -> EDAG
```

The resulting EDAG contains the complete compiled program and no unresolved module
paths or temporary unresolved metadata.

### Stage 2: functions and calls

**Current status:** function creation, ordinary/method calls and capture lowering are
implemented. The original Stage 2 admitted only non-capturing rest-only arrows with a
`null` frame. That rollout restriction is historical; it is not the current parser
or interpreter contract. Fixed-only and mixed fixed/rest syntax is implemented in
#2237, with defaults and destructuring left to separate work.

The current function operation is:

```js
['=>', length, frame, body]
```

`length` is canonical nonnegative integer metadata: zero must be positive zero.
`['arg', N]` reads a fixed position with canonical integer `0 <= N < length`;
a missing supplied value is `undefined`. `['rest']` is the one array of arguments
after the fixed prefix for that invocation, including an empty tail. Repeated reads
reuse that array. Module-import `['args']` remains separate.

For example, these non-capturing functions have a `null` frame:

```js
const restOnly = ['=>', 0, null, ['rest']] // (...a) => a
const fixedAndRest = ['=>', 2, null, ['[]', [['arg', 0], ['arg', 1], ['rest']]]] // (a, b, ...tail) => [a, b, tail]
```

`frame` remains a general expression in the schema. The compiler constructs captured
values in the enclosing scope and the body reads them through `['frame']`; it does
not share an enclosing operation node directly into the body's scope. Capture
lowering and its proofs are in [`../edag`](../edag/module.f.mjs) and
[`../edag/proof.f.mjs`](../edag/proof.f.mjs) (`captures`), with fixed/rest captures in
[`../parameters/proof.f.mjs`](../parameters/proof.f.mjs). Frame semantics remain owned by
[`3111-function-frame.md`](../../../spec/todo/3111-function-frame.md).

Calls keep their existing array-valued argument operand:

```js
['()', object, args]                       // f(...args)
['.', object, property, ['|()', args]]     // o.p(...args)
```

There are two call spellings and the receiver is what tells them apart. `()` is the
ordinary call: its callee is an ordinary expression and it keeps no `this`. A method
call is instead the **property-access node owning its call** — the `'|()'` step in a
`.` node's continuation is what carries the `this` binding, which no `()` node can.
See "Chains" in [`../../edag/README.md`](../../edag/README.md). Stage 2 needs neither
optional node (`?.`, `?.()`) nor any of the other three steps, since optional chaining
is not in its source subset; a plain property read is `['.', object, property]`.

The property operand of a `.` node carrying a `'|()'` step follows **the same canonical
safety restriction as `.`** with no continuation.
In this stage that means a permitted string constant or number constant; prohibited
names, runtime-computed strings, and other unsupported property expressions are
rejected. This is the EDAG form of the method-call distinction and safety rules already
described by
[`2330-property-accessor.md`](../../../spec/todo/2330-property-accessor.md). The
VM-specific lowering of these call forms is separate work in
[`9100-call-like-instructions.md`](../../../spec/todo/9100-call-like-instructions.md).

This stage is intentionally after Stage 1: property access is the minimum operation
needed for unresolved-module parameter access, while function creation and calls extend
the set of source modules that can be represented after that basic module pipeline is
in place. Capture support subsequently extended that initial rollout.

### EDAG forms used by these stages

The current compiler uses these structural forms for the staged work:

- primitive constants directly: `null`, boolean, number, string, `bigint`
  (`undefined` is `['undefined']`, not a bare constant — see
  `edag-stage1-discussion.md`'s "Structural operations" table);
- object constructors: `['{}', [...entry]]`, where the initial entry form is
  `[':', key, value]` and **`key` is a string constant** in this task, matching what
  the current DJS parser produces;
- array constructors: `['[]', [...node]]`;
- the unresolved module's ordered import array: `['args']`;
- function invocation bindings: fixed `['arg', N]` and the per-invocation `['rest']`;
- Stage 1 property access: `['.', object, property]`, with the restricted
  property operands described above — the absent fourth operand is the continuation,
  and leaving it out says the receiver this access produced is dropped;
- functions: `['=>', length, frame, body]`, using `null` when no frame is needed;
  captured-frame expressions belong to the enclosing scope and `['frame']` reads
  their value inside the body;
- Stage 2 calls: `['()', callee, args]` for an ordinary call, and
  `['.', object, property, ['|()', args]]` for a method call, with the property
  operand using the same restriction as `.`;
- semantic sharing by node identity, serialized with DJS `const` references when
  needed.

A function body is its own EDAG scope. Validation must reject an operation-node identity
that is shared across a function boundary (for example, the same constructor node used
both outside a function and as a node in its body). Otherwise per-invocation evaluation
could give one semantic node multiple runtime values. Normal sharing remains valid
inside one function body. Capture lowering preserves that separation through frame
values; validation must enforce the same rule for arbitrary public EDAG input.

The object constructor is an ordered operation rather than a plain EDAG object. This
preserves source property order and leaves room for future entry forms such as object
spread, for example `['...', object]`. Validation already admits computed
object-constructor key nodes: `[':', key, value]`'s `key` position is ordinary `exp`,
not narrowed to a string constant — see
[`edag-stage1-discussion.md`, subject 4](../../../todo/edag-stage1-discussion.md#4-object-constructor-ordered-entries).
This task's Stage 1 compiler only emits string-constant keys, matching what the
current DJS parser produces, but that is a property of the compiler, not of
validation. Plain objects have no EDAG meaning here and remain reserved for a future
use.

Object-entry descriptors such as `[':', key, value]` are structural operands of the
object constructor, not independently evaluated EDAG nodes: nothing evaluates a
descriptor as a value, so no running program can observe whether one was reused by
reference across entries or merely built twice with equal content. Validation does
**not** check descriptor-array identity — see
[`edag-stage1-discussion.md`, subject 4](../../../todo/edag-stage1-discussion.md#4-object-constructor-ordered-entries)
for why a rule like that cannot be stated the same way on a content-addressed VM (which
interns equal descriptors unconditionally, authored sharing or not) and a
non-content-addressed one (which never does), so it isn't a validation rule at all.
Sharing of the descriptor's `key` and `value` EDAG nodes remains normal semantic EDAG
sharing.

The original two-stage scope did not include later operator and capture work.
That historical boundary is not a current admission rule: comma anchoring and
capture lowering are already used above. Separate language/operator tasks continue
to own their extensions; this TODO does not authorize unrelated additions.

### Number parsing and serialization

DJS `.f.js` must round-trip every admitted JavaScript `number` value needed by EDAG. In
particular, the DJS parser and serializer must explicitly support:

```text
Infinity
-Infinity
NaN
-0
```

This is a **DJS-specific representation requirement**, not a decision about standard
JSON. The standard FunctionalScript JSON codec already has its own P3 policy TODO,
[`number-edge-cases.md`](../../media/json/todo/number-edge-cases.md), covering these
same runtime values under the stricter requirement that output remain JSON. Do not
resolve that TODO implicitly by changing shared JSON behavior for DJS.

The current DJS serializer reuses JSON serialization primitives, so ordinary
`JSON.stringify(number)` cannot be the DJS fallback for these values: it serializes
non-finite values as `null` and loses the sign of `-0`. Add DJS-specific handling so
the chosen `.f.js` spellings parse back to the exact values. If common parser/serializer
machinery is extracted, coordinate with [`157-json-djs-shared-value-machine.md`](../../media/json/todo/157-json-djs-shared-value-machine.md), which already owns the
JSON/DJS structural deduplication; codec policy remains separate.

The exact tests must distinguish the edge cases semantically:

- `Object.is(roundTrip(-0), -0)`;
- `Number.isNaN(roundTrip(NaN))`;
- `roundTrip(Infinity) === Infinity`;
- `roundTrip(-Infinity) === -Infinity`.

This parser/serializer support is required independently of module-to-EDAG conversion,
because `.f.js` is the general representation used to persist EDAG and unresolved
artifacts.

**Where the work lands.** Not in the old `fjs/djs`. The spellings and their grammar are
settled in [`spec/datajs/README.md`](../../../spec/datajs/README.md) — `NaN`,
`Infinity` and `-Infinity` are *words*, and `infinity ::= '-'? 'Infinity'` carries
the sign the way `number` and `bigint` already do. There is no exclusion list to
implement alongside them: DataJS names begin with `$`, so `$NaN` and
`$undefined` are ordinary names and the three words are unreachable as bindings
by the grammar rather than by a rule. Excluding them is **FunctionalScript's**
policy, whose identifiers have no `$` requirement — implementing the spec was
[`fjs/media/datajs`](../../media/datajs/README.md)'s, with the reserved-word
half the front end's once it had moved. Patching `fjs/djs` for these four
values would have been reworked by that migration, so the tasks below were the
requirement, not an instruction to implement them there.

Measured against the current implementation, so the gap is on record rather than
rediscovered:

| value | parser | serializer |
|---|---|---|
| `-0` | preserves it — `Object.is(v, -0)` is `true` | emits `-0` |
| `NaN` | `NaN` | `NaN` |
| `Infinity` | `Infinity` | `Infinity` |
| `-Infinity` | the prefix and `Infinity`, `['-', Infinity]` | `-Infinity` |

**All four are done**, with the front end's move, and pinned end to end in
`fjs/fsc/proof.f.mjs`. `-0` was serializer-only,
which is easy to miss because `String(-0)` is `"0"` and only `Object.is`
separates them. `NaN` and `Infinity` are reserved words with their own
token kinds, read as primitives by the grammar; `-Infinity` is the prefix
operator applied to one of them, which the lowering folds back into the
leaf, so the graph holds the number either way.

### Existing compile API boundary

The EDAG-producing path remains separate from the evaluated-value path. Its
artifact is a computation graph, not a value that `transpile` callers should
accidentally serialize as a module result.

The original Stage 1 promise to preserve the bare exported value is superseded
by [#2129](https://github.com/functionalscript/functionalscript/pull/2129), the
prerequisite for [named exports](../../../spec/README.md#exporting-a-value).
`transpile` still returns a `Denotation`, but for a FunctionalScript input its
`value` is now the complete module export object, including named properties and `default` when present.
The linked EDAG and generated Rust compute that same object. JSON and DataJS
value output serialize `result.default`; FunctionalScript output writes the
individual `export const` declarations and a final `export default` when present. Direct `.json` roots remain documents and bypass
both wrapping and projection, even if the document has a `default` property.

After the baseline interpreter exists, [`interpret-edag.md`](./interpret-edag.md)
owns the migration of the evaluated-value path to:

```text
source modules
  -> final EDAG
  -> interpret EDAG
  -> module export object
  -> select result.default for JSON/DataJS value output
  -> existing value serialization
```

That migration changes the internal execution path while preserving this updated
public result and output contract, including the direct JSON document path.

### Final EDAG serialization

The final EDAG is serialized as a DataJS document, `<name>.edag.data.js` (or
`.edag.data.mjs`), through `fjs/media/datajs/serializer`, which hoists a shared
node as a `const`. No JSON form of the EDAG is offered: JSON cannot hold a
shared node, and an EDAG's sharing is its meaning. The `.js`/`.mjs` outputs are
the FunctionalScript writer's, not an EDAG serialization. The standard JSON
codec's own number policy remains defined by
[`number-edge-cases.md`](../../media/json/todo/number-edge-cases.md).

Executing the final EDAG is a separate concern. Direct EDAG interpretation,
compilation of EDAG to executable functions, and execution policy can be layered on
top of the resulting EDAG.

Resource/time/memory hardening of EDAG processing is intentionally separate from this
task; see [`bound-edag-interpreter-resources.md`](./bound-edag-interpreter-resources.md).

### Tasks

#### Stage 1

- [x] Introduce `['.', object, property]` into EDAG and its validation/type schema,
      enforcing the canonical property-operand restriction: permitted string constants,
      number constants, and only later the `Number` numeric-conversion node once it
      exists. Done in [`fjs/edag`](../../edag/module.f.mjs): `dot` over `index`,
      which is a string, a number, or a `Number` cast.
- [x] Introduce parser support for `a.b` and `a[b]`, compiling only permitted Stage 1
      static-string/number property cases to `.`, and reject runtime-computed strings,
      prohibited property names, and other unsupported property expressions. Done:
      the grammar admits an access after any value, its key an identifier,
      a string or a number, so a runtime key is refused at the token, and an
      access on a numeric literal is read as JavaScript reads it, `-1 .x`
      being `-(1 .x)`; the fold
      refuses `__proto__` and `constructor` in either spelling; the AST and the
      lowering carry `['.', base, key]`.
- [x] Give a property access its value on the value path — `run`, and so
      `transpile` and `fjs compile`'s module and JSON outputs. Done: an own
      property read, the prototype chain never (the spec's rule, where JavaScript
      reads `a.toString` as a function); `undefined` for a missing member, as
      JavaScript; a `null` or `undefined` base fails the module, as JavaScript
      throws — `run` returns a `Result` now, and `fjs compile` reports the failure
      against the input; and the sharing sweep reads an access by its keys — two
      references share a node when one's keys are the other's or a prefix of
      them and the node is a container, which the values say — so
      `{ x: cfg.a, y: cfg.b }` is a tree and `[cfg.a, cfg.a]` is not. Pinned in
      `fjs/fsc/proof.f.mjs` (`access`) and `fjs/fsc/ast/proof.f.mjs`. Left
      coarse, in the safe direction: a module whose own value holds a shared
      node is shared under any route an importer takes into it, and the
      modules it reaches count under any route too, since the sweep does not
      carry where in the module's value a node sits; the precise answer there
      is an identity walk of the selected sub-value, which the sweep exists
      not to make.
- [x] Define the temporary `Unresolved` type as `{ imports, edag }`; keep it outside
      the EDAG schema. Done: [`fjs/fsc/edag/types.ts`](../edag/types.ts).
- [x] Keep `Unresolved.imports` as a source-ordered array of import records — the
      specifier and the `json` flag of `with { type: "json" }` — not a map, and make
      import parameter positions correspond to its indices. Done; pinned by
      `parameters` in [`fjs/fsc/edag/proof.f.mjs`](../edag/proof.f.mjs).
- [x] Change the DJS parser/AST object representation to retain an ordered entry list
      until EDAG conversion; do not collapse duplicate keys or reorder integer-like
      keys through a plain JavaScript object/`OrderedMap` representation. Done:
      `AstObject` is `['object', members]`, pinned by `membersAsWritten` in
      `fjs/fsc/parser/proof.f.mjs`.
- [x] Convert a parsed source module to `Unresolved { imports, edag }` without reading
      or resolving any imported module. Done: `unresolved` in
      [`fjs/fsc/edag`](../edag/module.f.mjs), a function of the AST alone.
- [x] Do not silently drop required body evaluation: a `const` the export does not
      reach is anchored by the `','` operation, whatever it holds. Done as a
      reachability rule, `anchors` in [`fjs/fsc/ast`](../ast/module.f.mjs): the roots
      of the unreached part are the operands before the export.
- [x] Do not silently discard eager imported-module evaluation just because the
      binding is unused: an import parameter the export does not reach is anchored the
      same way, and the link puts the imported module's EDAG there. Done; pinned by
      `anchored` in [`fjs/fsc/edag/proof.f.mjs`](../edag/proof.f.mjs).
- [x] Replace `['aref', i]` with `['.', ['args'], i]` and replace `cref` sequencing
      with shared EDAG node identity. Done: one parameter node per import, one node
      per `const`, pinned by `example`, `chain` and `parameters` in the proof.
- [x] Resolve imported `Unresolved` values recursively and bind each resolved result
      to the corresponding **module-scope** import parameter position; when Stage 2
      functions exist, do not descend into nested `=>` bodies while substituting imports.
      Done: `resolve` in [`fjs/fsc/edag`](../edag/module.f.mjs) binds where a
      reference is lowered, so no substitution descends into anything; a
      function body, when there is one, is lowered by the same rule.
- [x] Apply the same function-scope boundary to module-import reachability checks so
      nested fixed/rest bindings are never interpreted as import parameters, while
      enclosing-scope import reads in captured frames remain reachable.
      Done by construction: reachability is read from the syntax (`unreached`), where
      an import is an `aref`, never from `['args']` nodes.
- [x] Add per-link memoization for repeated/diamond imports, pinned by
      `resolve.diamond` in [`fjs/fsc/edag/proof.f.mjs`](../edag/proof.f.mjs).
      Memo keys and cycle tracking now use host-resolved identities; the Node
      file profile supplies canonical file URLs for roots and dependencies.
- [x] Remove the temporary `Unresolved` layer after resolution so the root compilation
      result is a plain EDAG with no unresolved module paths or temporary metadata.
      Done: `resolve` returns an `Exp`.
- [x] Add a distinct EDAG-producing compiler path/API alongside the current
      value-producing transpiler; do not redirect existing `transpile` / `fjs compile`
      callers until EDAG execution is available. Done: `resolve` beside `transpile`,
      and in `fjs compile` an output name ending with `.edag.data.js` or `.edag.data.mjs`
      selects it, as `.json` selects the JSON writer; the other outputs were as they
      were. (The FunctionalScript output has taken the plain `.js` names since.)

#### Stage 2

- [x] Use the current `['=>', length, frame, body]` schema, with `frame` a general
      `exp`, `['frame']` a separate node, and fixed/rest invocation bindings.
      Metadata and binding validation are owned by
      [`fjs/edag/analysis`](../../edag/analysis/module.f.mjs).
- [x] Lower both non-capturing functions (`null` frame) and captured values through
      enclosing-scope frame expressions. The original null-only restriction is
      superseded by `captures` in [`../edag/proof.f.mjs`](../edag/proof.f.mjs).
- [x] Parse empty, rest-only, fixed-only and mixed fixed/rest arrows. The original
      rest-only rollout is superseded by #2237; syntax, missing values, captures and
      rest identity are pinned in [`../parameters/proof.f.mjs`](../parameters/proof.f.mjs).
- [x] Validate that a nested function body is a disjoint EDAG scope: operation nodes
      must not be shared across a function boundary, while sharing within the body is
      preserved. Done by construction: a body names its own fixed/rest bindings and
      frame slots rather than enclosing operation nodes; pinned by `func` and
      `captures` in [`fjs/fsc/edag/proof.f.mjs`](../edag/proof.f.mjs).
- [x] `['()', callee, args]` and the `['|()', args]` step a `.` node carries for
      a method call are in the EDAG validation/type schema (`fjs/edag/`), shape only —
      the property-operand restriction below is this stage's own work.
- [x] Convert the corresponding parser call expressions to the EDAG call forms — `()`
      for an ordinary call, a `.` node with a `['|()', args]` continuation for a
      method call; reject prohibited or runtime-computed string properties in that
      node rather than bypassing the property-access safety rule. Done: the grammar
      takes a call as a step after a value, the callee picks the form in
      [`../edag/module.f.mjs`](../edag/module.f.mjs)'s `call`, and a method call's
      property is the access's, judged by the call rule rather than the read rule:
      a name on `fjs/js/prototype`'s `prohibitedCalls` is refused, `a.push(1)` as
      `prohibited member function`, and every other prototype name is a member
      function the VM answers by the receiver's type, so `a.toString()` compiles
      where `a.toString` is refused
      ([`fjs/js/prototype/README.md`](../../js/prototype/README.md)). Grouping the
      access is no way around either rule: `(a.b)(c)` keeps the receiver and is
      that same method call, while the detached `(0, a.b)(c)` waits on the comma
      operator.
- [x] Add proofs for non-capturing nested functions and ordinary/method calls in the
      supported Stage 2 subset, including accepted static/numeric method-call
      properties and rejection of prohibited/runtime-computed string properties. Done:
      `call` in [`../parser/grammar/proof.f.mjs`](../parser/grammar/proof.f.mjs),
      `func.call` and `func.callRefused` in [`../parser/proof.f.mjs`](../parser/proof.f.mjs),
      `call` in [`../edag/proof.f.mjs`](../edag/proof.f.mjs) and in
      [`../proof.f.mjs`](../proof.f.mjs).
- [ ] Whenever optional chaining enters the source subset, lower chain boundaries per
      "Chains" in [`../../edag/README.md`](../../edag/README.md), with proofs over the
      spellings the `chains` section of
      [`../../edag/proof.f.mjs`](../../edag/proof.f.mjs) pins — among them `a?.b.c`
      against `(a?.b).c`, `a?.b(d)` against `(a?.b)(d)`, and `(a?.b.c)(d)` against
      `(a?.b).c(d)`. Grouping has landed, and it is where those pairs differ: a group
      ends a chain's lazy region, so the second of each pair is a group whose steps
      run whatever the `?.` found. Until `?.` is in the subset a group is transparent
      and both sides of each pair are one node, which is the answer the lowering has
      to keep for the non-optional spellings while it splits the optional ones.
- [x] Add a scope-aware linking proof such as
      `import y from './y.f.js'; export default [y, (...x) => x]`: resolving `y` must not
      rewrite the nested function body's `['rest']`. Done, in `func` of
      [`fjs/fsc/edag/proof.f.mjs`](../edag/proof.f.mjs); `importsAndCaptures` in
      [`../parameters/proof.f.mjs`](../parameters/proof.f.mjs) also executes linked
      fixed/rest closures under Amnesia and memo.
- [x] Add a validation proof that reusing one operation node both outside and inside a
      nested function body is rejected. Done: `throw` in
      [`fjs/edag/analysis/proof.f.mjs`](../../edag/analysis/proof.f.mjs)
      (`outsideThenInside`, `insideThenOutside`, `siblingBodies`).

#### Shared/final

- [x] Add explicit **DJS** parser support for the chosen `.f.js` spellings of
      `Infinity`, `-Infinity`, `NaN`, and `-0`.
- [x] Add DJS-specific number serialization that the DJS parser round-trips to exactly
      `Infinity`, `-Infinity`, `NaN`, and `-0`; do not change the standard JSON codec's
      policy as a side effect of this task.
- [x] Serialize the final EDAG to a JavaScript module through the EDAG-producing
      artifact path; allow JSON output only when it preserves the EDAG completely.
      Done for the DataJS form, through `fjs/media/datajs/serializer`, which hoists a
      shared node as the DataJS output does; no JSON form of the EDAG is offered,
      since JSON cannot hold a shared node and an EDAG's sharing is its meaning. The
      name is `.edag.data.js` since the output route landed.
- [x] Add the EDAG artifact alongside the evaluated-value path. Stage 1 preserved
      the existing output; #2129 subsequently changed module results to export
      objects while keeping CLI value/source output stable. The future
      `interpret-edag.md` migration must preserve the updated
      [compile API boundary](#existing-compile-api-boundary), including direct JSON
      roots. Pinned side by side in `fjs/fsc/proof.f.mjs` (`moduleBoundary`,
      `edagOutput`).
- [x] Preserve current missing-file, parse-error, and circular-dependency behavior.
      Done: the linker reads through the transpiler's reader and reports the same
      `ParseError`; pinned in `fjs/fsc/edag/proof.f.mjs` (`resolve.refused`).
- [x] Stage 1 proofs, in [`fjs/fsc/edag/proof.f.mjs`](../edag/proof.f.mjs) unless
      named otherwise: `a.b`, `a['x']` and `a[0]` produce property-access EDAGs and
      prohibited names are refused (`access`; the runtime-computed key is refused by
      the grammar, `access` in [`fjs/fsc/parser/grammar/proof.f.mjs`](../parser/grammar/proof.f.mjs));
      `unresolved` is a function of the AST alone and import positions follow the
      source (`parameters`); object-entry order, integer-like and duplicate keys
      included, survives to the EDAG (`membersAsWritten` in
      [`fjs/fsc/parser/proof.f.mjs`](../parser/proof.f.mjs), `shadowed`); a linked
      program is one EDAG with no module metadata (`resolve`). (Object-entry keys are
      not restricted to string constants — see `edag-stage1-discussion.md` subject 4 —
      and entry-descriptor identity is not checked — see the same subject — so neither
      is pinned.)
- [x] `const n = null; const check = n.x; export default 1` is not compiled to the
      constant `1`: it is `[',', [['.', null, 'x'], ['{}', [[':', 'default', 1]]]]]`,
      and `fjs compile` retains the failing read in EDAG and FunctionalScript output
      while its value outputs fail on that read. Pinned by `anchored` here and in
      [`fjs/fsc/proof.f.mjs`](../proof.f.mjs).
- [x] An unused import is not discarded: `import b from './b.f.js'; export default 1`
      anchors `b`'s selected computation before `{ default: 1 }`, so a failure
      in `b.f.js` cannot disappear.
      Pinned by `resolve.anchored`.
- [x] A diamond resolves one module identity once and both paths bind the same
      EDAG node. Pinned by `resolve.diamond`, `resolve.bound`, and
      `moduleSharing`/`hostIdentities` in
      [`transpiler/proof.f.mjs`](../transpiler/proof.f.mjs). Native ESM identity
      comparisons belong to the [Node adapter proofs](../../effects/node/proof.mjs).
- [x] `-0`, `NaN`, `Infinity` and `-Infinity` round-trip through DataJS, and the JSON
      writer refuses what JSON cannot spell rather than approximating. Pinned in
      [`fjs/fsc/proof.f.mjs`](../proof.f.mjs) (`specialNumbers`, the `jsonRefused`
      cases) and [`spec/README.md`](../../../spec/README.md#output).

### Related

- [GitHub issue #407](https://github.com/functionalscript/functionalscript/issues/407)
  — the original "Parser Structure" report: source to an AST, the AST to code
  and to values. Its API sketches are superseded by the pipeline above.
- [Module-resolution compatibility](./module-resolution-compatibility.md) —
  P1 owner of shared host resolution, module identity, loading and regressions.
- [`fjs/fsc/transpiler/module.f.mjs`](../../fsc/transpiler/module.f.mjs) — currently loads imports
  recursively before calling `run(module[1])(args)`; keep its value-producing public
  contract until EDAG interpretation is integrated.
- [`fjs/fsc/parser/module.f.mjs`](../../fsc/parser/module.f.mjs) — DJS parser that must support the
  chosen special-number `.f.js` spellings.
- [`fjs/media/datajs/serializer/module.f.mjs`](../../media/datajs/serializer/module.f.mjs)
  — the writer, where special-number handling lives.
- [`../../media/json/serializer/module.f.mjs`](../../media/json/serializer/module.f.mjs)
  — shared JSON serialization primitives currently reused by DJS; DJS-specific number
  syntax must not silently change standard JSON behavior.
- [`../../media/json/todo/number-edge-cases.md`](../../media/json/todo/number-edge-cases.md)
  — existing owner of the standard FunctionalScript JSON policy for `-0`, `NaN`, and
  infinities.
- [`157-json-djs-shared-value-machine.md`](../../media/json/todo/157-json-djs-shared-value-machine.md) — existing JSON/DJS serializer deduplication task.
- [`fjs/fsc/ast/types.ts`](../../fsc/ast/types.ts) — current `AstModule`/`AstBody`, `aref`, `cref`,
  and plain-object representation to replace.
- [`fjs/fsc/ast/module.f.mjs`](../../fsc/ast/module.f.mjs) — current sequential AST evaluator.
- [`cache-compiled-modules.md`](./cache-compiled-modules.md) — lower-priority
  persistence/incremental-compilation task for `.fjs/unresolved/{hash}.f.js`.
- [`fjs/edag/rust/module.f.mjs`](../../edag/rust/module.f.mjs) — the
  Rust output of the `=>`/`()` shapes Stage 2 here lowers: a closure bound
  through `IStaticFunction`, and `Any::call`.
- [`interpret-edag.md`](./interpret-edag.md) — separate baseline direct-interpreter
  execution strategy for the final EDAG and later integration behind the existing
  value-producing transpile/compile API.
- [`bound-edag-interpreter-resources.md`](./bound-edag-interpreter-resources.md) —
  lower-priority resource/time/memory hardening for EDAG processing.
- [`associate-edag-with-functions.md`](./associate-edag-with-functions.md) —
  low-priority note on compiling an EDAG to an executable function while retaining
  its semantic EDAG. Embedded metadata versus lookup remains open;
  `edagAdd` / `edagGet` Effects are a candidate only if lookup is selected.
- [`todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md) — EDAG
  semantics and structural operations.
- [`fjs/edag/README.md`](../../edag/README.md) — the canonical EDAG schema.
- [`spec/todo/2330-property-accessor.md`](../../../spec/todo/2330-property-accessor.md)
  — property/method-access safety rules reused by `.` and the property chain steps.
- [`spec/README.md`](../../../spec/README.md#functions) — source-level
  function support, which is in the language.
- [`spec/todo/3111-function-frame.md`](../../../spec/todo/3111-function-frame.md) —
  captured-frame semantics; the original non-capturing Stage 2 restriction is historical.
- [`spec/todo/3120-parameters.md`](../../../spec/todo/3120-parameters.md) —
  implemented fixed/rest bindings and the remaining migration/default-text work.
- [`spec/todo/9100-call-like-instructions.md`](../../../spec/todo/9100-call-like-instructions.md)
  — VM-internal call lowering, separate from stable EDAG call syntax.
