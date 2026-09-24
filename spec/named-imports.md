# Named imports

**Status:** implemented in [#2248](https://github.com/functionalscript/functionalscript/pull/2248),
on top of [#2245](https://github.com/functionalscript/functionalscript/pull/2245).

This completed proposal was originally `spec/todo/named-imports.md`. It is
retained here with its authorization record; the supported language contract
lives in [Importing Other Modules](./README.md#importing-other-modules).

## Language-design authorization

**Approving designer:** Sergey Shandar (`sergey-shandar`), the language designer
named in [DESIGN.md](../doc/DESIGN.md#new-language-features-start-with-a-todo).

Before implementation, Sergey requested:

> Implement spec/todo/named-imports.md on top of 2245 PR.

He then confirmed: “do it”. The [authorization record](https://github.com/functionalscript/functionalscript/pull/2248#issuecomment-5821910687)
transcribes those instructions from the implementation conversation. Codex
published that record during review, after implementation; it is not a link to
the original private conversation or a new designer approval. The original
proposal was deleted without recording the existing authorization there; this
document corrects that omission without changing the language-design rule.

The implemented scope is named lists and aliases, trailing commas,
`default as name`, combined default/named imports, and empty lists. Namespace
imports, string-literal import names, bare side-effect imports, and re-exports
remain unsupported.

## Problem

Before this implementation, `export const`, named-only modules and the complete
module export object already worked, but the parser accepted only default
imports. FJS source could not consume a dependency's named exports using its
ordinary JavaScript imports. This blocked the
[named-module MVP example](../todo/fjs-nanvm-integration.md#named-module-acceptance).

## Design

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

Benefit: existing named-export modules compose using familiar JavaScript
syntax, without default-export adapters. Cost: import records and binding
validation must retain both the exported and local names through parsing and
linking. No new EDAG operation or function-parameter representation is needed.

## Completed tasks

- [x] Record the designer's pre-implementation authorization and the grammar
      scope above. The public record was added during review.
- [x] Extend the shared grammar, import records and binding checks; preserve
      existing default imports and JSON import-attribute rules.
- [x] Lower and resolve named selections from complete dependency export
      objects in the compiler's value and EDAG paths, preserving module scope,
      captures, shared identity and required evaluation.
- [x] Prove named-only and mixed-export dependencies, aliases, missing versus
      `undefined` exports, invalid bindings, repeated/diamond imports and
      failures in unused imports. Compare original JavaScript, both EDAG
      evaluators, source round trips and generated Rust for admitted cases.
- [x] Complete the linked MVP example and fold implemented syntax into
      `spec/README.md`; leave unsupported forms explicit.

## Related

- [Exports](./README.md#exporting-a-value) — existing export-object contract.
- [Module compilation](../fjs/fsc/todo/compile-modules-to-edag.md) — module
  parameters are dependency export objects.
- [Module resolution](../fjs/fsc/todo/module-resolution-compatibility.md)
  — reuse the declared host identity and loading contract.
- [Namespace imports](./todo/2220-namespace-import.md) and
  [export lists](./todo/export-lists.md) — separate syntax work.
