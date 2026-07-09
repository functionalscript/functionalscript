## CSI eDSL

**Priority:** P3
**Status:** open

Introduce a structured eDSL for composing ANSI CSI/SGR sequences in `module.f.ts`, analogous to the HTML eDSL in `fs/media/html/module.f.ts`.

### Motivation

Currently callers concatenate raw SGR strings (`fgGreen`, `reset`, `bold`, …) into template literals by hand. A CSI eDSL would:

- make styled output composable and refactorable without string surgery
- keep SGR codes in one place (no scattered `reset` calls)
- let the serialiser decide whether to emit codes at all (e.g. strip on non-TTY without a regex)

### Proposed shape

```ts
// A styled block: [options, children]
// options – SGR parameters to apply (e.g. bold, fgGreen)
// children – mix of plain strings and nested blocks
type Block = readonly [Options, readonly (string | Block)[]]

type Options = readonly number[]   // raw SGR parameter list, e.g. [1] for bold
```

Convenience constructors wrap the common codes:

```ts
const bold    = (children: readonly (string | Block)[]): Block => [[1],  children]
const fgGreen = (children: readonly (string | Block)[]): Block => [[32], children]
// …
```

A serialiser renders a `Block` to a string, wrapping each node's content between `\x1b[<params>m … \x1b[0m` (or omitting both when `isTTY` is false).

### Open questions

- Should `Options` be a plain `readonly number[]`, a tagged union, or a set of named flags (matching the existing `bold`/`fgGreen` constants)?
- Does nesting reset and re-apply the parent style, or do we track a style stack?
- Should the serialiser return a `List<string>` (lazy, like `html/element`) or an eagerly concatenated `string`?
