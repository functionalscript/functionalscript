# 196. `djs/parser`: collapse the trivia + eof/default handler boilerplate

**Priority:** P3
**Status:** open

## Problem

`fs/djs/parser/module.f.ts` defines 17 token-kind handlers
(`parseInitialOp`, `parseNewLineRequiredOp`, `parseExportOp`,
`parseResultOp`, `parseConstOp`, `parseConstNameOp`, `parseImportOp`,
`parseImportNameOp`, `parseImportFromOp`, `parseValueOp`,
`parseArrayStartOp`, `parseArrayValueOp`, `parseObjectStartOp`,
`parseObjectKeyOp`, `parseObjectColonOp`, `parseObjectNextOp`,
`parseObjectCommaOp`). Almost every one of them re-spells three
near-identical clauses:

```ts
case 'ws':
case 'nl':
case '//':
case '/*': return state                     // skip trivia
case 'eof': return { state: 'error', error: { message: 'unexpected end',   metadata } }
default:    return { state: 'error', error: { message: 'unexpected token', metadata } }
```

Counts in the file today:

- `case 'ws':` / `case 'nl':` / `case '//':` / `case '/*':` — **69** instances
  (≈ 17 × 4 cases, modulo a handful of variants where `'nl'` participates
  in the grammar rather than being trivia).
- `message: 'unexpected end'` / `message: 'unexpected token'` — **33**
  instances of the two boilerplate error returns.

The DJS tokenizer keeps `ws`/`nl`/`//`/`/*` in the stream on purpose
(it threads metadata, so trivia tokens carry positions). The parser
then has to skip them at every state. That skipping is the same
operation everywhere, but each handler hand-rolls it.

`fs/json/parser/module.f.ts` does **not** have this problem: its
tokenizer drops `ws`/`nl` upstream (`mapToken` returns `empty` for
them), and there are no `//` / `/*` tokens in JSON at all. So this is
strictly a DJS-side concern and orthogonal to
[i157](./157-json-djs-shared-core.md), which extracts the *value-level*
state machine shared with JSON.

## Proposed abstraction

A single trivia-aware wrapper that takes a "core" handler over the
non-trivia, non-eof tokens, and decorates it with the three boilerplate
branches:

```ts
// fs/djs/parser/module.f.ts (private)
type CoreHandler<S> = (token: DjsToken, metadata: TokenMetadata, state: S) => ParserState

const wrap =
    <S extends { readonly state: ParserState['state'] }>
    (core: CoreHandler<S>) =>
    ({ token, metadata }: DjsTokenWithMetadata) => (state: S): ParserState => {
        switch (token.kind) {
            case 'ws':
            case 'nl':
            case '//':
            case '/*': return state
            case 'eof':
                return { state: 'error', error: { message: 'unexpected end', metadata } }
            default:
                return core(token, metadata, state)
        }
    }

const unexpectedToken = (metadata: TokenMetadata): ParserState =>
    ({ state: 'error', error: { message: 'unexpected token', metadata } })
```

Each handler then collapses to its grammar-relevant cases plus an
explicit `default: return unexpectedToken(metadata)`:

```ts
const parseConstOp = wrap<ConstState>((token, metadata, state) => {
    if (token.kind === 'id') {
        if (at(token.value)(state.module.refs) !== null) {
            return { state: 'error', error: { message: 'duplicate id', metadata } }
        }
        const cref: AstModuleRef = ['cref', length(state.module.consts)]
        return { ...state, state: 'const+name', module: {
            ...state.module, refs: setReplace(token.value)(cref)(state.module.refs)
        } }
    }
    return unexpectedToken(metadata)
})
```

Three handlers diverge from the default trivia rule and need to opt
out of the wrapper (or use a small variant):

- `parseNewLineRequiredOp` — `'nl'` is **not** trivia here; it
  transitions `state: 'nl' → state: ''`. Keep this handler hand-written.
- `parseResultOp` — `'eof'` is **not** an error; it terminates
  acceptance. Keep this handler hand-written (or extend `wrap` with an
  `onEof` parameter).
- The value-level `'eof'` handlers (`parseValueOp`, `parseArrayStartOp`,
  `parseArrayValueOp`, `parseObjectStartOp`, `parseObjectKeyOp`,
  `parseObjectColonOp`, `parseObjectNextOp`, `parseObjectCommaOp`) all
  fold into i157's value-parser factory anyway; this issue covers the
  10 module-level handlers (`parseInitialOp`, `parseExportOp`,
  `parseConstOp`, `parseConstNameOp`, `parseImportOp`,
  `parseImportNameOp`, `parseImportFromOp`, plus any value-level ones
  not absorbed by i157).

## Why this qualifies

- DRY: 17 consumers in a single file, far past the second-consumer
  bar. The trivia + eof + default-error trio is one concept (token-stream
  preamble), not three separate switch arms repeated everywhere.
- Separation of concerns: skipping comments/whitespace is a
  tokenizer-vs-parser detail; today the parser bakes that knowledge into
  every state. Lifting it into one wrapper isolates the "DJS allows
  comments and whitespace anywhere" rule to one location.
- Readability: each handler's grammar-relevant lines shrink to the
  cases that actually matter for that state. Today the grammar is buried
  under boilerplate.
- Maintainability: if a new trivia token is added (e.g. `'#'`
  comments from [i83](./README.md)), there is one place to update,
  not 17.

## Caveats / why this is an idea, not a mechanical edit

- **i157 dependency.** The value-level handlers
  (`parseValueOp`/`parseArrayStartOp`/…) should be extracted via
  [i157](./157-json-djs-shared-core.md) first. After that, the trivia
  wrapper covers only the DJS module-framing handlers (≈ 10 sites)
  rather than 17. Either order works; the result is the same end state.
- **The `'nl'` exception.** `parseNewLineRequiredOp` deliberately treats
  `'nl'` as *the* significant token, not trivia. Don't fold it into
  `wrap` without explicit opt-out (e.g. a flag, or a different wrapper).
- **`ParserState` shape.** The wrapper returns `ParserState` (the union
  of all state-kind branches), so the type system can't statically
  enforce that the core handler returns "same-state-kind only" — it can
  legitimately transition to a different state. Today's handlers already
  exploit this freely (e.g. `parseInitialOp` transitions to `'import'`,
  `'const'`, `'export'`, or `'exportValue'`), so the wrapper signature
  must accept `ParserState` returns.
- **Don't over-abstract.** A `wrap` with five different opt-out flags is
  worse than the current code. If more than ~2 handlers need to escape
  the default, keep those few hand-written instead of growing the
  wrapper's API surface.

## Related

- [i157](./157-json-djs-shared-core.md) — extracting the JSON value-state
  machine shared with DJS. Reduces the 17 handlers to ~10 before this
  refactor is applied.
- [i83](./README.md) — `#` comments. A successful extraction here makes
  that change a one-line edit to the wrapper's trivia case list.
- [i165](./165-layered-parser.md) — a layered tokenizer/parser design
  that, if adopted, would push trivia handling entirely into the
  tokenizer layer and obviate this issue. This proposal targets the
  current architecture.
