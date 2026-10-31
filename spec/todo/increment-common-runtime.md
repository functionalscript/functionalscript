## Implement increment through common-runtime

**Priority:** P4
**Status:** open — deferred; `++` remains refused

### Problem

Prefix and postfix increment cannot be implemented as `i += 1` or
`i = i + 1`. JavaScript `++` performs `ToNumeric` before adding a unit of the
resulting numeric kind; binary `+` can concatenate strings. The implementation
attempt in [PR #3500](https://github.com/functionalscript/functionalscript/pull/3500)
was withdrawn after review exposed incompatible answers:

| Initial `i` | JavaScript after `i++` or `++i` | Withdrawn `i = i + 1` rewrite |
| --- | --- | --- |
| `"a"` | `NaN` | `"a1"` |
| `"2"` | Number `3` | `"21"` |
| `0n` | BigInt `1n` | Mixed Number/BigInt failure |

Documenting a divergent result does not make the JavaScript spelling
compatible. Until the proper semantics are implemented, reject the syntax
instead of returning a plausible wrong answer (DESIGN §10).

### Proposal

Implement the numeric conversion and increment in **common-runtime**, using
the shared runtime architecture in
[`fjs/js/runtime`](../../fjs/js/runtime/README.md). Keep one authored
FunctionalScript implementation that the represented interpreters and NaNVM
execute or compile. Do not copy coercion into parser mappings, AST sugar, or
separate VM implementations. The exact helper API and its integration with
the runtime remain future design work.

Admit `++i;` and `i++;` only as statements on mutable identifiers, including
classic `for` clauses. Resolve their source read and write facts before
AST-to-FAST lowering, then use the shared runtime operation for the value
written. This issue does not admit update expressions, property mutation,
or decrement; those need their own scope and approval.

**Benefits.** Restore familiar counting-loop syntax without changing the
meaning of an admitted JavaScript program, and share the implementation
across execution backends.

**Drawbacks.** Requires numeric conversion, runtime integration and proofs
across backends, rather than a small addition rewrite. Parsing and binding
analysis must also preserve statement and control-flow boundaries.

### Pitfalls from the attempt and review

- **Conversion is not addition.** Cover numeric and nonnumeric strings,
  empty and whitespace strings, booleans, `null`, `undefined`, and arrays
  and objects admitted by FJS. The review proposed rejecting unsupported
  operand kinds as an interim safeguard; that is not an implementation of
  JavaScript's conversions. Keep unsupported behavior explicitly refused.
- **Preserve Number versus BigInt after conversion.** Use `1n` for a BigInt
  result and `1` for a Number result. Unconditional `Number(i)` loses BigInt
  type and precision; unary `+i` rejects BigInt. Inspecting only the original
  operand's type also misses an admitted object that converts to BigInt.
- **Conversion can run code or fail.** Read the target once and convert once,
  with the number hint (`valueOf` before `toString`) for ordinary objects.
  Propagate conversion failure without performing the increment's write.
  Preserve writes and other work performed by an admitted conversion call
  in their source order. At represented-execution boundaries, invoke admitted
  conversions through the executor; never hand represented containers to
  host coercion.
- **Numeric edge cases matter.** Preserve JavaScript's `NaN`, infinities,
  signed zero, fractions and floating-point rounding near and beyond safe
  integers. BigInt arithmetic must retain arbitrary precision.
- **Statements do not supply expression results.** Both statement forms
  discard their result, so they have the same final binding value. If
  expressions are proposed later, prefix returns the new numeric value and
  postfix the old *converted numeric* value, not the unconverted operand.
  Initializers, arguments, returns and nested arithmetic must not silently
  gain update-expression support through the statement grammar.
- **Binding safety precedes lowering.** Retain mutable identifier targets,
  const/import and undeclared/premature-name refusals, implicit reads, writes,
  and reassigned-capture checks, including unreachable source. Do not permit
  property mutation as a side effect of adding update syntax.
- **Loop transfers must keep their order.** A classic `for` update runs
  after normal completion and `continue`, and is skipped by `break`,
  `return` and `throw`. Preserve header scope, shadowing and binding identity
  through generated immutable versions.
- **Lexing and ASI need separate proofs.** A postfix operand cannot be
  separated from `++` by a line terminator, including one inside a comment;
  prefix `++` permits a following newline. Preserve maximal munch and
  same-line statement termination. The attempt introduced a contextual
  `postfixIncrement` token to avoid an LL(1) first/follow conflict. Revisit
  that parser decision explicitly rather than assuming an identifier-only
  lookbehind or a nullable expression suffix is sufficient.
- **A rewrite is not a semantic oracle.** The withdrawn proofs compared
  increments against `i = i + 1`, expected string concatenation and expected
  BigInt increment to throw. They proved the incompatible contract. Compare
  against actual JavaScript `++`, including failure behavior and value types,
  through the common runtime, represented execution and NaNVM. Passing CI
  does not establish semantic compatibility when expectations are wrong.
- **Runtime bootstrap must remain valid.** The runtime body must not use
  `++` to implement itself, and parsing/lowering must not execute the body.
  Respect the runtime's restrictions on member calls and body-defined static
  dependencies. Regenerate EDAG/Rust outputs from authored source instead of
  editing generated files or maintaining an independent native algorithm.
- **Approval must cover the actual feature.** The reviewer found that the
  previous task-owner request was not the documented language-design
  approval required by DESIGN §12. Approval of compound assignments does
  not approve update operators or changed JavaScript semantics.

### Tasks

- [ ] Specify the common-runtime helper and supported conversion domain,
      retaining refusal of any unsupported behavior.
- [ ] Obtain and record formal, explicit approval from an authorized language
      designer before implementation.
- [ ] Implement the shared semantic body and runtime/backend integration,
      preserving source analysis and AST-to-FAST pass ownership.
- [ ] Add JavaScript-oracle proofs for the pitfalls above, including Number
      and BigInt results, conversion ordering/failure, ASI, scope and loops.
- [ ] Regenerate affected outputs, pass scoped checks and proof coverage,
      and update the implemented specification only when support lands.

### Related

- [Review requesting changes](https://github.com/functionalscript/functionalscript/pull/3500#pullrequestreview-5724149133)
  — string incompatibility, BigInt failure and missing design approval.
- [Working session](https://chatgpt.com/local/01a192d2-c3c7-75e6-b22e-cc8a61b4d02f)
  — the task owner's decision to withdraw the rewrite and defer a proper
  common-runtime implementation; not approval of a future implementation.
- [Assignments](./3430-assignments.md) — compound assignments are implemented;
  update operators have separate conversion and result rules.
- [Coercion](../../fjs/edag/value/coercion/module.f.mjs) — existing
  `primitiveToNumeric` and `objectToPrimitive` semantics to reconcile with
  the shared runtime, not another algorithm to duplicate.
- [DESIGN](../../doc/DESIGN.md) — §§10, 12 and 13: refuse unsupported inputs,
  preserve JavaScript conventions, require design approval and share one
  semantic implementation.
