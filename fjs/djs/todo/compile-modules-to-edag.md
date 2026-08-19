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
also needs source identity and the module paths imported by that source file. Keep
that information in a small temporary wrapper rather than adding module metadata to
EDAG itself.

The current parser/AST also cannot preserve the ordered object-entry representation
required by EDAG. Object parsing accumulates properties in an `OrderedMap` with
`setReplace` and eventually produces a plain `AstObject`; duplicate keys are therefore
collapsed and integer-like keys can lose their written order before EDAG conversion.
This task must preserve object entries as an ordered sequence in the parser/AST until
they are converted to `['{}', ...entry]`.

### Proposal

Split module compilation and module resolution.

#### 1. Compile source to a temporary `Module`

Compile each FunctionalScript source module **without loading its imports**.

Use the temporary representation:

```ts
type Module = {
    readonly hash: string
    readonly path: string
    readonly imports: readonly string[]
    readonly edag: EDAG
}
```

The fields have different roles:

- `hash` is the CBase32-encoded hash of the original source file contents;
- `path` is the source module path relative to the `.fjs/` / current-working-directory
  context used by the compiler;
- `imports` is an **array of module paths, not a map**. Its order defines the import
  parameter positions in `edag`;
- `edag` is the parameterized computation for the module, with `export default` as
  its root/result.

`Module` is a compiler/loading structure only. It is **not part of EDAG**. In
particular, `hash`, `path`, and imported module paths must not be embedded into EDAG
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
const a = ['.', args, 0]
const x = ['[]', a, 1]

const edag = ['{}',
    [':', 'x', x],
    [':', 'y', x],
]
```

with temporary module metadata such as:

```js
{
    hash: '<CBase32 source hash>',
    path: 'src/example.f.js',
    imports: ['./a.f.js'],
    edag,
}
```

`x` is one shared EDAG node, so both object properties reference the same constructed
array. DJS `const` is serialization-level sharing, not an EDAG operation.

The general `['=>', ...]` function operation is not required merely to represent the
module boundary. The temporary `Module` supplies the source/import metadata; its EDAG
is the parameterized computation associated with those imports.

Persisting these temporary modules under `.fjs/modules/` and using them for
incremental compilation is deliberately a separate task; see
[`cache-compiled-modules.md`](./cache-compiled-modules.md).

#### 2. Resolve modules to one EDAG

Recursively resolve the paths in `Module.imports`. Each imported source is compiled to
its own temporary `Module`, then its imports are resolved in the same way.

Resolution binds the resolved imported module results to the corresponding import
parameter positions in the importing module EDAG. The import array order therefore
remains significant: position `i` in `imports` corresponds to import parameter `i` in
the EDAG.

After all module dependencies are resolved, the temporary module wrappers disappear.
The **final compilation result is an EDAG, not a `Module`**:

```text
source module
  -> Module { hash, path, imports, edag }
  -> recursively resolve imported Modules
  -> EDAG
```

The resulting EDAG contains the complete compiled program and no unresolved module
paths or temporary module metadata.

The final EDAG can then be serialized as a FunctionalScript JavaScript artifact:

```text
<name>.f.js
```

or as JSON when the particular EDAG is representable without losing information.
For example, JSON must not be used when it would lose semantic graph sharing or values
that JSON cannot represent. DJS/`.f.js` remains the general representation.

Executing the final EDAG is a separate concern. This task establishes the
source-to-temporary-`Module` and module-resolution-to-final-EDAG pipeline. Direct EDAG
interpretation, compilation of EDAG to executable functions, and execution policy can
be layered on top of the resulting EDAG.

Resource/time/memory hardening of EDAG processing is intentionally separate from this
task; see [`bound-edag-interpreter-resources.md`](./bound-edag-interpreter-resources.md).

### Initial EDAG subset

Implement only the EDAG forms required by the current DJS compiler path:

- primitive constants directly: `null`, `undefined`, boolean, number, string,
  `bigint`;
- object constructors: `['{}', ...entry]`, where the initial entry form is
  `[':', key, value]` and **`key` is a string constant** in this task, matching what
  the current DJS parser produces;
- array constructors: `['[]', ...node]`;
- the argument array: `['args']`;
- import-parameter access: `['.', ['args'], index]`;
- semantic sharing by node identity, serialized with DJS `const` references when
  needed.

The object constructor is an ordered operation rather than a plain EDAG object. This
preserves source property order and leaves room for future computed keys and entry
forms such as object spread, for example `['...', object]`. Computed key nodes are
**not** part of this initial subset: allowing arbitrary key expressions would
introduce JavaScript `ToPropertyKey` failure cases and therefore needs explicit
semantics before validation can admit them. Plain objects have no EDAG meaning in
this initial subset and remain reserved for a future use.

Do **not** add the rest of EDAG yet: arbitrary property access, calls, method calls,
operators, comma, closures/functions, `throw`, computed object keys, or other later
operations are outside this task. Do not add plain object or array constant nodes;
object and array values are represented by their constructors.

### Tasks

- [ ] Define the temporary `Module` type as
      `{ hash, path, imports, edag }`; keep all four fields outside the EDAG schema.
- [ ] Compute `Module.hash` from the original source-file contents and encode it in
      CBase32.
- [ ] Define `Module.path` relative to the compiler's `.fjs/` / current-working-
      directory context so source identity is stable during module resolution.
- [ ] Keep `Module.imports` as a source-ordered array of module paths, not a map, and
      make import parameter positions correspond to its indices.
- [ ] Define the minimal DJS EDAG types/validation for the forms above, consistent
      with [`todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)
      and extensible to the full EDAG specification later.
