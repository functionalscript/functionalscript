## `readJsonFile` / `writeJsonFile` helpers

**Priority:** P3
**Status:** on-hold

> **Drift note (2026-06-12).** The `dev/version` module is gone and `fjs/dev/module.f.mjs` no longer reads or writes `deno.json`. The only remaining JSON-file call site is the `ci` write, which is below the second-consumer bar for extracting `writeJsonFile`, and there are no production JSON-file reads at all. On hold until a second real consumer appears; the design below remains valid when it does.

Three modules independently open-code "read a file, UTF-8 decode it, JSON-parse it" and "JSON-stringify a value, UTF-8 encode it, write the file". This is a single concern currently scattered and copied.

### Proposed abstraction

A small shared module (e.g. `fjs/effects/node/json/module.f.mjs`) over the existing effects:

Both sides go through `fjs/media/json`, not through the host's `JSON`: `parse`
is total, so a malformed file is an `error` the caller destructures rather than
a panic nothing can catch.

```ts
export const readJsonFile = (path: string): Effect<ReadFile, Result<Unknown, string>> => begin
    .step(() => readFile(path))
    .step(v => pure(parse(utf8ToString(unwrap(v)))))

export const writeJsonFile = (path: string) => (value: Unknown): Effect<WriteFile, void> =>
    writeFile(path, utf8(stringifyIndented(sort)(value)))
```

### Caveats

- `readJsonFile` returns `Result<Unknown, string>`; callers destructure the
  failure and run their own RTTI validation on the `Unknown`.
- `writeJsonFile` writes indented output, which `fjs/media/json`'s `stringify`
  does not yet produce — the indenting serializer is phase 5 of
  [remove-native-json](../../../media/json/todo/remove-native-json.md), and this
  design depends on it landing first (`stringifyIndented` above is a placeholder
  for whatever that phase names it).
- `value` is `Unknown` (`fjs/media/json`), not `unknown`: `serialize` has no
  `undefined` or `bigint` case, so the type is the check.
- Confirm the `Effect` result type of `writeFile` so the helper's signature matches.
- Must depend only on `effects`, `text`, `media/json`, and `result` — not on
  Node built-ins.

### Related

- `fjs/effects/node/module.f.mjs` — `readFile`/`writeFile` effects.
- `fjs/text/module.f.mjs` — `utf8`/`utf8ToString`.
- [`fjs/media/json/module.f.mjs`](../../../media/json/module.f.mjs) — `parse` and
  `stringify`, the FunctionalScript pipeline both helpers sit on.
