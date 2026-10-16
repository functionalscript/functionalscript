# Checking Every `.f.js`

**Status:** implemented

```sh
fjs compile
```

With no arguments `fjs compile` checks rather than compiles. An authored
`.f.js` promises that the compiler of the same revision accepts it
([file types](file-types.md)), and `tsc` cannot keep that promise for it — it
accepts source the compiler refuses, `let a = 1; export default a;` for one,
which the compiler rejects at its first token, `1:1 - error: unexpected token`
— so this is the check that does. Every `.f.js` under the current directory
(`INIT_CWD` under `npm run`, so `npm start compile` from a subdirectory
checks that subtree), hidden entries and `node_modules` skipped as the test
runner skips them, is read and linked into its program exactly as every
output begins, its imports included, and nothing is written. An `.f.mjs`
states the intent and makes no such promise, so it is not checked, though
one an `.f.js` imports is linked with it and refuses it when refused.

Every refused file is reported on `stderr` as a compile of it would report
it, and the check goes on to the next, so one run names every file that
fails. The last line counts what the walk found: `.f.js: 3 checked, 2 refused`
on `stderr` with exit `1`, or `.f.js: 3 checked` on `stdout` with exit `0`.
A tree holding no `.f.js` passes as `.f.js: 0 checked` — the count is there
so that a walk from the wrong directory is visible. A tree that cannot be
listed fails in the host's words.

## Examples

No programs yet: this page's accepted and refused examples are a follow-up.

## Reference

- ECMA-262: none; this is FunctionalScript's own tool, not a feature of the language.
