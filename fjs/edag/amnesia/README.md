# Amnesia

Amnesia walks an EDAG directly and returns `Result<EdagValue, EdagValue>`.
It is an execution model for proofs: every incoming edge evaluates its node
again unless the caller supplies an established value. Use
[Memo](../memo/module.f.mjs) when shared code must evaluate once per invocation.
Both executors use the same represented [operations](../operations/module.f.mjs).

`vm(context)(expression)` receives evaluated `frame` and module `args` values,
optional fixed arguments and a represented rest array. Functions retain their
body graphs and evaluated captures. `invoke` supplies the same represented
call interface as Memo, but evaluates each body through Amnesia again.
Function conversion uses the shared EDAG-derived text, including conversion
through arrays and admitted built-in methods.

## Recomputed code, retained values

A shared constructor is evaluated each time it is reached:

```js
const context = { frame: [], args: [] }
const shared = ['[]', [1, 2]]
vm(context)(['===', shared, shared]) // ['ok', false]
```

This is Amnesia's deliberate difference from Memo. Repeated computation can
also make a small shared graph expensive to evaluate. The
[execution models](../execution-models.md) describe the identity rules.

`Context.memo` supplies already established `[expression, value]` pairs,
looked up by expression identity. The walk never extends this list:

```js
const established = ['[]', [1, 2]]
const memo = [[shared, established]]
vm({ ...context, memo })(['===', shared, shared]) // ['ok', true]
```

A function invocation starts without the caller's established entries. Its
body recomputes shared constructors even within one call; passed arguments,
rest arrays and captured values retain their identities. Each new invocation
has its own fixed/rest bindings. Explicitly captured values outlive the
invocation that created the closure.

## Values and failures

Primitives, arrays, objects, functions and thrown payloads remain represented.
Implicit operation failures return `error(['undefined'])`; explicit `throw`
payloads and operand failures propagate through the same result channel.
Lazy operations and optional chains demand only their selected operands.
The escaping `|!()` step still calls the result of a short-circuited region,
so `(u?.f)()` fails when `u` is nullish.

Property reads expose own data. Method calls resolve own methods or the
admitted built-in table with their represented receiver; they do not expose
host prototypes or manufacture host callables. Conversion to ordinary runtime
values is a separate [runtime compilation boundary](../todo/edag-value.md).

This evaluator consumes valid, immutable FJS EDAG and trusts its binding and
scope invariants. Admission of separately supplied EDAG belongs at its entry
boundary, not at each recursive step. The [proofs](proof.f.mjs) cover execution
and recomputation; schema validation lives elsewhere.
