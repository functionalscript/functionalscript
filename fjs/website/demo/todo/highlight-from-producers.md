# Highlight from the producer, not by reparsing

**Priority:** P3
**Status:** open — design only. It builds on a reparsing highlighter,
`website/demo/highlight/module.f.mjs`, proposed on the branch
`claude/gracious-euler-dw2lsd` and not on `main` yet; it is the fallback this
design keeps.

## Problem

The demos print code the repository itself generated: the serializer's `.js`,
the parser's DataJS, the compiler's `.json`, `.data.js`, `.edag.data.js` and
`.rs`. `highlight` colours it by tokenizing the text again. That is the wrong
direction of information flow:

- **The producer already knew.** The serializer wrote `const` and a string
  literal on purpose; the demo then rediscovers both from characters. If the
  two ever disagree, the colours are silently wrong
  ([DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
  refuses plausible wrong answers).
- **A language the tokenizer cannot read stays plain.** The Rust pane is
  uncoloured for that reason alone.
- **The work is done twice.** Every render of a block tokenizes it.

The proposal is to let a producer *say* what it wrote.

## Established practice

Highlighting has settled into a few shapes. They differ in where the
classification comes from and how it is attached to the text.

| Practice | Where classes come from | How they are attached to text |
| -------- | ----------------------- | ----------------------------- |
| [LSP semantic tokens](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_semanticTokens) (3.16+) | The language server, which has parsed and bound the program | Beside the text: a flat integer array, five numbers per token — `deltaLine`, `deltaStartChar` (relative to the previous token), `length`, an index into a *legend* of token types, a bitset of modifiers |
| [TextMate grammars](https://macromates.com/manual/en/language_grammars), as in VS Code | Regex rules over the text; no parser | Scope names, hierarchical and dotted (`keyword.control`, `string.quoted.double`), mapped to colours by a theme matching prefixes |
| [Tree-sitter highlight queries](https://tree-sitter.github.io/tree-sitter/3-syntax-highlighting.html) | A real parse tree, queried with patterns that *capture* nodes (`@keyword`, `@string`) | An event stream: start-of-class, source slice, end-of-class |
| [Pygments](https://pygments.org/docs/lexerdevelopment/) | A lexer per language | A stream of `(token type, text)`; types are a dotted hierarchy (`Keyword.Constant`); concatenating the texts gives the input back |
| [Shiki](https://shiki.style/) | TextMate grammars | Lines of `{ content, color/scopes }` runs, then rendered to HTML |
| [Roslyn](https://learn.microsoft.com/dotnet/api/microsoft.codeanalysis.classification.classifiedspan) (`ClassifiedSpan`) | Syntax *and* semantic model | A `ClassifiedSpan(classificationType, textSpan)` list beside the text |
| [rustdoc](https://doc.rust-lang.org/rustdoc/) | `rustc_lexer`, run over the code block | Inline `<span class="…">`; it *reparses*, as our `highlight` does |
| Source maps ([ECMA-426](https://tc39.es/ecma426/)) | The generator, which knows what it emitted | A side table of relative-encoded (VLQ) segments beside the output file |

What they share, and what we take from it:

1. **Highlighting is a separate layer from the text.** None of them changes
   the text; the colours are metadata. We keep that: the text a producer
   writes is byte-for-byte what `fjs compile` writes to a file.
2. **A closed, named vocabulary.** LSP publishes a legend with standard
   types (`keyword`, `string`, `number`, `comment`, `operator`, `function`,
   `variable`, `property`, …) so that themes work across servers. We use
   those names where they exist, rather than inventing ours, and add a kind
   where the semantics differ and LSP has none — as LSP's legend allows a
   server to, and as TextMate (`constant.language`) and Tree-sitter
   (`@boolean`, `@constant.builtin`) both do for `true`, `false` and `null`.
   Hence `literal` beside `keyword`.
3. **The producer that knows should say.** LSP semantic tokens exist because
   a lexer-level highlighter (TextMate) cannot tell a type from a variable;
   the server can. A generator is the extreme case: it needs no inference at
   all. Source maps are the closest precedent in kind — a generator
   reporting, alongside its output, what it knows about it, and a reader not
   rederiving it.
4. **Reparsing is respectable when there is no producer.** rustdoc, Pygments
   and TextMate all classify from text because the text is all they get.
   That is our situation for a pasted example, and it is why the existing
   `highlight` stays as the fallback (below).

What we leave:

- **Hierarchical scopes and themes** (TextMate, Pygments). One stylesheet
  maps a handful of kinds; a dotted hierarchy is machinery with no second
  consumer.
- **Modifiers** (LSP's `declaration`, `readonly`, …). Nothing here needs
  them yet; adding a field later is a compatible change.
- **Delta/VLQ integer encoding** (LSP, source maps). It exists to make large
  files cheap on a wire. A demo's block is a few kilobytes in memory, and
  [DESIGN.md](../../../../doc/DESIGN.md) puts simplicity above optimization.
- **Positions in the protocol's units.** LSP counts UTF-16 code units
  (negotiable since 3.17); our tokenizer counts code points. Any offset
  scheme has to pick one and convert at the edge. See the first alternative
  for how to avoid picking.

## Design

### The shape: marked text, a list of runs

```ts
/**
 * What a run of text is. The names are LSP's standard token types, plus
 * `literal` for `true`, `false`, `null` and `undefined`, which LSP has no
 * type for. A kind states what the producer wrote, never how it looks.
 */
export type TokenKind = 'keyword' | 'literal' | 'string' | 'number' | 'comment' | 'operator' /* … */

/** A run of text and, when it has one, its kind. */
export type Run = readonly [text: string, kind?: TokenKind]

/** A text written as runs. The runs' texts, concatenated, are the text. */
export type Marked = readonly Run[]
```

This is Pygments's stream and Shiki's lines, and it is what Tree-sitter's
event stream flattens to. It is the right shape for a *generator*, for two
reasons that an LSP-style offset table does not share:

- **The text cannot disagree with its markup.** With `(offset, length, kind)`
  spans a producer must track how much it has written, and an off-by-one is a
  silent wrong colour. With runs, the text *is* the runs; there is nothing to
  keep in step.
- **No unit to choose.** Runs contain strings; whether a position is a code
  point or a UTF-16 unit never arises.

### One implementation per producer

A producer returns `Marked` and the plain text is derived from it:

```js
export const toText = marked => marked.map(([text]) => text).join('')
```

Not two code paths (`stringify` and `stringifyMarked`) that can drift: the
serializer builds runs once, `tryModuleStringify` is `toText` of that, and
the demo renders the runs. This is the repository's reuse rule
([AGENTS.md §1](../../../../AGENTS.md#1-workflow)): one implementation,
with the plain text as a view of it. The CLI pays for allocating runs it
immediately joins; that is the optimization trade the principles rule out
worrying about until it is measured.

### Rendering

`render(marked)` maps a run with a kind to
`['span', { 'data-token': kind }, text]` and a run without one to its bare
string. The stylesheet already owns the colours
([`style/module.f.mjs`](../../style/module.f.mjs)). Refusal of unknown kinds
is the type's job; the renderer needs no table.

### Where LSP's shape still fits: marking an existing text

Runs suit producers. They suit *annotating a text that already exists* less:
the rtti demo's `mark` of a failing member, or the tokenizer fallback, both
know ranges, not a rewrite. For those, an offset form is natural and is what
LSP and Roslyn use. So keep one converter and one direction:

```js
/** Spans beside a text, as runs. Refuses overlapping or out-of-range spans. */
export const fromSpans = text => spans => marked
```

Overlap and range are refused, not drawn
([DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle));
LSP itself forbids overlapping tokens unless the client opts in
(`overlappingTokenSupport`), for the same reason. Offsets are in code points,
as the tokenizer's metadata already is, converted once in `fromSpans`.

### The fallback

`highlight(text)` stays, re-expressed as `Marked` through `fromSpans`: the
tokenizer finds spans, `fromSpans` builds runs. It serves any text with no
producer behind it — an example typed by the reader — and is what a
producer's markup is **proved against**: for each shared example, the
serializer's `.js` runs equal what the tokenizer would find in the same
text. That makes the tokenizer the oracle for the producer without making it
a runtime dependency of the demo.

## Invariants

What the types and functions above promise, each testable:

1. **Text is preserved.** `toText(marked)` is exactly the text the producer
   would have written without markup. Markup never adds, drops, reorders or
   escapes a character.
2. **A kind is semantic, never presentational.** Two kinds that the
   stylesheet happens to draw alike (`keyword` and `literal` today) stay two
   kinds: the colour is the page designer's choice and may change, or differ
   in another renderer, while the data keeps what the producer knew.
3. **Kinds are closed.** A run's kind is one of `TokenKind` or absent. A
   producer cannot invent a kind; an unknown one is a type error, and the
   stylesheet has a rule for each.
4. **Runs are flat.** No run nests inside another and none overlaps; a
   region with two properties gets one kind or is split. (LSP forbids
   overlap unless the client opts in; nothing here would.)
5. **Empty runs carry nothing.** A producer may emit `['']`, and `render`
   drops it; no span is drawn around nothing.
6. **`fromSpans` refuses, never repairs.** Overlapping, negative,
   out-of-range or non-integer spans are an error, not a clamp.
7. **Producers are total over the same inputs as before.** Marking a
   producer changes no input it accepts or refuses, and no refusal message.

## Proof obligations

A migration step is done when its proof, which owes 100% coverage as every
module does, pins:

- **Round trip:** `toText` of the producer's runs equals the producer's
  pre-markup output for every example in
  [`compiler/examples`](../../../compiler/examples/module.f.js). The old
  output is the expected value, so a step cannot change what the CLI writes.
- **The oracle:** the runs' kinds equal what the tokenizer fallback finds in
  the same text, for the languages it reads (`.js`, `.json`, `.data.js`,
  `.edag.data.js`). Rust has no oracle; its proof is the round trip plus a
  table of expected runs for a small example.
- **`fromSpans`:** one accepted case per kind, and one refusal for each
  member of invariant 6.
- **`render`:** the HTML for a run with a kind, one without, and an empty
  one.
- **The demo's view,** for the initial state, each example and one refused
  input, as [`../README.md`](../README.md#what-a-demos-proof-covers) already
  asks.

## Crossing the compiler boundary

[`compiler/todo/output-demos.md`](../../../compiler/todo/output-demos.md)
requires the side-by-side page to run the real `compile`, "so it cannot
drift from the CLI". A file system carries text, so markup cannot cross it,
and a design that recovered the runs by calling each producer separately
would break that requirement. The seam exists already, though:
`compileFile` is `outputText(outputFileName)(inputFileName)`, which yields
`Result<string, string>`, followed by the one write of that string to the
output file. Steps 2–4 therefore make it:

- `outputText` yields `Result<Marked, string>`, a pure function of the
  input, the same one `compileFile` calls;
- `compileFile` applies `toText` before the write, so a file is unchanged;
- the side-by-side page runs `outputText` over the in-memory file system,
  exported for the purpose, and renders its runs.

What the page then skips is the tail of the real path — creating the
directory, the write, the exit code — none of which decides what a pane
shows. What it keeps is every line that does. To keep "cannot drift"
literally true, the page's proof also runs the whole `compile` once per
output and example, and asserts the file it writes equals `toText` of the
runs the page renders. That narrows the existing requirement from "runs
`compile`" to "runs the text `compile` writes, and proves it", and the PR
for step 4 amends `output-demos.md` to say so.

Until step 4, the side-by-side page keeps the tokenizer fallback, so the
other pages migrate without waiting on it. The stage pages — tokenizer,
parser, serializer, Rust — call their stage's function directly and are not
affected.

## Migration, one pull request each

1. Types and `toText`, `render`, `fromSpans`; `highlight` becomes a
   `Marked` producer. Demos unchanged in behaviour.
2. The `.js` serializer produces runs; `tryModuleStringify` is `toText` of
   them; the proof pins runs against the tokenizer oracle over
   [`compiler/examples`](../../../compiler/examples/module.f.js).
3. The Rust generator. This is the case reparsing cannot reach, and the
   reason to do any of this.
4. DataJS and JSON writers; the parser demo stops calling `highlight`. The
   compiler's `outputText` then yields `Marked`, and the side-by-side page
   renders it, as [Crossing the compiler boundary](#crossing-the-compiler-boundary)
   describes. Until then that page keeps the fallback.

Each step is independently shippable and leaves the page working.

## Alternatives considered

- **LSP-style spans as the primary type.** Familiar and compact, and what a
  language-server-literate reader expects. Rejected for producers because
  the text and offsets can disagree and the unit (UTF-16 vs code point) has
  to be chosen and converted. Kept as `fromSpans` for annotation.
- **Inline markup in the text** (HTML or control characters in the string).
  Rejected: the text is also what the CLI writes and what a copy button
  copies, so markup in it corrupts both. Every established practice above
  keeps the layers apart.
- **Keep reparsing** (the current state). Correct for an unknown text and
  cheap to keep; rejected as the *only* mechanism for the reasons in
  Problem, chiefly Rust and silent disagreement.
- **A full theme/scope system** (TextMate, Pygments). No second consumer;
  see "What we leave".

## Open questions

Each carries the author's leaning, to be overruled in review.

- **Names versus properties.** A producer knows a key from a variable and a
  function name from a parameter, which a lexer does not. *Leaning: ship the
  lexical kinds first.* Adding `property` or `function` later is additive,
  and the oracle cannot check kinds the tokenizer cannot see.
- **A location for the shared code.** `website/demo/highlight/` is a demo
  helper; the serializer and Rust generator depending on it would invert the
  dependency (compiler → website). *Leaning: `Marked`, `toText` and
  `fromSpans` in `fjs/text/marked/`, with only `render` under the website,*
  because the type is about text and the first consumer outside the website
  is the compiler.
- **Does the CLI ever want it?** An ANSI-coloured `fjs compile` to a
  terminal is the same data through an SGR renderer
  ([`text/sgr`](../../../text/sgr/)). Not in scope; it is a second consumer
  that would confirm the location above.

## Related

- `website/demo/highlight/module.f.mjs` (branch
  `claude/gracious-euler-dw2lsd`) — the reparsing highlighter this builds on.
- [`../README.md`](../README.md#output) — how a demo's code blocks look.
- [`../../../compiler/todo/output-demos.md`](../../../compiler/todo/output-demos.md)
  — the demos that print generated code.
