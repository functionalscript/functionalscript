## Named imports

**Priority:** P1
**Status:** open

### Problem

`export const`, named-only modules and the complete module export object are
already implemented. The parser still accepts only default imports, so FJS
source cannot consume a dependency's named exports using its ordinary
JavaScript imports. This blocks the
[named-module MVP example](../../todo/fjs-nanvm-integration.md#named-module-acceptance).

### Proposal

Support named imports and local aliases:

```js
import { add } from "./math.f.js";
import { add as sum } from "./math.f.js";
```

The EDAG module computation returns an object containing every export.
`default` is a property only when the source declares a default export.
Select each imported name from the dependency's existing export object;
an alias changes the local binding name, not the selected property. Reuse
module identity, linking and sharing, including through captured imports.

Validate that the export exists: an absent export is an error, while a present
export whose value is `undefined` is valid. Keep duplicate-local-binding and
reserved-name checks. Required module evaluation and failures survive unused
bindings, and aliases or multiple routes to one module share its exported
values. Retain the current refusal of circular dependencies.

The target ordering is static export validation before module evaluation.
For `import {missing} from "./dep"; export default 1;` with
`dep` containing `export const bad=null.x;`, every output should report
`module has no missing export` before the initializer runs. Apply the same
rule to default imports; valid unused bindings and empty lists still require
dependency evaluation. The current value and EDAG paths disagree on this
case. Its reproduction, required proofs and deferred implementation live in
[import-error-before-evaluation](../../fjs/fsc/todo/import-error-before-evaluation.md);
this proposal states the intended order, not a claim that it already works.

Benefit: existing named-export modules compose using familiar JavaScript
syntax, without default-export adapters. Cost: import records and binding
validation must retain both the exported and local names through parsing and
linking. No new EDAG operation or function-parameter representation is needed.

This is a language-feature proposal, not implementation approval. Before
implementation, record the approving language designer and approval link under
the repository's [language-design rule](../../doc/DESIGN.md#new-language-features-start-with-a-todo).
Settle the initial grammar scope in that approval: named lists and aliases,
trailing commas, `default as name`, and combined default/named imports.
Namespace imports and re-exports remain their own tasks.

### Tasks

- [ ] Obtain and record explicit language-design approval for the grammar scope.
- [ ] Extend the shared grammar, import records and binding checks; preserve
      existing default imports and JSON import-attribute rules.
- [ ] Lower and resolve named selections from complete dependency export
      objects in the compiler's value and EDAG paths, preserving module scope,
      captures, shared identity and required evaluation.
- [ ] Prove named-only and mixed-export dependencies, aliases, missing versus
      `undefined` exports, invalid bindings, repeated/diamond imports and
      failures in unused imports. Compare original JavaScript, both EDAG
      evaluators, source round trips and generated Rust for admitted cases.
- [ ] Complete the linked MVP example and fold implemented syntax into
      `spec/README.md`; leave unsupported forms explicit.

### Related

- [Exports](../README.md#exporting-a-value) — existing export-object contract.
- [Module compilation](../../fjs/fsc/todo/compile-modules-to-edag.md) — module
  parameters are dependency export objects.
- [Module resolution](../../fjs/fsc/todo/module-resolution-compatibility.md)
  — reuse the declared host identity and loading contract.
- [Namespace imports](./2220-namespace-import.md) and
  [export lists](./export-lists.md) — separate syntax work.
