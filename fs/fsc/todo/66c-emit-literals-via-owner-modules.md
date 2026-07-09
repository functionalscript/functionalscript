## 66C-emit-literals-via-owner-modules. Route source-literal rendering through the owning modules

**Priority:** P4
**Status:** open

### Problem

Several modules render a value as a piece of JS/TS/JSON **source text** — a
bigint literal (`123n`) or a double-quoted string literal (`"abc"`). That
rendering is a small, well-defined concern, and the codebase already has a
natural owner for each kind. But two emitters re-spell the primitive inline
instead of calling the owner, so the same one-liner exists in several places.

This is the same shape as [i190-text-char-code-boundary](../text/todo.md)
("own the single code-unit ↔ string boundary; N modules reach into the
`String` built-in directly"), applied to literal rendering.

#### 1. bigint literal `${a}n` — owner exists, one consumer already uses it

`fs/types/bigint/module.f.ts:90` owns the bigint → source-literal renderer and
exports it:

```ts
// fs/types/bigint/module.f.ts:90
/** A string representation of the bigint (e.g., '123n'). */
export const serialize = (a: bigint): string => `${a}n`
```

`fs/djs/serializer/module.f.ts` is a good citizen — it imports the owner rather
than re-spelling the template:

```ts
// fs/djs/serializer/module.f.ts:14
import { serialize as bigintSerialize } from '../../types/bigint/module.f.ts'
// :113
case 'bigint': { return [bigintSerialize(value)] }
```

But the sibling emitter `fs/types/ts` re-implements the exact same literal by
hand:

```ts
// fs/types/ts/module.f.ts:45
case 'bigint': return `${c}n`
```

`fs/types/ts` currently imports *nothing*, so this is a pure miss: the owner is
a peer in `fs/types/` and one consumer (`djs/serializer`) already demonstrates
the intended import.

#### 2. JS string literal `JSON.stringify(s)` — the operation has a de-facto home

"Render a string as a double-quoted JS/JSON string literal" is exactly JSON
string syntax, and `fs/media/json/serializer` already concentrates it: it aliases the
built-in privately and wraps it as `stringSerialize`.

```ts
// fs/media/json/serializer/module.f.ts:28
const jsonStringify = JSON.stringify
// :33
export const stringSerialize: (_: string) => List<string> = input => [jsonStringify(input)]
```

`stringSerialize` returns a one-element `List<string>`, so it can't be reused
where a bare quoted string is needed. As a result, two other modules reach for
the raw built-in to do the same quoting:

```ts
// fs/types/ts/module.f.ts:36 — struct field key
structX(fields.map(([k, v]) => `${ro}${JSON.stringify(k)}:${v}`))
// fs/types/ts/module.f.ts:46 — string primitive literal
case 'string': return JSON.stringify(c)

// fs/emergent_testing/module.f.ts:281 — property access  obj["key"]
: `[${JSON.stringify(k)}]`
// fs/emergent_testing/module.f.ts:298 — import("path")
`import(${JSON.stringify(file)}).proof${fmtPath(path)}()`
// fs/emergent_testing/module.f.ts:311 — terminal output
`${indent}${isInteger(last) || isIdentifier(last) ? last : JSON.stringify(last)}`
```

All five sites want the identical thing: a valid double-quoted JS string
literal with correct escaping. The concept is owned by `fs/media/json/serializer`
but isn't exposed in a reusable (bare-string) form.

### Proposal

1. **bigint (do now, unambiguous).** In `fs/types/ts/module.f.ts`, import the
   owner and drop the inline template:

   ```ts
   import { serialize as bigintSerialize } from '../bigint/module.f.ts'
   // ...
   case 'bigint': return bigintSerialize(c)
   ```

   This mirrors `djs/serializer` exactly and adds no new layering (peer import
   inside `fs/types/`).

2. **string (do now where layering is clean).** Factor the bare-string renderer
   out of `stringSerialize` in `fs/media/json/serializer`:

   ```ts
   /** Renders a string as a double-quoted JS/JSON string literal. */
   export const stringLiteral = (s: string): string => jsonStringify(s)
   export const stringSerialize: (_: string) => List<string> = input => [stringLiteral(input)]
   ```

   Then route `fs/emergent_testing`'s three quoting sites through
   `stringLiteral` instead of the built-in. `emergent_testing` is
   application-level, so depending on `fs/media/json` is clean.

3. **string in `fs/types/ts` (judgment call — flag, don't force).** The two
   `JSON.stringify` sites in `fs/types/ts` are the same concern, but routing
   them through `fs/media/json/serializer` would invert the layering (`fs/types/`
   depending on `fs/media/json/`). `json/serializer` does not import `types/ts`, so
   there is no import cycle, but a `types → json` edge may still be unwanted.
   Options, in order of preference:
   - leave `types/ts` string-quoting as-is (accept the one duplicated built-in
     call) until a lower-level JS-syntax module exists; or
   - if/when a shared low-level "JS source syntax" primitive module is created,
     host `stringLiteral` (and possibly `bigintSerialize`) there so both
     `types/ts` and `json/serializer` can depend *down* onto it.

   Do **not** create a new module solely for this — per `AGENTS.md`, prefer an
   existing home; the `types/ts` string case is the only piece without a clean
   one.

### Tasks

- [ ] `fs/types/ts`: import `serialize` from `../bigint/module.f.ts`; replace
      `case 'bigint': return \`${c}n\`` with `bigintSerialize(c)`.
- [ ] `fs/media/json/serializer`: export `stringLiteral`; redefine `stringSerialize`
      in terms of it (no behavior change).
- [ ] `fs/emergent_testing`: import `stringLiteral` from `fs/media/json/serializer`;
      replace the three `JSON.stringify(...)` quoting sites (lines 281, 298,
      311).
- [ ] Decide the `types/ts` string-quoting case per the layering note above;
      record the decision in this file before closing.
- [ ] Run `npx tsc` and `fjs t`; confirm `fs/types/ts`, `fs/media/json/serializer`,
      and `fs/emergent_testing` proofs still pass with full coverage.

### Related

- [i190-text-char-code-boundary](../text/todo.md) — same
  "own the single boundary; stop reaching into the built-in" pattern for the
  char-code ↔ string conversion.
- [i176-json-file-effects](../../issues/176-json-file-effects.md) and
  i198-utf8-file-effects — a *different* JSON
  concern (whole-value `JSON.stringify(v, null, 2)` → UTF-8 → write), not the
  single-token literal rendering tracked here.
