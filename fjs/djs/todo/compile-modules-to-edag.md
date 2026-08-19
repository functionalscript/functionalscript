## Compile modules to EDAG before loading imports

**Priority:** P2
**Status:** open

### Problem

The current DJS transpiler couples two separate operations:

1. parse a module into `AstModule`;
2. recursively load every imported module and only then evaluate the module body
   with `run(module[1])(args)`.

This means the source-to-computation representation is not available independently
of dependency loading. A module cannot be compiled once and cached before its
imports are resolved, even though its computation depends only on its source and
treats imported values as parameters.

The existing AST already approximates this model: `AstModule` stores import
specifiers separately, `['aref', i]` denotes the `i`-th imported value, and the
last `AstBody` entry is the result. Replace this temporary sequential AST execution
model with the EDAG model directly.

### Proposal

Split module compilation/loading into two phases.

#### 1. Compile source to a parameterized EDAG

Compile each FunctionalScript module **without loading its imports**.

The compiled-module representation keeps the import specifiers in source order and
an EDAG root for the module body. Imported values are parameters of that EDAG, and
`export default` is the root/result of the computation.

For example:

```js
import a from './a.f.js'

const x = [a, 1]
export default { x, y: x }
```

can compile conceptually to the EDAG serialized as DJS:

```js
const args = ['args']
const a = ['.', args, 0]
const x = ['[]', a, 1]
export default { x, y: x }
```

`x` is one shared EDAG node, so both object properties receive the same array.
`const` is serialization-level sharing, not an EDAG operation.

The general `['=>', ...]` function operation is not required for this stage. The
loader treats the compiled EDAG as an implicit module function whose argument array
contains the imported module values.

Because this phase does not read dependencies, its result is cacheable independently
of imported-module contents. A persistent cache must include the compiler/EDAG
version in its identity; dependency values are not part of the source-to-EDAG cache
key.

The compiler may also materialize these intermediate EDAGs as **DJS files** in a
temporary build directory, analogous to `./target/`, for example
`./target/edag/`. This makes the independently compiled module representation easy
to inspect, debug, and reuse during the rest of the compilation. The files contain
the EDAG serialization, not loaded dependency values or the final compiled module.
They are build artifacts and must not be source-controlled.

#### 2. Load imports and execute the EDAG

The loader recursively resolves and loads the module's import specifiers. After all
required imported values are available, execute the module EDAG with those values as
its arguments, in import-source order.

Conceptually:

```text
source
  -> compile without imports
  -> { imports, edag }

imports
  -> recursively load values
  -> args

execute(edag, args)
  -> compiled module value
```

For the root module, the result is the complete compiled module/program value.
Circular dependency detection remains a loading concern, as it is today.

### Initial EDAG subset

Implement only the EDAG forms required by the DJS loader today:

- primitive constants directly: `null`, `undefined`, boolean, number, string,
  `bigint`;
- object constructors: `{ key: node, ... }`;
- array constructors: `['[]', ...node]`;
- the argument array: `['args']`;
- import-parameter access: `['.', ['args'], index]`;
- semantic sharing by node identity, serialized with DJS `const` references when
  needed.

Do **not** add the rest of EDAG yet: arbitrary property access, calls, method calls,
operators, comma, closures/functions, `throw`, or other later operations are outside
this task. Do not add plain object or array constant nodes; object and array literals
are represented by their constructors.

### Tasks

- [ ] Define the minimal DJS EDAG types/validation for the forms above, consistent
      with [`todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)
      and extensible to the full EDAG specification later.
- [ ] Convert parsed module bodies to an EDAG root without reading or resolving any
      imported module.
- [ ] Replace `['aref', i]` with EDAG import-parameter access and replace `cref`
      sequencing with shared EDAG node identity.
- [ ] Keep import specifiers alongside the EDAG in source order so the loader can
      construct the argument array deterministically.
- [ ] Split the current transpiler flow into source-to-EDAG compilation and recursive
      loading/evaluation.
- [ ] Allow compiled module EDAGs to be emitted as DJS files under a temporary build
      directory such as `./target/edag/`; keep the directory out of source control.
- [ ] Execute each module EDAG only after all of its imported values have been loaded;
      the root module's result is the final compiled value.
- [ ] Preserve current missing-file, parse-error, and circular-dependency behavior.
- [ ] Make the source-to-EDAG result cacheable; add an initial cache if useful, with
      compiler/EDAG versioning for persistent entries.
- [ ] Add proofs that compilation does not read imports, shared `const` values retain
      identity, imports are passed in source order, and a multi-module program
      produces the same final value as the current transpiler.
- [ ] `npx tsc`, `fjs test`.

### Related

- [`../transpiler/module.f.mjs`](../transpiler/module.f.mjs) — currently loads imports
  recursively before calling `run(module[1])(args)`.
- [`../ast/types.ts`](../ast/types.ts) — current `AstModule`/`AstBody`, `aref`, and
  `cref` representation to replace.
- [`../ast/module.f.mjs`](../ast/module.f.mjs) — current sequential AST evaluator.
- [`todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md) — EDAG
  semantics and structural operations.
- [`todo/edag-spec.md`](../../../todo/edag-spec.md) — future complete canonical EDAG
  schema; this task intentionally implements only the loader-required subset first.
