## `readJsonFile` / `writeJsonFile` helpers

**Priority:** P3
**Status:** on-hold

> **Drift note (2026-06-12).** The `dev/version` module is gone and `fjs/dev/module.f.ts` no longer reads or writes `deno.json`. The only remaining JSON-file call site is the `ci` write, which is below the second-consumer bar for extracting `writeJsonFile`, and there are no production JSON-file reads at all. On hold until a second real consumer appears; the design below remains valid when it does.

Three modules independently open-code "read a file, UTF-8 decode it, JSON-parse it" and "JSON-stringify a value, UTF-8 encode it, write the file". This is a single concern currently scattered and copied.

### Proposed abstraction

A small shared module (e.g. `fjs/effects/node/json/module.f.ts`) over the existing effects:

```ts
export const readJsonFile = (path: string): Effect<ReadFile, unknown> => begin
    .step(() => readFile(path))
    .step(v => pure(JSON.parse(utf8ToString(unwrap(v)))))

export const writeJsonFile = (path: string) => (value: unknown): Effect<WriteFile, void> =>
    writeFile(path, utf8(JSON.stringify(value, null, 2)))
```

### Caveats

- `readJsonFile` returns `unknown`; callers run their own RTTI validation.
- Confirm the `Effect` result type of `writeFile` so the helper's signature matches.
- Must depend only on `effects`, `text`, and `result` — not on Node built-ins.

### Related

- `fjs/effects/node/module.f.ts` — `readFile`/`writeFile` effects.
- `fjs/text/module.f.ts` — `utf8`/`utf8ToString`.
