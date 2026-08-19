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

The current parser/AST also cannot preserve the ordered object-entry representation
required by EDAG. Object parsing accumulates properties in an `OrderedMap` with
`setReplace` and eventually produces a plain `AstObject`; duplicate keys are therefore
collapsed and integer-like keys can lose their written order before EDAG conversion.
This task must preserve object entries as an ordered sequence in the parser/AST until
they are converted to `['{}', ...entry]`.

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
export default { x: x, y: x }
```

can compile conceptually to the EDAG serialized as DJS:

```js
const args = ['args']
const a = ['.', args, 0]
const x = ['[]', a, 1]
export default ['{}',
    [':', 'x', x],
    [':', 'y', x],
]
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
FunctionalScript-owned temporary build directory such as `./.fjs/edag/`. This keeps
FunctionalScript artifacts separate from Cargo's `./target/`, while leaving room for
other FunctionalScript build artifacts under `./.fjs/` later. The independently
compiled module representation is then easy to inspect, debug, and reuse during the
rest of the compilation. The files contain the EDAG serialization, not loaded
dependency values or the final compiled module. They are build artifacts and must
not be source-controlled.

#### 2. Load imports and interpret the EDAG

The loader recursively resolves and loads the module's import specifiers. After all
required imported values are available, evaluate the module EDAG with those values as
its arguments, in import-source order.

For this first task, evaluation is performed by a **small EDAG interpreter written in
FunctionalScript**. Do not turn the EDAG back into JavaScript and execute it through
the host JavaScript engine. The interpreter only needs to support the initial EDAG
subset listed below and can grow together with the EDAG format later.

The interpreter must preserve EDAG node identity. In particular, if one object or
array constructor node is referenced from several places, it must be evaluated once
and the same resulting object/array reused. A memo table keyed by EDAG node identity
is sufficient for the initial interpreter.

Validate the EDAG shape before interpretation. Resource hardening — deterministic
work/time limits, memory/structure-growth limits, native-stack-independent traversal,
and stopped-outcome propagation — is intentionally deferred to
[`bound-edag-interpreter-resources.md`](./bound-edag-interpreter-resources.md). Those
concerns should not block the first working compile/load/interpret pipeline.

Conceptually:

```text
source
  -> compile without imports
  -> { imports, edag }

imports
  -> recursively load values
  -> args

interpret(edag, args)
  -> value
```

For the root module, the result is the complete compiled module/program value.
Circular dependency detection remains a loading concern, as it is today.

### Initial EDAG subset

Implement only the EDAG forms required by the DJS loader today:

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
**not** part of this initial interpreter; their coercion/failure semantics can be
specified when that extension is introduced. Plain objects have no EDAG meaning in
this initial subset and remain reserved for a future use.

Do **not** add the rest of EDAG yet: arbitrary property access, calls, method calls,
operators, comma, closures/functions, `throw`, computed object keys, or other later
operations are outside this task. Do not add plain object or array constant nodes;
object and array values are represented by their constructors.

### Tasks

- [ ] Define the minimal DJS EDAG types/validation for the forms above, consistent
      with [`todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)
      and extensible to the full EDAG specification later.
- [ ] Restrict initial `[':', key, value]` validation to string-constant keys; defer
      arbitrary computed key nodes until their coercion/failure semantics are defined.
- [ ] Change the DJS parser/AST object representation to retain an ordered entry list
      until EDAG conversion; do not collapse duplicate keys or reorder integer-like
      keys through a plain JavaScript object/`OrderedMap` representation.
- [ ] Convert parsed module bodies to an EDAG root without reading or resolving any
      imported module.
- [ ] Replace `['aref', i]` with EDAG import-parameter access and replace `cref`
      sequencing with shared EDAG node identity.
- [ ] Keep import specifiers alongside the EDAG in source order so the loader can
      construct the argument array deterministically.
- [ ] Implement a small EDAG interpreter in FunctionalScript for the initial EDAG
      subset; do not execute generated EDAGs as JavaScript.
- [ ] Memoize interpreter results by EDAG node identity so shared object/array nodes
      evaluate once and preserve reference identity in the compiled value.
- [ ] Split the current transpiler flow into source-to-EDAG compilation and recursive
      loading/interpretation.
- [ ] Allow compiled module EDAGs to be emitted as DJS files under `./.fjs/edag/`
      and ignore the FunctionalScript build directory in source control.
- [ ] Interpret each module EDAG only after all of its imported values have been
      loaded; the root module's result is the final compiled value.
- [ ] Preserve current missing-file, parse-error, and circular-dependency behavior.
- [ ] Make the source-to-EDAG result cacheable; add an initial cache if useful, with
      compiler/EDAG versioning for persistent entries.
- [ ] Add proofs that compilation does not read imports, the interpreter preserves
      shared `const` identity, imports are passed in source order, object-entry order
      (including integer-like keys and duplicate keys) survives parsing/EDAG
      conversion, non-string object-entry keys are rejected by initial validation,
      and a multi-module program produces the same final value as the current
      transpiler.
- [ ] `npx tsc`, `fjs test`.

### Related

- [`bound-edag-interpreter-resources.md`](./bound-edag-interpreter-resources.md) —
  lower-priority hardening for deterministic time/work and memory limits.
- [`../transpiler/module.f.mjs`](../transpiler/module.f.mjs) — currently loads imports
  recursively before calling `run(module[1])(args)`.
- [`../ast/types.ts`](../ast/types.ts) — current `AstModule`/`AstBody`, `aref`, `cref`,
  and plain-object representation to replace.
- [`../ast/module.f.mjs`](../ast/module.f.mjs) — current sequential AST evaluator.
- [`todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md) — EDAG
  semantics and structural operations.
- [`todo/edag-spec.md`](../../../todo/edag-spec.md) — future complete canonical EDAG
  schema; this task intentionally implements only the loader-required subset first.
