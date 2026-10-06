# EDAG values

`EdagValue` is the evaluated subset of [EDAG](README.md), and the sole language
value representation of the FJS interpreters. [Memo](memo/module.f.mjs),
[Amnesia](amnesia/module.f.mjs), and compiler module initialization use
`Result<EdagValue, EdagValue>`. The old AST value evaluator is retired.
Rust NaNVM keeps its native `Any` representation.

**EDAG interpretation** computes a value graph from code. **Runtime compilation**
converts that graph to ordinary runtime values, including executable functions,
with EDAG reflection erased. These are separate operations.

## Value forms

The [type definitions](value/types.ts) and [shape schema](value/module.f.mjs)
use the existing EDAG vocabulary:

| Form | Meaning |
| --- | --- |
| `null`, boolean, number, string, bigint | Primitive value, represented by itself |
| `['undefined']` | Undefined value |
| `['[]', values]` | Array of `EdagValue`s, with spreads resolved |
| `['{}', properties]` | Own properties `[':', stringKey, EdagValue]` in language enumeration order |
| `['=>', length, slots, body]` | Function with evaluated captures and an unevaluated EDAG body |

Object keys are resolved strings, and duplicate definitions and spreads have
already taken effect. Function bodies may contain admitted expressions and
nested function creation; outside those bodies, the graph contains only the
value forms above. Fixed parameter lengths retain the approved 0–16 limit.

For example, interpreting `(a => b => a + b)(2)` produces:

```js
['=>', 1, [2], ['+', ['frame', 0], ['arg', 0]]]
```

The capture is a value; the addition is code for a later invocation.
Interpretation can construct new nodes, so the result need not be a subgraph
of its input.

## Construction and identity

Value constructors maintain normalized properties, closedness and function
scope. Their results are valid closed EDAGs that backends can consume directly
within their supported profiles. Trust those invariants when consuming a VM
or compiler result. Immutable FJS construction guarantees acyclic containers;
no cycle preflight or repeated result-validation pipeline is needed.

An explicit boundary accepting EDAG supplied as FJS data checks constructible
errors in shape, metadata, bindings and scope while preserving sharing. The
existing [metadata](value/metadata/module.f.mjs),
[closure](value/closure/module.f.mjs), and [analysis](analysis/module.f.mjs)
checks serve those boundaries. Object normalization applies to evaluated data
and captures; object expressions inside bodies retain construction semantics.
The proposed public interpreter admission API
is tracked [separately](../compiler/todo/interpret-edag.md).

Both interpreters use the same value forms and represented
[operation dispatcher](operations/module.f.mjs), with their own
[execution models](execution-models.md). Memo reuses a shared computation
within one invocation and starts fresh on the next. Amnesia recomputes each
edge except caller-established nodes. Neither interns equal-looking values.

Repeated references to a function reuse its value node. Distinct function
values have distinct nodes and body scopes: construction copies scope-local
body code, retaining sharing within each copy. Evaluated captures stay outside
that copy and retain their identities. A captured array survives calls; an
array constructed in a function body is fresh per call. Captures remain behind
frame reads, so compiling a value does not move their allocation into the body.
Execution-model selection belongs to the executor, not persisted metadata.

## Operations and failures

Arguments, rest arrays, captures, cached values, results and thrown payloads
are all `EdagValue`s. Operations implement calls, property reads, equality,
coercion and admitted built-ins over that representation. Methods invoke
represented callbacks through the selected interpreter.

