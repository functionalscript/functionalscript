## Use EDAG values in FJS VMs

**Priority:** P3
**Status:** wip — value shape, metadata, closure checks, basic semantics, control flow and value construction implemented; bare-call preparation is the next step; invocation and VM migration remain open

### Problem

The FJS EDAG evaluators produce JavaScript values. Their function values are
host closures built by `callable` in `fjs/types/function/length`: their arity
requires a fixed table, their native text describes the wrapper, and their
semantic EDAG and captures are unavailable from the value itself.

A computation should instead produce a value that retains its code and data,
can be saved as a compiled module, and can use the existing EDAG backends.
One representation must serve every VM implemented in FJS.

### Proposal

Use **`EdagValue`, a subset of EDAG, as the sole language-value representation
for FJS VMs**. Evaluation and language operations return
`Result<EdagValue, EdagValue>`. Provide an explicit conversion from `EdagValue`
to `unknown`: an ordinary FJS runtime value whose EDAG reflection has been
erased. Converted functions remain callable but no longer expose their EDAG.

This changes runtime representation and tooling APIs. It introduces no new
source syntax or reflection primitive. The approved parameter limit remains
in force; changing it requires its own language-design decision.

#### Value forms

An `EdagValue` is one of these forms, using the existing EDAG vocabulary:

| Form | Meaning |
| --- | --- |
| `null`, boolean, number, string, bigint | Primitive value, represented by itself |
| `['undefined']` | Undefined value |
| `['[]', values]` | Array of `EdagValue`s, with spreads already resolved |
| `['{}', properties]` | Final own properties `[':', stringKey, EdagValue]`, in language enumeration order |
| `['=>', length, slots, body]` | Function with evaluated `EdagValue` captures and an unevaluated EDAG body |

Object properties have resolved string keys and values. Duplicate definitions
and spreads have already taken their specified effect. Function bodies may
contain arbitrary admitted expressions, including nested function creation;
the value graph outside those bodies contains only the forms above.

The subset invariant includes graph validity, closure and scope, not merely
tuple shapes or TypeScript assignability. Every returned value is a valid
closed EDAG that a backend can consume directly. Evaluation may construct new
nodes: the result need not be a subgraph of the input.

For example, evaluating `(a => b => a + b)(2)` produces:

```js
['=>', 1, [2], ['+', ['frame', 0], ['arg', 0]]]
```

The capture is a value; the addition is code to execute on invocation.

#### Construction and supplied data

Value operations preserve shape, normalized properties, closedness and scope
by construction. Trust those invariants when consuming a compiler or VM result;
do not add a validation pipeline to every result or make a new admission API a
prerequisite for VM migration. Immutable FJS construction already guarantees
acyclic container graphs.

A separate entry that accepts EDAG or encoded values supplied as FJS data
checks the rules that construction alone does not guarantee: tuple shape,
metadata, bindings and scope. Reuse the existing checks once at that entry,
preserving node sharing. A malformed frame index or a body shared across
distinct function scopes is constructible in FJS; a host-mutated cycle is
outside this input contract. The interpreter plan owns its supplied-code
boundary; this migration does not introduce arbitrary host-input admission.

#### Identity and function scopes

The value representation preserves each VM's documented execution model.
For the JavaScript-compatible executor, a shared computation produces one
value per invocation, and a new invocation starts fresh. A captured array
retains its identity across calls; an array constructed by the body is fresh
per call. Equal-looking values are not automatically interned.

Each distinct function value has a distinct function node and a valid body
scope. Current EDAG analysis rejects operation nodes shared across different
function bodies. Function creation must therefore instantiate scope-local
body nodes, preserving sharing within that body. Internal code templates may
be reused, but the exposed value graph must satisfy this rule by construction;
compilation needs no separate quoting or graph-repair step.

Repeated references to one function value reuse that value node. Captured
values may be shared between functions through their evaluated slots. Keep
captures behind frame reads: moving a captured constructor into the body
would change its allocation lifetime.

Execution-model selection belongs to the executor and compilation/conversion
context, not persisted value metadata. Amnesia and memo use the same value
forms while retaining their explicitly different reuse rules.

#### Operations and failures

