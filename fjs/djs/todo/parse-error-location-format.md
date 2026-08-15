## parse-error-location-format. `compile`: `undefined:undefined:undefined` when a `ParseError` has no metadata

**Priority:** P4
**Status:** open

### Problem

`compile` in `fjs/djs/module.f.mjs` formats every `ParseError` as
`<path>:<line>:<column> - error: <message>`, reading the three fields off
`result[1].metadata`:

```js
const metadata = result[1].metadata
return step(
    error(`${metadata?.path}:${metadata?.line}:${metadata?.column} - error: ${result[1].message}`),
    () => pure(1))
```

`ParseError.metadata` is `TokenMetadata | null`, and the transpiler raises two
errors with no token to point at — `file not found` (`transpiler/module.f.mjs:41`)
and `circular dependency` (`:80`) — both of which carry `metadata: null`. The
optional chaining then prints the literal string `undefined` three times:

```sh
$ fjs compile nope.f.mjs out.mjs
undefined:undefined:undefined - error: file not found
```

The exit code is correct (`1`); only the location prefix is wrong. It is noise
for a human and a trap for anything parsing the line as `path:line:column`.

### Proposal

Emit the prefix only when there is a location to report:

```js
const { metadata, message } = result[1]
const location = metadata === null
    ? ''
    : `${metadata.path}:${metadata.line}:${metadata.column} - `
return step(error(`${location}error: ${message}`), () => pure(1))
```

A metadata-less error then reads `error: file not found`. An alternative worth
weighing first: give these two errors real metadata — the importing module's
path is known at both sites — which fixes the message *and* tells the user which
import failed. That is the better output but a larger change, since
`TokenMetadata` also wants a line and column.

### Tasks

- [ ] Pick one of the two shapes above and implement it.
- [ ] Assert the exact `stderr` text in `fjs/djs/proof.f.mjs`'s `fileNotFound`,
      and cover the metadata-carrying branch too.
- [ ] `npx tsc` clean; `fjs t` passes.

### Related

- `fjs/djs/module.f.mjs` — the formatting site.
- `fjs/djs/transpiler/module.f.mjs:41`, `:80` — the two `metadata: null` errors.
- Split out of the `compile` exit-code issue, which fixed the exit status of
  this same branch and left the cosmetic half open.
