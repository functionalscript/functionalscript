# Leaf recursion and property blockers

**Priority:** P2
**Status:** wip

Five leaf modules still use constructs the current compiler refuses after
[PR #3921](https://github.com/functionalscript/functionalscript/pull/3921).
Convert their reported blockers while preserving values, evaluation order,
recursive behavior and shared expression identities. The language's admission
rules do not change.

## Tasks

- Replace the native Set in [the syntax reader](../compiler/parser/syntax/module.f.mjs) with the shared persistent set.
- Resolve the `region` forward reference in [EDAG to FAST](../edag/to_fast/module.f.mjs), preserving its trampoline and shared bindings.
- Make computed accesses explicit in [the coverage cache](../emergent_testing/cov/cache/module.f.mjs).
- Resolve the `valueExp` forward reference in [NaNVM](../nanvm/module.f.mjs), preserving shared values and nested return lowering.
- Read prohibited own properties through shared helpers in [website pages](../website/page/module.f.mjs).
- Rename any module accepted whole to `.f.js`, update its references, and validate the changed scopes.