Arguments, rest arrays, captured slots, memoized language values, successful
results and thrown payloads all use `EdagValue`. Operations implement calls,
property access, `typeof`, equality, coercion and admitted built-in methods
over that representation. Methods that invoke callbacks use VM invocation.
Passing represented containers or functions to host operators is not a
semantic implementation of these operations.

Use the existing `Result` vocabulary: `ok(value)` is success and
`error(value)` is an execution failure. The `throw` operation evaluates its
operand and returns that value as an error; a failure evaluating the operand
propagates unchanged.

An admitted operation's own implicit failure, such as reading a property of
`null`/`undefined`, calling a non-function or bigint division by zero, returns
`error(['undefined'])`. This payload carries no cause, class or message;
optional executor diagnostics remain out of band. An explicit `throw undefined`
has the same result. Failures from evaluated operands and invoked callbacks
propagate unchanged, including explicit `throw` payloads. This follows
[failure equivalence](../../../spec/README.md#failure-is-one-outcome) while
keeping `Result<EdagValue, EdagValue>` as the single evaluator protocol.

Calls and eager operations propagate failures, and lazy operations evaluate
only demanded operands. Host exceptions and
`try`/`catch` are not the VM's language-failure mechanism.
`Result` is the evaluator protocol; it introduces no source-level catch or
throw-inspection feature and preserves the language's existing failure rules.

Thread immutable invocation/cache state alongside evaluation where needed,
following the separate memo-cache rewrite. Validation and loading diagnostics
retain their boundary error channels; they are not program-thrown values.

Function conversion inside the VM uses the shared EDAG-derived renderer,
including indirect conversion through arrays, keys and built-in methods.
Default function text follows the approved code/frame-slot contract. Saving
a closed callable also retains its captures and sharing; these are distinct
output contracts.

#### Modules and metaprogramming

An unresolved module consists of imports and an initializer EDAG. Producing
that representation does not execute initialization or perform a language
throw. Once imports are resolved to module-export `EdagValue`s, run the
initializer:

```text
source -> imports + initializer EDAG
       -> resolve imports -> evaluate initializer
       -> Result<module-export EdagValue, failure EdagValue>
```

The successful result is the complete named/default export object. An execution
failure stops this compilation, as JavaScript stops loading a module whose
initialization throws. Loading and syntax failures remain separately reported.

Evaluate all required initialization, including unused imports and declarations
that can fail. After success, retain only the values, captures and code
reachable from the result. Initialization computations and temporary values
can disappear from the compiled artifact. This is the initial tree-shaking
benefit; it does not require specializing exported function bodies or pruning
unused fields from whole captured objects.

Module initialization can compute functions and their captures, so executing
it specializes the module into a closed, directly compilable graph. FJS
tooling can construct, inspect and transform EDAG data and choose to execute
or compile it. An ordinary FJS array containing an instruction-looking tuple
is still an array value; executing EDAG supplied as data requires explicit
admission and validation. Source-language metaprogramming APIs remain separate
proposals under the language-design approval rule.

#### Compilation and conversion to `unknown`

Direct compilation through the FunctionalScript/JavaScript and Rust EDAG
backends is the required end state after their value-emission migration, within
their supported execution profiles. Their value paths must emit construction
of evaluated data and captures, and executable code for function bodies.
Preserve graph sharing when constructing objects, arrays and functions.
Generate parameter lists from `length`; the VM core has no need for host
callable factories.

The current [FunctionalScript serializer](../../compiler/serializer/module.f.mjs)
expects source-normalized frames: `tryStringify` refuses the primitive capture
in the example above with `a frame slot holding a primitive`, and also refuses
repeated or unused slots. Callable value emission must accept evaluated captures
and preserve their slot positions, shared values and allocation lifetimes.
This is backend migration work, not a restriction on `EdagValue`. The source
writer's structural round-trip contract remains separate: emitting a closed
value promises its runtime behavior and identity, without requiring source
lowering to reconstruct the same capture graph.

Provide **`EdagValue -> unknown`**, including functions, as an explicit
conversion to ordinary FJS runtime values. Here `unknown` names a runtime
value with reflection erased; it is not merely a TypeScript widening of the
EDAG tuple and is not a request to admit arbitrary host objects. Data becomes
ordinary primitives, arrays and objects, and functions become executable
callables. Preserve shared values, captures and repeated function references.

Converted functions accept ordinary FJS arguments, including other runtime
functions, and return ordinary FJS values. Their captures retain their
identities, allocations inside their bodies follow the supported execution
profile, and a language throw follows the ordinary runtime's failure behavior.
Calling them does not require the caller or its function arguments to expose
EDAG. Returning a function also produces an ordinary runtime function.

This conversion intentionally loses reflection. It promises neither recovery
of the original EDAG from `unknown` nor automatic reverse conversion; exposing
an EDAG property or requiring a function registry is not part of its API.
Its outbound direction creates no `unknown -> EdagValue` admission requirement.
Runtime materialization is separate from the FJS VM's value representation.
Materialize callable graphs through a supported backend: emit a normal FJS/JS
module or Rust construction code, then load/build it in the target runtime.
Precompiled code can supply the same construction when the code is already
available. Calls execute that code with ordinary runtime arguments and results,
outside the FJS EDAG evaluator. For example, materializing `f => f(1)` produces
runtime code that invokes the supplied callback directly, without its EDAG.
This is the bridge for ordinary callable arguments; they never need admission
as `EdagValue`s.

A converter implemented wholly in FJS can decode function-free data. Callable
materialization requires the target's compile/load or precompiled-code boundary;
an unavailable or unsupported boundary returns an output diagnostic. This keeps
runtime JavaScript code generation outside FJS and keeps `EdagValue` as the sole
value representation of FJS language VMs. The host's function-text exception
applies to generated JavaScript callables; VM conversion continues to use the
EDAG-derived renderer.

Existing compiler callers whose API exposes `unknown` convert explicitly.
JSON/DataJS writers apply their own representability rules; an output refusal
names that output, while an initialization failure names the source. A function
is a valid VM value even when a particular data output cannot represent it.

#### Migration and scope

Introduce the shared value model and operations, migrate each consumer through
a complete cutover, then remove the old representations. The final state has
**no FJS language VM with another value representation**, including proof VMs.
Cover `fjs/edag/amnesia`, `fjs/edag/memo` and the legacy `compiler/ast` value
evaluator: migrate the latter or retire it through the EDAG pipeline. Update
the compiler, module loader, proof/corpus consumers and output boundaries.

Rust NaNVM retains its `Any` representation. JavaScript hosts, effect
interpreters and FSM runners are outside this language-VM migration.
Native callable/EDAG association remains separate work. Temporary migration
coexistence ends when the last consumer moves; retaining the host-valued
evaluators as alternative FJS VMs does not complete this task.

The trade-off is explicit value semantics and runtime conversion machinery,
including closure-scope instantiation. In return the representation retains
semantic code, removes host-wrapper dependence from VM execution, supports
direct compilation and gives metaprogramming a common code/data model.

Explicit computation and allocation also make future time and memory limits
possible, including accounting inside costly operations. **Resource limits
are deferred and are not implementation tasks here**; this proposal adds no
budget or stopped-outcome API.

### Tasks

- [x] Record the common representation, failure model, compilation/conversion
      boundaries and required migration end state.
- [x] Add the `EdagValue` type and RTTI shape schema in `fjs/edag/value`, with
      type-level subset checks and proofs of recursive value forms.
- [x] Check normalized object properties in separately supplied evaluated data
      and captures via `fjs/edag/value/metadata`. Diagnostics use RTTI
      paths/messages; successful checks preserve the original value graph.
- [x] Check closure bindings, function-body scope separation and function
      lengths throughout the graph via `fjs/edag/value/closure`. Reuse EDAG
      analysis and binding checks; return string diagnostics while retaining
      the original value graph. Body object expressions keep construction
      semantics rather than evaluated-object normalization rules.
- [x] Add infallible truthiness, `typeof`, strict equality and `Object.is`
      helpers in `fjs/edag/value/semantics`. Tagged undefined has primitive
      semantics; arrays, objects and functions preserve node identity.
- [x] Add shared `throw`, `&&`, `||`, `??` and `?:` helpers over
      `Result<EdagValue, EdagValue>` in `fjs/edag/value/control`, with deferred
      operands, unchanged failures and selected value identity. These helpers
      provide stateless control flow; immutable executor state remains part
      of the invocation/cache migration.
- [x] Construct evaluated arrays in `fjs/edag/value/array` from deferred
      elements and array/string spreads. Evaluate items in order, propagate
      the first failure unchanged, fail non-iterable spreads with tagged
      undefined, preserve element identity and create a fresh array value.
- [x] Construct evaluated objects in `fjs/edag/value/object` from deferred
      string-key properties and object/array/string spreads. Evaluate items
      in order, propagate the first failure unchanged, preserve field value
      identity and create a fresh object with unique keys in JavaScript
      enumeration order. Property thunks resolve keys before values; key
      evaluation/coercion remains in the operation/invocation layer.
- [x] Construct evaluated functions in `fjs/edag/value/function` from deferred
      captures and valid body templates. Evaluate captures in order, propagate
      the first failure unchanged and retain capture identities. Create a
      fresh function and copy its body graph, preserving sharing within the
      copy and distinct equal-looking nodes, including nested function
      templates. Keep evaluated captures outside the copy and body code
      unevaluated; compiler/admission length and binding invariants are trusted.
- [ ] Implement shared value operations and invocation over
      `Result<EdagValue, EdagValue>`, with immutable state and admitted methods.
- [ ] Migrate Amnesia and memo, preserving each documented execution model;
      migrate their proofs, the `fjs/nanvm` corpus and parameter consumers.
- [ ] Implement target runtime materialization to `unknown`: function-free data
      conversion and backend-generated/precompiled callable construction,
      runtime arguments/results, reflection erasure, failure behavior and
      identity preservation. Prove `f => f(1)` accepts an ordinary callback
      with no EDAG association, and refuse unavailable callable materialization.
- [ ] Execute resolved module initializers into export value graphs; migrate
      compiler/loader callers and retire or migrate the AST value evaluator.
- [ ] Implement callable value emission in the FJS backend for primitive,
      repeated and unused evaluated captures, preserving slot positions and
      shared captured values separately from source round-trip serialization.
      Prove the primitive-capture example above produces a callable returning
      `5` when passed `3`, plus shared captures and fresh body allocations.
- [ ] Prove direct JS/Rust compilation of result graphs preserves the supported
      profile: primitives, containers, nested captures, distinct closures,
      shared identity, fresh invocation values, lazy branches and throws.
- [ ] Prove initializer failures survive unused imports/declarations, while
      successful artifacts omit unreachable initialization machinery.
- [ ] Prove implicit operation failures return `error(['undefined'])`, while
      explicit thrown values propagate unchanged through operands, callbacks
      and module initialization.
- [ ] Prove direct/indirect function text, conversion of thrown values and
      exported callables; retain the host-text exception at host boundaries.
- [ ] Remove old VM value representations and reconcile the linked design
      notes; move the final contract to EDAG documentation before deleting
      this TODO. Declare evaluator API breaks in implementation PRs.
- [ ] Run `tsc`, the FunctionalScript suite, `npm start compile`, `node --test`,
      `cargo clippy` and `cargo fmt -- --check`; regenerate after source changes
      and run `cargo test` for Rust changes.

### Related

- [EDAG](../README.md) and [execution models](../execution-models.md) — schema,
  scope and identity contracts.
- [Function text](../function-text.md) — current host-valued behavior this
  migration replaces inside FJS VMs.
- [Interpret EDAG](../../compiler/todo/interpret-edag.md) — public validation
  and compiler integration, with runtime conversion at its value-output boundary.
- [Module compilation](../../compiler/todo/compile-modules-to-edag.md) and
  [module loading](../../compiler/todo/load-modules-without-import-effect.md)
  — unresolved code, imports and export objects.
- [Immutable memo cache](../memo/todo/immutable-cache.md) — invocation-state
  prerequisite; this representation does not approve captured mutation.
- [Callable association](../../compiler/todo/associate-edag-with-functions.md)
  — native/host callable metadata remains distinct from represented VM functions.
- [Output refusals](../../compiler/todo/value-refusal-names-the-output.md) —
  source failure versus output representability.
- [Metaprogramming](../../compiler/todo/047-compiler-meta-programming.md) —
  module execution enabled by this representation.
- [From value](./from-value.md) — the separate conversion of admitted literal
  data into EDAG; it does not recover erased function reflection.
- [Resource limits](../../compiler/todo/bound-edag-interpreter-resources.md) —
  deferred work enabled by explicit evaluation.
