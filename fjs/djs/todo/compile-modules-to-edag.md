## Compile modules to EDAG before loading imports

**Priority:** P2
**Status:** open

### Problem

The current DJS transpiler couples two separate operations:

1. parse a module into `AstModule`;
2. recursively load every imported module and only then evaluate the module body
   with `run(module[1])(args)`.

This means the source-to-computation representation is not available independently
of dependency loading. A source module should be compilable before its imports are
resolved, with imported values represented as parameters of its EDAG.

EDAG alone is not enough to represent an unresolved parsed module: module resolution
also needs the module paths imported by that source file. Keep that information in a
small temporary wrapper rather than adding module metadata to EDAG itself.

The current parser/AST also cannot preserve the ordered object-entry representation
required by EDAG. Object parsing accumulates properties in an `OrderedMap` with
`setReplace` and eventually produces a plain `AstObject`; duplicate keys are therefore
collapsed and integer-like keys can lose their written order before EDAG conversion.
This task must preserve object entries as an ordered sequence in the parser/AST until
they are converted to `['{}', ...entry]`.

### Proposal

Split module compilation and module resolution, and introduce the missing EDAG/parser
operations in two stages.

This TODO coordinates the **DJS parser/module rollout**; it does not replace the
existing semantic and VM-design TODOs. The canonical EDAG vocabulary and validation
rules are developed in
[`edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md), property and
method-access safety is owned by
[`2330-property-accessor.md`](../../../spec/todo/2330-property-accessor.md), source
function support and later captures are tracked by
[`3110-function.md`](../../../spec/todo/3110-function.md) and
[`3111-function-frame.md`](../../../spec/todo/3111-function-frame.md), and VM-internal
call lowering belongs to
[`9100-call-like-instructions.md`](../../../spec/todo/9100-call-like-instructions.md).
This task should reuse and cross-reference those decisions rather than duplicate them.

### Stage 1: property access and unresolved modules

The first missing EDAG operation is property access:

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
- later, a `Number` node — guaranteed to yield a number, or throw. The EDAG has no
  unary `+` operator (see `edag-stage1-discussion.md`'s "Operators" table): JS's own
  unary `+` throws on a `bigint` rather than converting it, so `Number` is the
  language's one numeric-coercion form.

Stage 1 does not introduce `Number`, so its parser/compiler accepts only
the permitted string-constant and number-constant cases. A runtime-computed string,
a prohibited string literal, or any other unsupported property expression is rejected
rather than compiled to `.`. For example, `a.x`, `a['x']`, and `a[0]` can lower to `.`,
while `a['constructor']` and `a[x]` (when `x` is a runtime string value) do not.

This stage is required before EDAG can replace the current AST as the representation of
an **unresolved module**, because imported values are parameters and module EDAGs need
to access those parameters, for example:

```js
['.', ['args'], 0]
```

#### Temporary `Unresolved`

Compile each FunctionalScript source module **without loading its imports**.

Use the temporary representation:

```ts
type Unresolved = {
    readonly imports: readonly string[]
    readonly edag: EDAG
}
```

`imports` is an **array of module paths, not a map**. Its order defines the import
parameter positions in `edag`. `edag` is the parameterized computation for the module,
with `export default` as its root/result.

`Unresolved` is a compiler/loading structure only. It is **not part of EDAG**, and
imported module paths must not be embedded into EDAG merely to make an unresolved
module self-contained.

For example:

```js
import a from './a.f.js'

const x = [a, 1]
export default { x: x, y: x }
```

can compile conceptually to:

```js
const args = ['args']
const a = ['.', args, 0]
const x = ['[]', a, 1]

const edag = ['{}',
    [':', 'x', x],
    [':', 'y', x],
]
```

with temporary unresolved metadata:

```js
{
    imports: ['./a.f.js'],
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

must not silently become the successful EDAG constant `1`. Stage 1 intentionally does
not introduce the later `','` anchoring/sequencing operation, so if source-to-
`Unresolved` conversion would discard an otherwise-required potentially throwing body
computation, reject that module as unsupported for this stage rather than changing its
behavior. This restriction can be removed when the EDAG has an operation that can
anchor such non-resulting computations.

The same restriction applies across a **module boundary**. The current transpiler loads
and evaluates every imported module before running the importing module body, even when
the imported binding is never referenced. Without anchoring, replacing an unused import
parameter with nothing would discard the imported module root and could suppress its
failure. Therefore Stage 1 rejects a source module when an import parameter is not
reachable from the module EDAG root. This is deliberately a reachability rule, not an
effect analysis: Stage 1 does not inspect whether the dependency happens to throw.
Once EDAG can anchor non-resulting computations, unused imported roots can be preserved
instead of rejected.

Persisting unresolved values under `.fjs/unresolved/` and using them for incremental
compilation is deliberately a separate task; see
[`cache-compiled-modules.md`](./cache-compiled-modules.md).

#### Resolve unresolved modules to one EDAG

Recursively resolve the paths in `Unresolved.imports`. Each imported source is compiled
to its own temporary `Unresolved`, then its imports are resolved in the same way.

Resolution binds the resolved imported module results to the corresponding import
parameter positions in the importing module EDAG. The import array order therefore
remains significant: position `i` in `imports` corresponds to import parameter `i` in
the EDAG.

**Import binding is scope-aware.** At module scope, `['args']` is the import-parameter
array described above. A nested `['=>', frame, body]` introduces a new function scope,
where `['args']` means that function invocation's arguments instead. Module linking must
therefore never descend into a nested function `body` while substituting module import
parameters. The `frame` operand belongs to the enclosing scope and may be traversed
there; Stage 2 uses the placeholder `null` for it anyway. Import reachability checks
must use the same scope boundary so function-local `['args']` nodes cannot be mistaken
for module import parameters.

One link operation must memoize resolved modules by the resolver's canonical module
path. If the same module is reached more than once, including through a diamond import,
reuse the same resolved EDAG rather than resolving/splicing a fresh copy. EDAG node
identity is semantic, so duplicating a shared dependency can change reference identity
for exported arrays/objects. This in-memory link memo is required independently of the
optional `.fjs/unresolved/` source cache.

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

### Stage 2: functions and calls, without frames

After unresolved modules can be represented as EDAG, add functions and calls.

Introduce the function operation into EDAG:

```js
['=>', frame, body]
```

**Stage 2 does not implement frames/captures.** This is a restriction on *this task's*
compiler and interpreter, not on the EDAG schema: `frame` is a general `exp` in
`fjs/edag/module.f.mjs`, and `['frame']` is already a validated node there, ahead of
any consumer using either. Something not implemented in a parser or interpreter doesn't
mean it's absent from the EDAG definition — the schema is free to change independently
of what a given task supports. Stage 2's parser only ever emits a placeholder frame and
its interpreter (`interpret-edag.md`) only ever accepts that placeholder; source
functions that capture values from an enclosing function/module scope are outside this
stage. For the initial canonical form, a function is therefore represented with the
placeholder frame, for example:

```js
['=>', null, body]
```

Then introduce the initial non-capturing arrow-function form into the parser:

```js
(...a) => exp
```

The parser/compiler must reject a Stage 2 function whose body requires a captured outer
value rather than silently sharing an outer EDAG node into the nested body. Full frame
semantics remain owned by
[`3111-function-frame.md`](../../../spec/todo/3111-function-frame.md).

Also introduce call operations into EDAG:

```js
['()', object, args]                       // f(...args)
['.', object, property, ['|()', args, null]]   // o.p(...args)
```

There are two call spellings and the receiver is what tells them apart. `()` is the
ordinary call: its callee is an ordinary expression and it keeps no `this`. A method
call is instead the **property-access node owning its call** — the `'|()'` step in a
`.` node's continuation is what carries the `this` binding, which no `()` node can.
See "Chains" in [`../../edag/README.md`](../../edag/README.md). Stage 2 needs neither
optional node (`?.`, `?.()`) nor any of the other three steps, since optional chaining
is not in its source subset; a plain property read is `['.', object, property, null]`.

The property operand of a `.` node carrying a `'|()'` step follows **the same canonical
safety restriction as `.`** with a `null` continuation.
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
in place. Frame/capture support is a later extension.

### EDAG forms used by these stages

The staged work builds on the basic structural forms already being defined for EDAG:

- primitive constants directly: `null`, boolean, number, string, `bigint`
  (`undefined` is `['undefined']`, not a bare constant — see
  `edag-stage1-discussion.md`'s "Structural operations" table);
- object constructors: `['{}', ...entry]`, where the initial entry form is
  `[':', key, value]` and **`key` is a string constant** in this task, matching what
  the current DJS parser produces;
- array constructors: `['[]', ...node]`;
- the argument array: `['args']`;
- Stage 1 property access: `['.', object, property, null]`, with the restricted
  property operands described above — the `null` is the continuation operand, saying
  the receiver this access produced is dropped;
- Stage 2 non-capturing functions: `['=>', null, body]` (`frame` is a general `exp` in
  the schema; `null` is what *this task's* parser and interpreter are scoped to, not a
  schema-level restriction);
- Stage 2 calls: `['()', callee, args]` for an ordinary call, and
  `['.', object, property, ['|()', args, null]]` for a method call, with the property
  operand using the same restriction as `.`;
- semantic sharing by node identity, serialized with DJS `const` references when
  needed.

A function body is its own EDAG scope. Validation must reject an operation-node identity
that is shared across a function boundary (for example, the same constructor node used
both outside a function and as a node in its body). Otherwise per-invocation evaluation
could give one semantic node multiple runtime values. Normal sharing remains valid
inside one function body. Stage 2's compiler should naturally produce disjoint body
graphs; validation must enforce the same rule for arbitrary public EDAG input.

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

Do **not** add unrelated EDAG operations in these stages: arithmetic/logical operators,
comma, loops, `throw`, object spread, frame access/captures, `own`, or other later
operations remain outside this task unless they become necessary for the staged parser
work above.

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
machinery is extracted, coordinate with [`157-json-djs-shared-value-machine.md`](./157-json-djs-shared-value-machine.md), which already owns the
JSON/DJS structural deduplication; codec policy remains separate.

The exact tests must distinguish the edge cases semantically:

- `Object.is(roundTrip(-0), -0)`;
- `Number.isNaN(roundTrip(NaN))`;
- `roundTrip(Infinity) === Infinity`;
- `roundTrip(-Infinity) === -Infinity`.

This parser/serializer support is required independently of module-to-EDAG conversion,
because `.f.js` is the general representation used to persist EDAG and unresolved
artifacts.

### Existing compile API boundary

This task adds an **EDAG-producing compilation path**; it does not change the public
success result of the existing value-producing DJS transpiler/CLI yet. Until an EDAG
execution path is integrated, existing `transpile` callers and `fjs compile` continue
to evaluate the module and serialize its exported value exactly as they do today.

In particular, the final EDAG artifact described below is a distinct compiler artifact,
not a replacement for the current `fjs compile <input> <output>` result during this
stage. Land the EDAG-producing path alongside the current value-producing path rather
than routing existing callers to an EDAG value that they would accidentally stringify
as the module result.

After the baseline interpreter exists, [`interpret-edag.md`](./interpret-edag.md) owns
the migration of the existing value-producing path to:

```text
source modules
  -> final EDAG
  -> interpret EDAG
  -> exported value
  -> existing output serialization
```

That migration changes the internal execution path, not the public value/output
contract.

### Final EDAG serialization

The final EDAG can be serialized as a FunctionalScript JavaScript artifact:

```text
<name>.f.js
```

or as JSON when the particular EDAG is representable without losing information.
The DJS parser/serializer round-trip above is the general path. JSON output is allowed
only when the chosen JSON representation preserves every value and all EDAG information;
otherwise JSON output must be rejected for that EDAG. The standard JSON codec's own
number policy remains defined by
[`number-edge-cases.md`](../../media/json/todo/number-edge-cases.md).

JSON must not be used when it would lose semantic graph sharing or values that the
chosen JSON representation cannot preserve. DJS/`.f.js` remains the general
representation.

Executing the final EDAG is a separate concern. Direct EDAG interpretation,
compilation of EDAG to executable functions, and execution policy can be layered on
top of the resulting EDAG.

Resource/time/memory hardening of EDAG processing is intentionally separate from this
task; see [`bound-edag-interpreter-resources.md`](./bound-edag-interpreter-resources.md).

### Tasks

#### Stage 1

- [ ] Introduce `['.', object, property]` into EDAG and its validation/type schema,
      enforcing the canonical property-operand restriction: permitted string constants,
      number constants, and only later the `Number` numeric-conversion node once it
      exists.
- [ ] Introduce parser support for `a.b` and `a[b]`, compiling only permitted Stage 1
      static-string/number property cases to `.`, and reject runtime-computed strings,
      prohibited property names, and other unsupported property expressions.
- [ ] Define the temporary `Unresolved` type as `{ imports, edag }`; keep it outside
      the EDAG schema.
- [ ] Keep `Unresolved.imports` as a source-ordered array of module paths, not a map,
      and make import parameter positions correspond to its indices.
- [ ] Change the DJS parser/AST object representation to retain an ordered entry list
      until EDAG conversion; do not collapse duplicate keys or reorder integer-like
      keys through a plain JavaScript object/`OrderedMap` representation.
- [ ] Convert a parsed source module to `Unresolved { imports, edag }` without reading
      or resolving any imported module.
- [ ] Do not silently drop required body evaluation. Until an anchoring/sequencing
      operation is available, reject a Stage 1 source module if conversion would omit
      an unreachable potentially throwing body computation.
- [ ] Until anchoring exists, reject a Stage 1 source module when any import parameter
      is unreachable from its EDAG root; do not silently discard eager imported-module
      evaluation just because the binding is unused.
- [ ] Replace `['aref', i]` with `['.', ['args'], i]` and replace `cref` sequencing
      with shared EDAG node identity.
- [ ] Resolve imported `Unresolved` values recursively and bind each resolved result
      to the corresponding **module-scope** import parameter position; when Stage 2
      functions exist, do not descend into nested `=>` bodies while substituting imports.
- [ ] Apply the same function-scope boundary to module-import reachability checks so
      nested function-local `['args']` nodes are never interpreted as import parameters.
- [ ] Memoize resolved modules during one link operation by canonical module path so
      repeated/diamond imports reuse the same resolved EDAG node identities.
- [ ] Remove the temporary `Unresolved` layer after resolution so the root compilation
      result is a plain EDAG with no unresolved module paths or temporary metadata.
- [ ] Add a distinct EDAG-producing compiler path/API alongside the current
      value-producing transpiler; do not redirect existing `transpile` / `fjs compile`
      callers until EDAG execution is available.

#### Stage 2

- [x] `['=>', frame, body]` is in the EDAG validation/type schema (`fjs/edag/`), with
      `frame` a general `exp` there and `['frame']` itself a separate validated node —
      neither restricted to Stage 2's scope.
- [ ] Stage 2's own parser and interpreter are narrower than the schema: emit/accept
      only the placeholder `null` for `frame`, and do **not** emit or interpret
      `['frame']` or other captured-variable access.
- [ ] Introduce parser support for the initial non-capturing `(...a) => exp` function
      form; reject functions that require captures.
- [ ] Validate that a nested function body is a disjoint EDAG scope: operation nodes
      must not be shared across a function boundary, while sharing within the body is
      preserved.
- [x] `['()', callee, args]` and the `['|()', args, null]` step a `.` node carries for
      a method call are in the EDAG validation/type schema (`fjs/edag/`), shape only —
      the property-operand restriction below is this stage's own work.
- [ ] Convert the corresponding parser call expressions to the EDAG call forms — `()`
      for an ordinary call, a `.` node with a `['|()', args, null]` continuation for a
      method call; reject prohibited or runtime-computed string properties in that
      node rather than bypassing the property-access safety rule.
- [ ] Add proofs for non-capturing nested functions and ordinary/method calls in the
      supported Stage 2 subset, including accepted static/numeric method-call
      properties and rejection of prohibited/runtime-computed string properties.
- [ ] Whenever optional chaining enters the source subset, lower grouping and chain
      boundaries per "Chains" in [`../../edag/README.md`](../../edag/README.md), with
      proofs over the spellings the `chains` section of
      [`../../edag/proof.f.mjs`](../../edag/proof.f.mjs) pins — among them `a?.b.c`
      against `(a?.b).c`, `a?.b(d)` against `(a?.b)(d)`, and `(a?.b.c)(d)` against
      `(a?.b).c(d)`. The grammar removes most of what such a lowering used to have to
      enforce: the duplicate spellings it had to avoid emitting are now unspellable.
- [ ] Add a scope-aware linking proof such as
      `import y from './y.f.js'; export default [y, (x) => x]`: resolving `y` must not
      rewrite the nested function body's `['args']`, and calling that function still
      returns its invocation argument.
- [ ] Add a validation proof that reusing one operation node both outside and inside a
      nested function body is rejected.

#### Shared/final

- [ ] Add explicit **DJS** parser support for the chosen `.f.js` spellings of
      `Infinity`, `-Infinity`, `NaN`, and `-0`.
- [ ] Add DJS-specific number serialization that the DJS parser round-trips to exactly
      `Infinity`, `-Infinity`, `NaN`, and `-0`; do not change the standard JSON codec's
      policy as a side effect of this task.
- [ ] Coordinate any shared parser/serializer extraction with [`157-json-djs-shared-value-machine.md`](./157-json-djs-shared-value-machine.md)
      instead of adding another duplicate JSON/DJS walker or numeric-policy layer.
- [ ] Serialize the final EDAG to `.f.js` through the EDAG-producing artifact path;
      allow JSON output only when it preserves the EDAG completely.
- [ ] Preserve the existing value-producing `transpile` / `fjs compile` success output
      until `interpret-edag.md` integrates EDAG execution behind that API.
- [ ] Preserve current missing-file, parse-error, and circular-dependency behavior.
- [ ] Add Stage 1 proofs that permitted `a.b`, `a['x']`, and numeric `a[0]` forms
      produce property-access EDAGs, while prohibited names and runtime-computed string
      properties are rejected; source-to-`Unresolved` compilation does not read imports,
      import paths and parameter positions preserve source order, object-entry order
      **including integer-like keys and duplicate keys** survives parsing/EDAG
      conversion, and resolving a multi-module program produces one final EDAG with
      no unresolved module metadata. (Object-entry keys are not restricted to string
      constants — see `edag-stage1-discussion.md` subject 4 — and entry-descriptor
      identity is not checked — see the same subject — so neither belongs in this list.)
- [ ] Add a Stage 1 proof that `const check = null.x; export default 1` is not silently
      compiled to the successful constant `1`; until anchoring exists it is rejected
      as unsupported rather than changing current evaluation behavior.
- [ ] Add a Stage 1 proof that an unused import is not silently discarded: for example,
      `import bad from './bad.f.js'; export default 1` is rejected as unsupported until
      imported module roots can be anchored, so a failure in `bad.f.js` cannot disappear.
- [ ] Add a diamond-import proof showing repeated resolution of one canonical module
      reuses the same resolved EDAG and preserves shared exported object/array identity.
- [ ] Add DJS number round-trip proofs for `-0`, `NaN`, `Infinity`, and `-Infinity`,
      plus JSON-when-representable proofs showing JSON is not selected when its chosen
      representation would lose an EDAG value or graph information.
- [ ] `npx tsc`, `fjs test`.

### Related

- [`../transpiler/module.f.mjs`](../transpiler/module.f.mjs) — currently loads imports
  recursively before calling `run(module[1])(args)`; keep its value-producing public
  contract until EDAG interpretation is integrated.
- [`../parser/module.f.mjs`](../parser/module.f.mjs) — DJS parser that must support the
  chosen special-number `.f.js` spellings.
- [`../serializer/module.f.mjs`](../serializer/module.f.mjs) — DJS serializer where
  special-number handling belongs.
- [`../../media/json/serializer/module.f.mjs`](../../media/json/serializer/module.f.mjs)
  — shared JSON serialization primitives currently reused by DJS; DJS-specific number
  syntax must not silently change standard JSON behavior.
- [`../../media/json/todo/number-edge-cases.md`](../../media/json/todo/number-edge-cases.md)
  — existing owner of the standard FunctionalScript JSON policy for `-0`, `NaN`, and
  infinities.
- [`157-json-djs-shared-value-machine.md`](./157-json-djs-shared-value-machine.md) — existing JSON/DJS parser/serializer deduplication task.
- [`../ast/types.ts`](../ast/types.ts) — current `AstModule`/`AstBody`, `aref`, `cref`,
  and plain-object representation to replace.
- [`../ast/module.f.mjs`](../ast/module.f.mjs) — current sequential AST evaluator.
- [`cache-compiled-modules.md`](./cache-compiled-modules.md) — lower-priority
  persistence/incremental-compilation task for `.fjs/unresolved/{hash}.f.js`.
- [`interpret-edag.md`](./interpret-edag.md) — separate baseline direct-interpreter
  execution strategy for the final EDAG and later integration behind the existing
  value-producing transpile/compile API.
- [`bound-edag-interpreter-resources.md`](./bound-edag-interpreter-resources.md) —
  lower-priority resource/time/memory hardening for EDAG processing.
- [`associate-edag-with-functions.md`](./associate-edag-with-functions.md) —
  low-priority note on compiling an EDAG to an executable function while retaining
  the EDAG through `edagAdd` / `edagGet` Effects.
- [`todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md) — EDAG
  semantics and structural operations.
- [`todo/edag-spec.md`](../../../todo/edag-spec.md) — future complete canonical EDAG
  schema.
- [`spec/todo/2330-property-accessor.md`](../../../spec/todo/2330-property-accessor.md)
  — property/method-access safety rules reused by `.` and the property chain steps.
- [`spec/todo/3110-function.md`](../../../spec/todo/3110-function.md) — source-level
  function support.
- [`spec/todo/3111-function-frame.md`](../../../spec/todo/3111-function-frame.md) —
  later captured-frame design; Stage 2 here remains non-capturing.
- [`spec/todo/9100-call-like-instructions.md`](../../../spec/todo/9100-call-like-instructions.md)
  — VM-internal call lowering, separate from stable EDAG call syntax.
