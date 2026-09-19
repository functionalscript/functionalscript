## Parser Structure

**Priority:** P3
**Status:** open

### Boundary

**P1 correction:** the earlier AST-as-function API sketches are superseded.
An AST describes understood syntax; it is not an admitted executable function.
Follow the existing [statement-aware compilation plan](../../fsc/parser/todo/statement-aware-intrinsics.md):

```text
source and token metadata
    → JavaScript-subset AST
    → checked AST-to-EDAG compilation
    → Unresolved { imports, edag }
    → host resolution and linking
    → linked EDAG
         → interpretation or native compilation
         → serialization as data
```

The source AST preserves statements, declarations, identifiers, parameters and
returns. AST-to-EDAG compilation resolves bindings and const visibility, checks
JavaScript early errors, recognizes complete instruction patterns and enforces
FJS restrictions. A represented construct may still be refused. No backend may
skip these checks by interpreting the source AST as the function representation.

The [module rollout](../../fsc/todo/compile-modules-to-edag.md) owns the temporary
`Unresolved` wrapper and scope-aware import binding. Resolution uses the
[shared module-identity contract](../../fsc/todo/module-resolution-compatibility.md),
not an AST-with-imports to AST-without-imports conversion. The source AST and
module-resolution metadata do not become the persistent function format.
Generic EBNF parser trees remain ASTs; this boundary does not rename them EDAGs.

### Values and serialization

EDAG is the function-code representation shared by interpretation and native
compilation. A public `Function` input is EDAG data subject to its own validation,
not permission to execute arbitrary parser output. Bytecode remains VM-internal.
[EDAG serialization](../../../spec/todo/serialization.md) owns data encoding and
sharing preservation; its planned CBOR format does not serialize the source AST
as an executable function.

DataJS/JSON value-to-syntax or value conversion belongs to the respective codecs,
with their supported domains and explicit refusals. It is not a general
`Function → String → AST` reconstruction path: function text alone need not
supply a captured environment.

The adopted default-function-text exception and the
[three rendering questions](../../../spec/todo/serialization.md#function-text-and-serialization)
remain separate: whether `String(f)` equals callable serialization, whether it
includes the frame, and how each represents `self`. This parser plan selects
none of those answers or new serializer APIs. Source metadata remains separate
from semantic EDAG; preserving statement order in the AST does not require
source-order execution barriers.

### Tasks

- [x] **P1:** replace the direct AST-to-function and string-to-closure sketches
      with the checked compilation boundary above.
- [ ] Evolve the source representation through the linked compiler/parser tasks,
      rather than adding a second AST or parser here.
- [ ] With implementation, prove that represented but unadmitted constructs and
      JavaScript early errors cannot bypass admission through a backend; test
      approved complete patterns against nearby unmatched syntax.

### Related

- [GitHub issue #407](https://github.com/functionalscript/functionalscript/issues/407)
  — the original report; its API sketches are superseded above.
- [46](./046-lr1-parser.md) — separate parser research, not a choice of function
  representation or an instruction to replace the current layered LL(1) parser.
