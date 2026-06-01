# 661. `dev` re-implements path normalization that belongs in `fs/path`

**Priority:** P4
**Status:** open

`AGENTS.md` gives "path manipulation belongs in `fs/path`, not inline in a
loader" as the canonical separation-of-concerns example. There is a live
instance of exactly that: the module loader normalizes Windows separators
inline instead of going through `fs/path`.

```ts
// fs/dev/module.f.ts:129 — inside loadModuleMap (a loader)
const initCwd = env['INIT_CWD']
const s = initCwd === undefined ? '.' : `${initCwd.replaceAll('\\', '/')}`
```

```ts
// fs/path/module.f.ts:34 — inside parse, the canonical home for this
const split = path.replaceAll('\\', '/').split('/')
```

The `replaceAll('\\', '/')` separator conversion is the one piece of path
knowledge that `fs/path` already documents as its own
("Windows separators are converted to POSIX separators", `parse`'s JSDoc), yet
`dev` re-codes it inline.

## Why not just call `normalize`

`path.normalize` is **not** a drop-in here: it also drops empty segments, so an
absolute POSIX path loses its leading slash (`normalize('/home/user')` →
`'home/user'`), and it collapses `.`/`..`. `loadModuleMap` needs only the
separator conversion — it does its own `'.'` handling on the next line
(`prefix = s === '.' ? '' : s`). So reusing `normalize` would change behaviour.

## Proposed fix

Export the narrow helper from `fs/path` and use it in both places:

```ts
// fs/path/module.f.ts
/** Converts Windows separators (`\`) to POSIX separators (`/`). */
export const toPosix = (path: string): string => path.replaceAll('\\', '/')

export const parse = (path: string): readonly string[] => {
    const split = toPosix(path).split('/')
    return toArray(fold(foldNormalizeOp)([])(split))
}
```

```ts
// fs/dev/module.f.ts
import { toPosix } from '../path/module.f.ts'
...
const s = initCwd === undefined ? '.' : toPosix(initCwd)
```

(The `${...}` template wrapper at `dev/module.f.ts:129` is also redundant —
`initCwd` is already a `string` — and disappears with the rewrite.)

## Why this qualifies

- **Separation of concerns:** OS-path manipulation is `fs/path`'s
  responsibility; a module loader should not contain a `\` → `/` rule. This is
  the exact pattern `AGENTS.md` calls out.
- **DRY:** two real consumers of one rule (`path.parse` and `dev`), so the
  shared `toPosix` is justified rather than speculative.

## Caveats

- Tiny change; `fs/dev` already imports from sibling modules, and `fs/path`
  has no `.f.ts` import restrictions to worry about.
- Confirm no other `replaceAll('\\', '/')` sites exist before landing
  (`grep -rn "replaceAll('\\\\'" fs` found only these two).