- [ ] Restrict initial `[':', key, value]` validation to string-constant keys; defer
      arbitrary computed key nodes until their coercion/failure semantics are defined.
- [ ] Change the DJS parser/AST object representation to retain an ordered entry list
      until EDAG conversion; do not collapse duplicate keys or reorder integer-like
      keys through a plain JavaScript object/`OrderedMap` representation.
- [ ] Convert a parsed source module to `Module { hash, path, imports, edag }` without
      reading or resolving any imported module.
- [ ] Replace `['aref', i]` with EDAG import-parameter access and replace `cref`
      sequencing with shared EDAG node identity.
- [ ] Resolve imported `Module`s recursively and bind each resolved result to the
      corresponding import parameter position.
- [ ] Remove the temporary `Module` layer after resolution so the root compilation
      result is a plain EDAG with no unresolved module paths or module metadata.
- [ ] Split the current transpiler flow into source-to-`Module` compilation and
      recursive module resolution/linking.
- [ ] Serialize the final EDAG to `.f.js`; allow JSON output only when it preserves
      the EDAG completely.
- [ ] Preserve current missing-file, parse-error, and circular-dependency behavior.
- [ ] Add proofs that source-to-`Module` compilation does not read imports, import
      paths and parameter positions preserve source order, `hash` matches the source
      contents, `path` identifies the source relative to the compilation context,
      object-entry order (including integer-like keys and duplicate keys) survives
      parsing/EDAG conversion, non-string object-entry keys are rejected by initial
      validation, and resolving a multi-module program produces one final EDAG with
      no unresolved module metadata.
- [ ] Add serialization proofs covering `.f.js` and JSON-when-representable output,
      including a case where JSON must not be used because it would lose EDAG
      information.
- [ ] `npx tsc`, `fjs test`.

### Related

- [`../transpiler/module.f.mjs`](../transpiler/module.f.mjs) — currently loads imports
  recursively before calling `run(module[1])(args)`.
- [`../ast/types.ts`](../ast/types.ts) — current `AstModule`/`AstBody`, `aref`, `cref`,
  and plain-object representation to replace.
- [`../ast/module.f.mjs`](../ast/module.f.mjs) — current sequential AST evaluator.
- [`cache-compiled-modules.md`](./cache-compiled-modules.md) — lower-priority
  persistence/incremental-compilation task for `.fjs/modules/{pathHash}.f.js`.
- [`bound-edag-interpreter-resources.md`](./bound-edag-interpreter-resources.md) —
  lower-priority resource/time/memory hardening for EDAG processing.
- [`associate-edag-with-functions.md`](./associate-edag-with-functions.md) —
  low-priority note on compiling an EDAG to an executable function while retaining
  the EDAG through `edagAdd` / `edagGet` Effects.
- [`todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md) — EDAG
  semantics and structural operations.
- [`todo/edag-spec.md`](../../../todo/edag-spec.md) — future complete canonical EDAG
  schema; this task intentionally implements only the compiler-required subset first.
