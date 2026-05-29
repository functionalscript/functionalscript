# 75. Rewrite namespace import to use `import type`.

**Priority:** P3
**Status:** open

Rewrite [./lang/2220-namespace-import.md](./lang/2220-namespace-import.md) to use `import type A from "x.js"`. FJS should just ignore this. It's a part of type stripping. Type stripping blockers:

- Node.js (even 24) can't use `.ts` files from `./node-modules/`.
- Node, Deno, and TypeScript don't allow the use of type annotations in `.js` files. See the proposal.
- Browsers don't support type annotations and `.ts` files.
