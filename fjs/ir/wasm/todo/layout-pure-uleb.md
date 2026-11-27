## Move `fjs.layout` ULEB decode into FunctionalScript

**Priority:** P3
**Status:** open

`fjs/ir/wasm/layout.mjs` holds the unsigned LEB128 walk that reads a
module's `fjs.layout` custom section beside the `WebAssembly.Module.customSections`
call. The walk is pure (bytes in, numbers out) but uses in-place `push`, so it
stays in `.mjs` today.

Rewrite the decode in a co-located `.f.js` without mutation, keep only the
`customSections` edge in `.mjs`, and have that host wrapper import the
FunctionalScript decode.
