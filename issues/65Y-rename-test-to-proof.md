# 65Y-rename-test-to-proof. Rename `test.f.ts` / `test.f.js` to `proof.f.ts` / `proof.f.js`

**Priority:** P4
**Status:** done

## Problem

There are currently ~80 files named `test.f.ts` or `test.f.js` across the repo.
The canonical extension for FunctionalScript test/proof files is `proof.f.ts` /
`proof.f.js` — reflected in `isTest` and the scenario runner conventions — but
the bulk of the codebase still uses the old `test.f.ts` name.

## Proposal

Rename all `test.f.ts` → `proof.f.ts` and `test.f.js` → `proof.f.js`.
Update any imports or references that point to the old names.

`isTest` in `fs/dev/module.f.ts` already recognises both suffixes, so the rename
is purely mechanical — no logic changes needed. The `isTest` check for `test.f.ts`
/ `test.f.js` can be removed once all files are renamed.

## Related

- [i204](./204-test-ts-js-support.md) — `.ts`/`.js` test file support
