/**
 * The authored `.f.js` package fixture of
 * [`.f.js` package support](../../todo/f-js-package-support.md): a module the
 * current compiler accepts, which nothing but its own proof imports. The
 * repository type-checks it because the root `tsconfig.json` includes it, not
 * because an `.mjs` root reaches it; `prepack` writes its `module.f.d.ts`, and
 * `npm pack` ships both.
 *
 * @module
 */

/** @type {(a: number) => (b: number) => number} */
export const add = a => b => a + b;
