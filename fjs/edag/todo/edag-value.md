## Use EDAG values in FJS VMs

**Priority:** P3
**Status:** wip — value type and shape schema; VM migration remains open

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
`error(value)` is a language throw. The `throw` operation evaluates its
operand and returns that value as an error; a failure evaluating the operand
propagates unchanged. Calls and eager operations propagate failures, and
lazy operations evaluate only demanded operands. Host exceptions and
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
       -> Result<module-export EdagValue, thrown EdagValue>
```

The successful result is the complete named/default export object. A language
throw stops this compilation, as JavaScript stops loading a module whose
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

Because `EdagValue` is already EDAG, send it directly to the existing
FunctionalScript/JavaScript and Rust backends, within their supported execution
profiles. They emit construction of the evaluated data and captures, and
executable code for function bodies. Preserve graph sharing when constructing
objects, arrays and functions. Generate parameter lists from `length`; the
VM core has no need for host callable factories.

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
Runtime materialization is separate from the FJS VM's value representation.
Use a supported backend or runtime converter without requiring runtime
JavaScript code generation inside FJS. The host's function-text exception
applies to ordinary converted/generated JavaScript callables; VM conversion
continues to use the EDAG-derived renderer.

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
- [ ] Add the `EdagValue` type and runtime schema alongside EDAG, with type-level
      subset checks and proofs of the closed-graph/scope invariant.
- [ ] Implement shared value operations and invocation over
      `Result<EdagValue, EdagValue>`, with immutable state and admitted methods.
- [ ] Migrate Amnesia and memo, preserving each documented execution model;
      migrate their proofs, the `fjs/nanvm` corpus and parameter consumers.
- [ ] Implement conversion to `unknown`, including callable invocation,
      runtime arguments/results, reflection erasure, failure behavior and
      identity preservation.
- [ ] Execute resolved module initializers into export value graphs; migrate
      compiler/loader callers and retire or migrate the AST value evaluator.
- [ ] Prove direct JS/Rust compilation of result graphs preserves the supported
      profile: primitives, containers, nested captures, distinct closures,
      shared identity, fresh invocation values, lazy branches and throws.
- [ ] Prove initializer failures survive unused imports/declarations, while
      successful artifacts omit unreachable initialization machinery.
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
