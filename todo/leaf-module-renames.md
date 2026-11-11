# Rename compiler-accepted leaf modules

**Priority:** P2
**Status:** wip

Some authored `module.f.mjs` files already compile with their runtime
dependencies. Rename each accepted dependency leaf to `module.f.js`, update
runtime, type, proof and documentation references, and repeat until no current
leaf is accepted. Keep proof filenames and implementation behavior unchanged.

Record the final remaining refusals in `todo/fjs-nanvm-integration.md` and
complete the compiler, type, generation and scoped proof checks.
