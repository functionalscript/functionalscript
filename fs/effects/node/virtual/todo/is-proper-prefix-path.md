## is-proper-prefix-path. `isProperPrefix` belongs in `fs/path`

**Priority:** P4
**Status:** done

### Problem

`fs/effects/node/virtual/module.f.ts:229-230` defines a pure path-segment
predicate inline in the FS interpreter:

```ts
const isProperPrefix = (prefix: readonly string[], path: readonly string[]): boolean =>
    prefix.length < path.length && prefix.every((seg, i) => seg === path[i])
```

used by `rename` (`:240`) to reject renaming a directory into its own
subtree or onto an ancestor. "Is `prefix` a strict ancestor path of `path`"
is path semantics, not interpreter logic — `fs/path` already owns
segment-level path reasoning (`parse`, `normalize`, `relativize`), and
`relativize` even does the string-level cousin (`path.startsWith(base)`).
Per AGENTS.md, moving conceptually distinct logic to its natural module is
appropriate even with a single consumer.

A segment-based containment predicate is also the pure primitive the CAS
path-boundary hardening wants: `fs/cas/mcp/module.f.ts` currently checks
containment with string-level `startsWith`/`includes('..')`, and
`fs/cas/todo/66j-normalize-home-paths.md` asks for "compare normalized
paths … with proper directory boundary checking". This issue does not
re-file that security work — it only creates the primitive it would build
on.

### Proposal

Export `isProperPrefix(prefix: readonly string[], path: readonly string[]):
boolean` from `fs/path/module.f.ts` (with proof coverage: equal paths,
proper prefix, mismatching segment, prefix longer than path); import it in
the virtual FS `rename`. Keep it pure and segment-based — Node
`realpath`/symlink resolution stays with the CAS security todos.

### Tasks

- [x] Move the predicate to `fs/path/module.f.ts` with JSDoc + proof cases;
      update `rename` to import it.
- [x] `npx tsc`, `fjs t`.

### Related

- `fs/cas/todo/66j-normalize-home-paths.md` — future consumer of the
  primitive.
- `fs/path/module.f.ts` `relativize` — the string-level cousin.