`ok(value)` is success; `error(value)` is a language failure. An operation's
own implicit failure, such as a nullish property read, a noncallable invocation
or bigint division by zero, returns `error(['undefined'])`. Explicit `throw`
returns its evaluated operand as the payload. Operand and callback failures
propagate unchanged, including container and function identities. Lazy
operations demand only selected operands. This is the evaluator protocol,
consistent with [failure equivalence](../../spec/README.md#failure-is-one-outcome);
it adds no source-level catch or throw-inspection feature.

Admission, loading and output diagnostics have their own channels. Host
resource exhaustion is a deferred boundary described below, not a promised
represented language failure.

Direct and indirect function-to-string conversion uses the total shared
EDAG renderer with capture-slot names. This renders code, not captured values.
Checked `tryFunctionText`, partial source serialization, and the ordinary
host's function-text exception have distinct contracts in
[function-text.md](function-text.md).

## Module initialization

An unresolved module contains imports and an initializer EDAG. Constructing it
does not execute initialization. The compiler's
[`interpret`](../compiler/transpiler/module.f.mjs) resolves dependencies to
represented export values and runs each module's initializer with memo:

```text
source -> imports + initializer EDAG
       -> resolve dependency exports -> interpret initializer
       -> Result<module-export EdagValue, failure EdagValue>
```

Successful initialization produces the complete named/default export object,
cached per module. All required initialization runs, including otherwise-unused
imports and declarations that can fail. A failure stops loading and retains
its represented payload and source path. Parse and loading errors remain
distinct from language failures.

After success, only the returned values, captures and code need to be saved
or compiled. Unreachable initialization machinery drops out without requiring
function-body specialization or pruning captured object fields. This provides
the code/data representation for metaprogramming; new source-level APIs still
need their own [proposal](../compiler/todo/047-compiler-meta-programming.md).

## Runtime compilation

[`toUnknown`](value/to_unknown/module.f.mjs) has type
`(value: EdagValue) => Effect<CompileValue, unknown, IoChannel>`. Here `unknown`
means an ordinary FJS runtime value with reflection erased: primitives and
containers become ordinary data, and represented functions become callables
that expose no EDAG. It is a conversion, not just a type widening.

Converted functions accept ordinary values and callbacks, return ordinary
values, and use the target runtime's failure behavior. For example, compiling
`f => f(1)` invokes its supplied callback directly, without requiring that
callback's EDAG. Captures and repeated references retain identity, and each
conversion builds fresh containers and functions. No reverse admission,
function registry, or recovery of the original EDAG is implied.

Data-only graphs use the synchronous `toData` converter without a host
operation. Callable graphs request `compileValue` with a generated factory
module. The [JavaScript handler](value/to_unknown/module.mjs) loads its code
and calls the factory once per conversion; cached code does not cache values.
It wraps the result before returning asynchronously, preserving an ordinary
callable `then` property as data. Loading failures and unavailable operations
use `IoChannel`, separate from language results inside an interpreter.

The compiler's `transpile` composes `interpret` with `toUnknown`, returning
the complete ordinary runtime value. Runners supply the target compilation
handler for callable results. JSON/DataJS outputs use `toData` and their own
representability rules: a valid function value can still be refused by a data
output. Output refusals name the output; initialization failures name the source.

The [JavaScript value emitter](../compiler/serializer/value/module.f.mjs)
provides `stringify` for a default-exported value and `factoryStringify` for
a default-exported construction function. It accepts primitive, repeated and
unused evaluated capture slots, preserving positions and allocation lifetimes.
It follows the JavaScript/memo profile and may emit JavaScript beyond the
current FJS parser. The separate source writer's `tryStringify` preserves a
structural source round trip and can refuse those captures.

The existing [Rust emitter](../compiler/rust/module.f.mjs) accepts `EdagValue`
directly as an EDAG subset and emits native value construction and function
bodies. Both backends preserve their supported result-graph profile:
primitives, containers, nested captures, distinct closures, shared identity,
fresh invocation values, lazy branches and explicit throws. Rust retains its
output refusals, including shared computations without an eager binding
scope; the value representation does not expand backend capabilities.

The [interpreted capture fixture](../nanvm/values/module.f.mjs) is checked by
pure interpreter proofs, JavaScript runtime proofs, and
[native Rust tests](../../nanvm-harness/tests/values.rs). Additional emitter,
conversion and initializer proofs live beside their APIs.

## Scope and deferred work

All FJS language VMs use represented values, including proof interpreters.
Host JavaScript, effect interpreters, FSM runners, and Rust NaNVM's `Any` are
outside that requirement. [Native callable/EDAG association](../compiler/todo/associate-edag-with-functions.md)
is separate from runtime conversion's intentional reflection erasure.

Explicit computation and allocation make future time and memory accounting
possible, including work inside costly operations. [Resource limits](../compiler/todo/bound-edag-interpreter-resources.md)
remain deferred; this contract adds no budget or stopped-outcome API.
Host [string](value/method/todo/string-allocation-failures.md) and
[BigInt](value/numeric/todo/bigint-allocation-failures.md) capacity failures
can still escape the represented channel. Public admission, native
self-hosting prerequisites and broader backend support remain separately
tracked work.
