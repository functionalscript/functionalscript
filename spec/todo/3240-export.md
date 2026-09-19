## Named exports

**Priority:** P1
**Status:** open

### Problem

FSC requires one final `export default`. Existing FunctionalScript modules use
named exports: compiling the dependency-free
[`types/range`](../../fjs/types/range/module.f.mjs) module unchanged at
`3552bca74723a79037e05d0906f3446bffee993e` fails with `unexpected token` at
`const` in its first export:

```js
export const contains = (b, e) => i => b <= i && i <= e
```

This is the first observed blocker for that candidate in the
[compiler-compatibility migration](../../todo/fjs-nanvm-integration.md).
Supporting named exports does not establish that the rest of the file compiles.

### Proposal

Start with `export const name = expression;`, using the existing `const`
binding and expression rules. An exported constant is also a local binding;
later declarations may refer to it. Imports stay first, and ordinary and
exported constants may appear together in declaration order.

```js
const base = 17;
export const first = base;
export const second = first;
```

### Module function result

The module function returns an object containing **all** exported properties,
including `default`. This is the module's result, not just linkage metadata.
The owner confirmed that named and default exports may coexist:

```js
export const a = 5;
export default 7;
```

The module function returns:

```js
{
    a: 5,
    default: 7,
}
```

Apply the same rule to every module, including one with only a default export:

| Source | Module function result |
| --- | --- |
| `export default 7;` | `{ default: 7 }` |
| `export default { first: 17 };` | `{ default: { first: 17 } }` |
| `export const first = 17;` | `{ first: 17 }` |

The result's exported keys follow JavaScript module-namespace order:
lexicographic order, including `default` when present. For
`export const z = 1; export const a = 2;`, the keys are `a`, then `z`.
This orders the result's properties, not initializer evaluation; source
declarations and generated declarations retain their required dependency order.

A default import selects `.default` from the imported module's result. An
absent default export is an error; an explicitly exported `undefined` is still
an export. JSON imports expose `{ default: document }` at the module boundary,
so their default import continues to yield the document.

Keep `export default` last under the existing statement-order rule. A named-only
module needs no default export. Construct the result from the existing bindings,
preserving evaluation order and sharing rather than evaluating initializers
again. Ordinary function bodies keep their own return values; this object is
the result of the **module** function.

Report duplicate bindings/exports at their source locations.
Retain the existing design's reservation of the export name `then`, regardless
of its value: a callable `then` on a namespace interferes with dynamic import's
promise resolution.

Namespace imports belong to the separate
[namespace-import TODO](./2220-namespace-import.md). Investigating `export { ... }`
belongs to the separate, low-priority [export-list TODO](./export-lists.md).
Re-exports and new expression or function syntax are outside this first step.

### Compiler changes

The parser's module body currently ends in the default-export expression.
Change that result to the export object. Carry it through AST evaluation,
`transpile`, and the EDAG's `unresolved` and `resolve` paths. Default imports
must project `.default` instead of binding the entire imported result.

The EDAG represents the computation of this object. The existing
[generated Rust entry point](../../fjs/fsc/rust/module.f.mjs),
`pub fn module<A: IVm>() -> Any<A>`, computes the same result for `.rs` output.
Update module-result consumers and proofs together.

### Serialization

For FunctionalScript module input, the complete export object remains the
module function's result. Each output format consumes it according to its
contract:

| Output | Serializer behavior |
| --- | --- |
| JSON / DataJS value output | Pass `result.default` to the value serializer. |
| FunctionalScript module source | Emit named properties as `export const` in dependency order, preserving shared bindings; emit `default` as the final `export default`. |
| EDAG / generated Rust | Preserve the computation of the complete module result. |

Value output uses the literal `result.default` projection even for a named-only
root. For `export const first = 17;`, that value is `undefined`: DataJS writes
`export default undefined;`, and JSON reports its existing refusal of
`undefined`. A missing default and an explicitly exported `undefined` therefore
have the same value output. Export presence remains distinct for module
linking, where a default import requires an actual default export.

A direct [JSON input](../README.md#json-input) keeps the existing document path:
JSON/DataJS serializers receive the document itself, without `.default`
projection. FunctionalScript output exports that document as `default`; EDAG
and Rust output retain the document's value. The input language selects this
path, not the presence of a property called `default`. For example, a root JSON
document `{"default":7}` must serialize as `{"default":7}` to JSON and
`export default {"default":7};` to DataJS. The wrapper for **imported** JSON
belongs at the module-import boundary and does not change direct JSON inputs.

For `export default 7;`, the module result is `{ default: 7 }`, but the DataJS
serializer receives `7` and writes `export default 7;`. Repeating compilation
must not add another `default` wrapper. This preserves the existing guarantee
that normalized DataJS documents are fixed points of both the DataJS and
FunctionalScript writers. JSON output for the same module is `7`.

The FunctionalScript serializer must expose each original export; it must not
emit the complete result object as a single default export. Its dependency
ordering and shared bindings must preserve evaluation and sharing across named
and default exports.

### Tasks

- [x] Allow named and default exports in the same module.
- [x] Define the module function's result as the object of all exports,
      including `default`.
- [x] Confirm the serialization contract: `result.default` for JSON/DataJS,
      and individual exports for FunctionalScript module source.
- [ ] Implement `export const` through the grammar, AST, and linking, preserving
      local references, evaluation order, sharing, and export names. Make the
      module body yield the export object and make default imports select
      `.default`. Prove default-only, named-only, and mixed results, duplicate
      names, reserved `then`, missing default exports, and an explicitly
      exported `undefined`. Compare export-key order with JavaScript namespaces
      using declarations whose source order differs from lexicographic order.
- [ ] Carry that result through the affected output paths. Prove generated
      JavaScript exposes the same exports and values as the original source,
      EDAG and generated Rust results contain all exported properties, and default
      imports (including JSON imports) still yield the selected value. Update
      consumers and declare the module-result API change in the implementation PR.
- [ ] With the serializer changes, prove that normalized DataJS documents remain
      fixed points of both writers, including repeated compilation of
      `export default 7;` without accumulating wrappers. Prove JSON serializes
      the default value and FunctionalScript preserves dependency order and
      sharing between named and default exports. Preserve direct JSON input
      conversions and the existing `protoKey.jsonInput` and
      `protoKey.jsonInputRoundTrip` proofs in `fjs/fsc/proof.f.mjs`; include
      primitive documents and an object with its own `default` property to prove
      that direct document inputs bypass projection. Cover named-only module
      roots: DataJS emits `export default undefined;`, and JSON refuses
      `undefined`, as for an explicitly undefined default export.
- [ ] Retry the unchanged `types/range/module.f.mjs`. If it fails, show the next
      diagnostic to the owner, who chooses a source rewrite or a missing
      compiler feature. Rename it to `.f.js` only after full compilation succeeds.
- [ ] Move the implemented contract into the specification and compiler docs,
      then remove this TODO.

### Related

- [Current export contract](../README.md#exporting-a-value).
- [Compiler entry points](../../fjs/fsc/module.f.mjs).
- [Namespace imports](./2220-namespace-import.md).
