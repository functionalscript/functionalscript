## Select a module export

**Priority:** P1
**Status:** open

### Problem

Generated modules already return the complete export object.
[`run`](../src/lib.rs) selects its `default` property and passes it directly
to JSON conversion. A named-only module cannot select an entry this way,
and a function-valued export is refused by JSON conversion without being called.
The MVP plans previously described that invocation as if it existed.

### Proposal

Keep the module result intact. Let the harness caller explicitly choose an
export name and whether to read its value or invoke it with supplied arguments.
`default` is one selectable name when present; no export name is mandatory.
Never invoke every exported function just because the module was loaded.

An absent selected export is a selection error, distinct from selecting a
present `undefined` value. Invocation of a non-callable value is an error.
Preserve module and call failures, and the current JSON refusal for unsupported
selected values or call results. Other exports need not be JSON-serializable.
Keep JSON/DataJS compiler value-output projection unchanged; this task changes
the harness consumer, not the EDAG module contract.

The harness API and any CLI spelling are to be proposed in the implementation
step. Keep `fjs compile` as a compiler that emits Rust; it does not run cargo.
This task can be implemented against `main` with empty/rest-only functions.
Named imports are needed for the cross-module acceptance example, not for
export selection itself.

### Tasks

- [ ] Propose and implement explicit export selection and read/call modes,
      including how the harness receives the invocation's argument list.
- [ ] Cover named-only, default-only and mixed modules; absent versus
      `undefined` exports; callable exports with supplied arguments;
      non-callable invocation; module/call failures; and non-JSON results.
      Prove that exported functions are not called during module evaluation
      or value selection and that selecting one retains other exports.
- [ ] With [named imports](../../spec/todo/named-imports.md), compile the
      [MVP example](../../todo/fjs-nanvm-integration.md#named-module-acceptance),
      build it with cargo, select and call `main`, and check `42` against
      native JavaScript and both JavaScript EDAG evaluators.
- [ ] Update the harness documentation and integration checklist when the
      behavior is implemented.

### Related

- [MVP roadmap](../../nanvm-lib/todo/mvp-roadmap.md).
- [fjs–nanvm integration](../../todo/fjs-nanvm-integration.md).
- [Module exports](../../spec/README.md#exporting-a-value).
