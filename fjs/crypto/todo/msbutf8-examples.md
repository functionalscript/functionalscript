## Examples import a nonexistent `msbUtf8`

**Priority:** P4
**Status:** open

### Problem

Two `@example` blocks show a helper that `fjs/text` does not export:

- the module JSDoc of [`../hmac/module.f.mjs`](../hmac/module.f.mjs) writes
  `import { msbUtf8 } from '../../text/module.f.mjs'` and calls
  `msbUtf8('key')`;
- the "SHA2" JSDoc above `sha2` in
  [`../sha2/module.f.mjs`](../sha2/module.f.mjs) calls `msbUtf8(…)` too.

[`fjs/text/module.f.mjs`](../../text/module.f.mjs) exports the string-to-UTF-8
bit vector as `utf8` (and the checked `tryUtf8`); `msbUtf8` is an old name. An
example a reader copies fails at its first line, and nothing checks examples.

### Tasks

- [ ] Replace `msbUtf8` with `utf8` in both examples, import included.
- [ ] `tsc`, `fjs test`.

### Related

- [`fjs/text/todo/block-module-split.md`](../../text/todo/block-module-split.md)
  — noticed the stale `hmac` example while counting `fjs/text`'s importers.
