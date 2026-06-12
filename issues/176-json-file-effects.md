# 176. `read`/`write` JSON file effect helpers

**Priority:** P3
**Status:** on-hold

> **Drift note (2026-06-12).** [i198](./198-utf8-file-effects.md) is done, so
> this is no longer blocked — but the consumer inventory below is stale. The
> `dev/version` module is gone and `fs/dev/module.f.ts` no longer reads or
> writes `deno.json`. The only remaining JSON-file call site is the `ci` write
> (`writeUtf8File('.github/workflows/ci.yml', JSON.stringify(gha, null, '  '))`),
> which is below the second-consumer bar for extracting `writeJsonFile`, and
> there are no production JSON-file reads at all. On hold until a second real
> consumer appears; the design below (now a one-line composition over
> `readUtf8File`/`writeUtf8File`) remains valid when it does.

Three modules independently open-code "read a file, UTF-8 decode it, JSON-parse
it" and "JSON-stringify a value (pretty, 2-space), UTF-8 encode it, write the
file". This is a single concern — JSON file I/O over the `ReadFile`/`WriteFile`
effects — currently scattered and copied.

```ts
// fs/dev/version/module.f.ts:15  (read)
const readJson = (name: string) => begin
    .step(() => readFile(jsonFile(name)))
    .step(v => pure(parse(utf8ToString(unwrap(v)))))
// fs/dev/version/module.f.ts:21  (write)
.step(json => writeFile(jsonFile(name), utf8(stringify({ ...json, version }, null, 2))))

// fs/dev/module.f.ts:119  (read)
.step(() => readFile(denoJson))
.step(v => pure(unwrap(parseDenoJson(jsonParse(utf8ToString(unwrap(v)))))))
// fs/dev/module.f.ts:132  (write)
const json = JSON.stringify({ ...jsr_json, exports }, null, 2)
return writeFile(denoJson, utf8(json))

// fs/ci/module.f.ts:53  (write)
writeFile('.github/workflows/ci.yml', utf8(JSON.stringify(gha, null, '  ')))
```

The read half (`readFile` → `unwrap` → `utf8ToString` → `JSON.parse`) appears in
2 modules; the write half (`JSON.stringify(_, null, 2|'  ')` → `utf8` →
`writeFile`) appears in 3.

## Proposed abstraction

A small shared module (e.g. `fs/effects/node/json/module.f.ts`, or exported from
`fs/dev` if kept dev-only) over the existing effects:

```ts
export const readJsonFile = (path: string): Effect<ReadFile, unknown> => begin
    .step(() => readFile(path))
    .step(v => pure(JSON.parse(utf8ToString(unwrap(v)))))

export const writeJsonFile = (path: string) => (value: unknown): Effect<WriteFile, void> =>
    writeFile(path, utf8(JSON.stringify(value, null, 2)))
```

- `dev/version`: `readJson(name) = readJsonFile(jsonFile(name))`;
  the write becomes `writeJsonFile(jsonFile(name))({ ...json, version })`.
- `dev`: `index2`'s read becomes `readJsonFile(denoJson)` (then the existing
  `parseDenoJson`/`unwrap` RTTI validation on the parsed value); the write
  becomes `writeJsonFile(denoJson)({ ...jsr_json, exports })`.
- `ci`: `writeJsonFile('.github/workflows/ci.yml')(gha)` (the `'  '` vs `2`
  indent difference is cosmetic — both produce 2-space JSON — so unifying on
  `2` is safe).

## Why this qualifies

- Read: 2 real consumers; write: 3. Both past the second-consumer bar.
- Separation of concerns: "JSON over a file effect" is one idea; today each
  consumer re-threads `unwrap`/`utf8ToString`/`stringify` by hand, which is easy
  to get subtly wrong (e.g. the `null, 2` vs `null, '  '` drift already exists).

## Caveats / why this is an idea, not a mechanical edit

- **Where it lives.** All three consumers are build/dev tooling, not the public
  `fs` data libraries. `fs/io` is `@deprecated`, so prefer a fresh
  `fs/effects/node/json` (effect-based) or keep it adjacent to `dev`. It must depend only
  on `effects`, `text`, and `result` — not on Node built-ins — to stay a
  FunctionalScript module.
- **Parsed type.** `readJsonFile` returns `unknown`; `dev` then runs RTTI
  `parseDenoJson` and `dev/version` reads `.version` off it. Keep the validation
  at the call site rather than baking a schema into the helper.
- **`writeFile` return type.** Confirm the `Effect` result type of `writeFile`
  in `effects/node` so the helper's signature matches (the sketch above assumes
  `void`).

## Related

- `fs/effects/node/module.f.ts` — `readFile`/`writeFile` effects.
- `fs/text/module.f.ts` — `utf8`/`utf8ToString`.
