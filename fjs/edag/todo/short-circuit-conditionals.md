## Replace short-circuit EDAG operations with conditionals

**Priority:** P2
**Status:** open — design proposal; implementation has not started

### Problem

EDAG currently represents `&&`, `||` and `??` separately from `?:`.
All three can be expressed through conditionals and existing strict equality,
so dedicated tags add cases to graph producers, validation, evaluation,
analysis and output. The [general loops and tail calls epic](../../todo/general-loops-and-tail-calls.md)
uses their removal to simplify canonical tail-position analysis as well.

### Proposal

Keep all three source operators. Desugar them before canonical EDAG construction;
normalized FAST and canonical EDAG contain conditionals, not dedicated logical
or nullish-coalescing operations. This is required semantic lowering, separate
from optional graph optimization.

Establish `a` once in a fresh immutable binding `t`, within the expression's
original evaluation region, then use this table:

| Source | Core expression |
| --- | --- |
| `a && b` | `t ? b : t` |
| `a \|\| b` | `t ? t : b` |
| `a ?? b` | `(t === null ? true : t === undefined) ? b : t` |

`undefined` here is the primitive value, not a source identifier that can be
shadowed. The nullish predicate needs no new EDAG operation and does not depend
on `||`. Strict comparison excludes ordinary falsy values such as `false`,
`0` and `""` from the nullish branch.

Every occurrence of `t` refers to the same established value/node. Do not
substitute copies of the expression `a`: repeated calls, object allocation,
function construction and failures must retain their original evaluation and
identity. Do not merge distinct equal source expressions. The expression
returns an operand's value, not its Boolean conversion; in particular preserve
`-0`, object identity and function identity where that operand is returned.

Evaluate `b` only in the selected arm. Keep the entire normalization inside
the region where the original expression would execute. For example, the
temporary for `flag ? (a && b) : c` belongs only to the true arm, and an
invocation-local temporary must not become one value shared by all calls or
loop iterations. An already-established left operand may reuse its binding
without evaluating it again or adding an artificial function scope.

Source parsing still owns precedence, associativity and restrictions on mixing
`??` with `&&`/`||` without parentheses. This change adds no source syntax.
Optional chaining keeps its own chain scope and is not part of this removal.
Serializers may emit the canonical conditional spelling; recovering logical
operator spelling is not an implementation prerequisite.

### Ownership and compatibility

The target owner is AST-to-FAST desugaring under the
[compiler architecture](../../todo/compiler-vocabulary-and-modularization.md).
The existing frontend lowering boundary can host the change first; reuse/move
that implementation as FAST is introduced. General loops, helper extraction
and an EDAG optimizer are not prerequisites.

Remove the tags from the canonical schema and types only with all canonical
graph producers and consumers migrated. Include manually built graphs and
fixtures, operation classification, interpreters, JS/Rust output, function
text and generated examples. Source tokenizer/parser support remains.
Do not preserve separate logical-operator semantics in every backend.

Removing a tag changes structure, hashes and potentially observable function
text. This is an intentional schema migration, not a claim that equivalent
graphs share an identity. Inventory existing persisted/imported EDAG consumers
before choosing the release policy: either explicitly reject the former tags
at the admission boundary or convert them through one documented compatibility
adapter. If an adapter is needed, it produces a new graph/identity, preserves
original node sharing, and does not add legacy cases to the canonical core.
Do not silently associate the new graph with its old content hash.

Record the chosen admission policy and affected round-trip/function-text
contracts with implementation. Preserve exact-graph guarantees for unaffected
graphs; former logical nodes have a documented new canonical shape. Repeated
conversion must stabilize rather than accumulate bindings or wrappers.

### Benefits and costs

Conditionals become the single core choice mechanism, reducing evaluator,
analysis and serializer cases. Tail analysis uses the existing conditional
arms and binding-placement rules instead of another operator-specific walk.
Source keeps its familiar concise operators.

The cost is more explicit nodes, especially for `??`, plus a deliberate
schema/hash migration. Common placement must retain single evaluation and
lazy sharing. Measure representative graph size and output changes while
migrating, without making a new optimizer a prerequisite.

### Tasks and dependencies

| ID | Deliverable | Depends on |
| --- | --- | --- |
| S1 | Inventory producers/consumers; settle old-graph admission and identity policy | Existing EDAG conditional, sharing and content-identity contracts |
| S2 | Single-evaluation conditional lowering in the shared frontend | S1's semantic contract; an existing lowering boundary, not full FAST migration |
| S3 | Migrate all graph producers and canonical consumers; remove operation tags | S1, S2; compatibility adapter first if required by S1 |
| S4 | Publish contracts, update fixtures/docs and remove obsolete paths | S3; evidence accompanies each prior step |

- [ ] **S1 — Define the change.** Locate tags in schemas, types, classifiers,
      evaluators, emitters, tests, demos and graph producers. Record whether old
      input is rejected or explicitly converted; define identity and function-text
      changes before removing compatibility behavior.
- [ ] **S2 — Lower once.** Use fresh immutable bindings and conditionals in the
      original scope/region. Use strict null/undefined tests without a new op.
      Preserve source grammar, diagnostics and operand identity.
- [ ] **S3 — Remove canonical tags.** Update producers and consumers together
      in complete increments; eliminate logical/nullish cases from the final
      canonical schema, analysis, interpreters and output. Retain only a named
      boundary adapter if S1 establishes a need. Reconcile graph/hash fixtures.
- [ ] **S4 — Finish migration.** Update EDAG operation documentation, affected
      specifications, examples, function-text expectations and related TODOs.
      State the stable conditional round-trip shape and retire duplicate logic.

### Acceptance evidence

- [ ] The left operand is established once, including calls and identity-bearing
      objects/functions; repeated uses share it while distinct expressions stay
      distinct. Required left-operand failures remain required.
- [ ] An unselected failing right operand stays unevaluated; a selected one fails.
      Nested short-circuit expressions and conditionals preserve this property.
- [ ] Cover `null`, `undefined`, `false`, `0`, `-0`, `NaN`, `""`, truthy primitives,
      objects and functions. Verify exact returned values and reference identity,
      not just truthiness.
- [ ] Cover source shadowing, source precedence/mixing restrictions, and bindings
      inside lazy arms and repeated function/loop invocations.
- [ ] Tail-call tests run on the conditional form: a right-hand self-call can
      qualify; an already-evaluated left-hand call used by the test is a value
      read, not another call or an eligible loop transition.
- [ ] Interpreted and generated outputs agree under the existing failure
      contract; canonical graphs contain none of the removed tags.
- [ ] Old graph admission follows S1's explicit policy; sharing survives any
      adapter. Unaffected exact-graph cases remain stable, and repeated new
      round trips do not add bindings, wrappers or evaluations.

### Related

- [General loops and tail calls](../../todo/general-loops-and-tail-calls.md)
  — milestone S and the simplified tail-analysis domain.
- [Compiler architecture](../../todo/compiler-vocabulary-and-modularization.md)
  — desugaring, graph construction and serialization responsibilities.
- [Tail-call loops](./tail-call-loop.md) — existing output and broader analysis.
- [EDAG](../README.md) — current operations, identity and evaluation contracts.
- [Function text](../function-text.md) — observable output contract.
