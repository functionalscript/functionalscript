# Compile recursive schemas without forward references

**Priority:** P2
**Status:** wip

### Problem

`fjs/edag/module.f.mjs` and `fjs/media/json/rtti/module.f.mjs` are dependency
leaves blocked by mutually recursive schema declarations. Moving declarations
does not break those cycles. Rewrite the modules using the compiler's current
self-reference support; compiler forward-reference support remains separate.

### Direction

Construct recursive schema members inside their self-recursive thunks, keeping
the stable thunk as the recursion anchor. Preserve the accepted values, public
exports and type-level contracts. Document any descriptor-member identity or
allocation changes, and check the RTTI consumers that traverse these schemas.

### Tasks

- [ ] Rewrite the JSON schemas and prove nested acceptance and rejection.
- [ ] Rewrite the EDAG schemas, including optional-chain continuations.
- [ ] Compile and rename accepted modules; update runtime and type references.
- [ ] Refresh the leaf audit, generation and scoped validation.
