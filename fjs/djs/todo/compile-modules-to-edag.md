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

Both forms compile to the EDAG `.` operation. This stage is required before EDAG can
replace the current AST as the representation of an **unresolved module**, because
imported values are parameters and module EDAGs need to access those parameters, for
example:

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

### Stage 2: functions and calls

After unresolved modules can be represented as EDAG, add functions and calls.

Introduce the function operation into EDAG:

```js
['=>', frame, body]
```

Then introduce the initial arrow-function form into the parser:

```js
(...a) => exp
```

Also introduce call operations into EDAG:

```js
['()', object, args]
['.()', object, property, args]
```

This stage is intentionally after Stage 1: property access is the minimum operation
needed for unresolved-module parameter access, while function creation and calls extend
the set of source modules that can be represented after that basic module pipeline is
in place.

### EDAG forms used by these stages

The staged work builds on the basic structural forms already being defined for EDAG:

- primitive constants directly: `null`, `undefined`, boolean, number, string,
  `bigint`;
- object constructors: `['{}', ...entry]`, where the initial entry form is
  `[':', key, value]` and **`key` is a string constant** in this task, matching what
  the current DJS parser produces;
- array constructors: `['[]', ...node]`;
- the argument array: `['args']`;
- Stage 1 property access: `['.', object, property]`;
- Stage 2 functions: `['=>', frame, body]`;
- Stage 2 calls: `['()', object, args]` and
  `['.()', object, property, args]`;
- semantic sharing by node identity, serialized with DJS `const` references when
  needed.

The object constructor is an ordered operation rather than a plain EDAG object. This
preserves source property order and leaves room for future computed keys and entry
forms such as object spread, for example `['...', object]`. Computed object-constructor
key nodes are **not** part of this initial work: allowing arbitrary key expressions
would introduce JavaScript `ToPropertyKey` failure cases and therefore needs explicit
semantics before validation can admit them. Plain objects have no EDAG meaning here
and remain reserved for a future use.

Do **not** add unrelated EDAG operations in these stages: arithmetic/logical operators,
comma, loops, `throw`, object spread, or other later operations remain outside this
task unless they become necessary for the staged parser work above.

### Final EDAG serialization

The final EDAG can be serialized as a FunctionalScript JavaScript artifact:

```text
<name>.f.js
```

or as JSON when the particular EDAG is representable without losing information.
Serialization must preserve every observable primitive value exactly, including
**negative zero**. In particular, serializing `-0` as `0` is not acceptable because
`Object.is(-0, 0)` is false. The EDAG/DJS serializer must therefore emit a form that
round-trips `-0`, and JSON output is allowed only when the JSON serializer also
preserves that value and all other EDAG information.

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

- [ ] Introduce `['.', object, property]` into EDAG and its validation/type schema.
- [ ] Introduce parser support for `a.b` and `a[b]`, compiling both to the EDAG `.`
      operation.
- [ ] Define the temporary `Unresolved` type as `{ imports, edag }`; keep it outside
      the EDAG schema.
- [ ] Keep `Unresolved.imports` as a source-ordered array of module paths, not a map,
      and make import parameter positions correspond to its indices.
- [ ] Restrict initial `[':', key, value]` object-constructor validation to
      string-constant keys; defer arbitrary computed constructor keys until their
      coercion/failure semantics are defined.
- [ ] Change the DJS parser/AST object representation to retain an ordered entry list
      until EDAG conversion; do not collapse duplicate keys or reorder integer-like
      keys through a plain JavaScript object/`OrderedMap` representation.
- [ ] Convert a parsed source module to `Unresolved { imports, edag }` without reading
      or resolving any imported module.
- [ ] Replace `['aref', i]` with `['.', ['args'], i]` and replace `cref` sequencing
      with shared EDAG node identity.
- [ ] Resolve imported `Unresolved` values recursively and bind each resolved result
      to the corresponding import parameter position.
- [ ] Memoize resolved modules during one link operation by canonical module path so
      repeated/diamond imports reuse the same resolved EDAG node identities.
- [ ] Remove the temporary `Unresolved` layer after resolution so the root compilation
      result is a plain EDAG with no unresolved module paths or temporary metadata.
- [ ] Split the current transpiler flow into source-to-`Unresolved` compilation and
      recursive module resolution/linking.

#### Stage 2

- [ ] Introduce `['=>', frame, body]` into EDAG and its validation/type schema.
- [ ] Introduce parser support for the initial `(...a) => exp` function form.
- [ ] Introduce `['()', object, args]` into EDAG.
- [ ] Introduce `['.()', object, property, args]` into EDAG.
- [ ] Convert the corresponding parser call expressions to the new EDAG call forms.
- [ ] Add proofs for nested functions and ordinary/method calls in the supported
      Stage 2 subset.

#### Shared/final

- [ ] Serialize the final EDAG to `.f.js`; allow JSON output only when it preserves
      the EDAG completely.
- [ ] Preserve `-0` explicitly in EDAG/DJS serialization and in JSON output whenever
      JSON output is selected.
- [ ] Preserve current missing-file, parse-error, and circular-dependency behavior.
- [ ] Add Stage 1 proofs that `a.b` and `a[b]` produce property-access EDAGs,
      source-to-`Unresolved` compilation does not read imports, import paths and
      parameter positions preserve source order, object-entry order survives
      parsing/EDAG conversion, and resolving a multi-module program produces one final
      EDAG with no unresolved module metadata.
- [ ] Add a diamond-import proof showing repeated resolution of one canonical module
      reuses the same resolved EDAG and preserves shared exported object/array identity.
- [ ] Add serialization proofs covering `.f.js` and JSON-when-representable output,
      including `Object.is(roundTrip(-0), -0)` and a case where JSON must not be used
      because it would lose EDAG information.
- [ ] `npx tsc`, `fjs test`.

### Related

- [`../transpiler/module.f.mjs`](../transpiler/module.f.mjs) — currently loads imports
  recursively before calling `run(module[1])(args)`.
- [`../ast/types.ts`](../ast/types.ts) — current `AstModule`/`AstBody`, `aref`, `cref`,
  and plain-object representation to replace.
- [`../ast/module.f.mjs`](../ast/module.f.mjs) — current sequential AST evaluator.
- [`cache-compiled-modules.md`](./cache-compiled-modules.md) — lower-priority
  persistence/incremental-compilation task for `.fjs/unresolved/{hash}.f.js`.
- [`interpret-edag.md`](./interpret-edag.md) — separate baseline direct-interpreter
  execution strategy for the final EDAG.
- [`bound-edag-interpreter-resources.md`](./bound-edag-interpreter-resources.md) —
  lower-priority resource/time/memory hardening for EDAG processing.
- [`associate-edag-with-functions.md`](./associate-edag-with-functions.md) —
  low-priority note on compiling an EDAG to an executable function while retaining
  the EDAG through `edagAdd` / `edagGet` Effects.
- [`todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md) — EDAG
  semantics and structural operations.
- [`todo/edag-spec.md`](../../../todo/edag-spec.md) — future complete canonical EDAG
  schema.
