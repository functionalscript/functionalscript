# Marked text

Text that says what its words are. A producer of code — a serializer, a code
generator — knows that `const` is a keyword and `"a"` a string when it writes
them. This module lets it say so beside the text, so a reader of the text — a
web page colouring a code block today, a terminal tomorrow — need not read the
text again to find out.

```text
producer ──writes──▶ Marked ──toText──▶ the file `fjs compile` writes
                        │
                        └──render──▶ coloured HTML on a demo page
```

The type API is [`types.ts`](./types.ts); the code is
[`module.f.mjs`](./module.f.mjs); the proofs are
[`proof.f.mjs`](./proof.f.mjs). Why the design is what it is, with the
established practice it follows (LSP semantic tokens, Pygments, Tree-sitter,
TextMate, source maps) and the alternatives it rejected:
[`website/demo/todo/highlight-from-producers.md`](../../website/demo/todo/highlight-from-producers.md).
This file says what exists and how to use it.

## Contents

1. [The model](#1-the-model)
2. [Kinds, and what each producer marks](#2-kinds-and-what-each-producer-marks)
3. [Writing a producer](#3-writing-a-producer)
4. [Tagged text, for producers built from templates](#4-tagged-text-for-producers-built-from-templates)
5. [Producers and their entry points](#5-producers-and-their-entry-points)
6. [Rendering](#6-rendering)
7. [The fallback for text with no producer](#7-the-fallback-for-text-with-no-producer)
8. [Invariants](#8-invariants)
9. [Proving a producer](#9-proving-a-producer)
10. [The command line](#10-the-command-line)
11. [Adding a producer: a checklist](#11-adding-a-producer-a-checklist)

---

## 1. The model

| Type | Is | Notes |
| ---- | -- | ----- |
| `TokenKind` | `'keyword' \| 'literal' \| 'string' \| 'number' \| 'comment' \| 'operator'` | A closed set. What the producer wrote, never how it looks. |
| `Run` | `[text, kind?]` | A piece of text and, when it has one, its kind. A run without a kind is plain. |
| `Marked` | `readonly Run[]` | A text written as runs. The runs' texts, concatenated, are the text. |
| `Chunk` | `string \| Run` | A transitional piece: a bare string is a run with no kind. It lets a writer that builds lists of strings mark some of its pieces and leave the rest. |
| `Span` | `{ start, length, kind }` | A kind over `length` code points from `start`, beside a text that already exists. Offsets are code points. |

**Marking is a layer beside the text, never in it.** The text of a `Marked` is
exactly what the producer would have written without markup, and what
`fjs compile` writes to a file. Markup never adds, drops, reorders or escapes a
character ([§8](#8-invariants)).

**A kind is semantic.** `keyword` and `literal` are drawn in one colour by the
current stylesheet, and they stay two kinds: the colour is the page designer's
choice, and another renderer may differ. The names are LSP's standard token
types, plus `literal` for `true`, `false`, `null` and `undefined`, which LSP has
no type for (TextMate and Tree-sitter keep that distinction too).

## 2. Kinds, and what each producer marks

| Kind | Means | JSON, DataJS, EDAG | `.js` | Rust |
| ---- | ----- | ------------------ | ----- | ---- |
| `keyword` | a reserved word the producer writes | `const`, `export`, `default` | `const`, `export`, `default`, `return`, `throw`, `typeof`, `instanceof` | `use`, `pub`, `fn`, `let` |
| `literal` | a literal word | `null`, `true`, `false`, `undefined` | the same | `true`, `false` |
| `string` | a string literal, quotes included | every string, and an object key written as a string | the same | every string literal, including the function text in `Some("…")` |
| `number` | a numeric literal | numbers, bigints (`1n`), `-0` | the same | the `f64` bit patterns, and an `i64` for `bigint_any` |
| `comment` | a comment | none | none | the `// @generated` line |
| `operator` | an operator | none | none | none |

Everything not in the table is plain text: names, punctuation, operators,
parentheses, `NaN` and `Infinity`, which are words, not literals. Plain is the
default, and a producer marks a piece only when it is certain what it is.
`operator` exists in the type for a producer that wants it; none marks it yet.

## 3. Writing a producer

A producer that builds its text from **lists of pieces** returns them as
chunks. A piece it knows the kind of is a run; the rest are strings:

```js
import { keyword, literal } from '../../text/marked/module.f.mjs'

// `export default 1;`
const chunks = [keyword('export'), ' ', keyword('default'), ' ', ['1', 'number'], ';']
```

`chunksMarked(chunks)` gives the `Marked`, `chunksText(chunks)` the text, and
`chunkStrings(chunks)` the pieces as plain strings. The text is derived from
the chunks, never built a second way: a producer has **one implementation**,
with the plain text as a view of it.

Two rules keep a piece's text honest:

- **Split a keyword from what surrounds it.** `'export default '` is three
  pieces, `export`, a space and `default`, not one string.
- **Mark the whole token, and only it.** A `string` run includes its quotes. A
  number run is the number, with a leading `-` where the producer writes a
  negative as one literal.

## 4. Tagged text, for producers built from templates

Some producers compose their text by string templates all through: an
operator table maps `(a, b)` to `` `${a} + ${b}` ``, and every statement is a
template over its operands. The Rust printer, `fjs/edag/rust`, is 1563 lines
of this and is shared with the VM conformance corpus. Rewriting every template
to carry runs would rewrite the printer, so such a producer **tags** what it
spells and the tags are resolved into runs once, at its boundary.

A tag is `U+0001`, one letter for the kind, the text, and `U+0002`:

| Kind | Letter | | Kind | Letter |
| ---- | ------ |-| ---- | ------ |
| `keyword` | `k` | | `comment` | `c` |
| `literal` | `l` | | `operator` | `o` |
| `string` | `s` | | `number` | `n` |

```js
import { tagged, fromTagged, untagged } from '../../text/marked/module.f.mjs'

const kw = tagged('keyword')
const text = `${kw('let')} x = ${tagged('number')('0x1')};`

untagged(text)               // 'let x = 0x1;'
fromTagged(text)             // ok([['let', 'keyword'], [' x = '], ['0x1', 'number'], [';']])
```

This is the idiom `fjs/compiler/serializer/names` already uses for symbolic
names (`\0name\0`, resolved into `$0`, `$1`, … at the output). It is **not**
markup in the public text:

- **A producer never answers tagged text.** Its public functions answer the
  plain text, `untagged`, and a marked entry point answers the runs
  `fromTagged` resolves. The Rust printer's `scope`, `expExpr`,
  `statementsOf`, `useLines`, `toRust` and `generate` are unchanged; the
  tagged forms are `scopeTagged` and `useLinesTagged`, used only by
  `toRustMarked`.
- **A tag cannot be forged by data.** The language a producer prints escapes
  both control characters in every literal (a Rust string escapes every C0
  control as `\u{…}`), so printed user data holds neither marker. `tagged`
  also asserts that its own text holds none.
- **A malformed tag is refused, never repaired.** `fromTagged` answers an
  error for a tag left open, a kind no letter names, and a closing marker with
  no opening. `untagged` panics on one, since a printer that made it has a
  defect.
- **A tag does not nest.**

**Which mechanism?** A producer that already builds lists of pieces returns
runs ([§3](#3-writing-a-producer)). A producer built from templates tags. The
result is the same `Marked`, and nothing downstream can tell which was used.

## 5. Producers and their entry points

Every public function that answers text still answers **plain text**; marked
text is an addition beside it. The `_`-prefixed functions are linkage, not API.

| Producer | Plain text | Marked text | Chunks / tagged, for builders |
| -------- | ---------- | ----------- | ----------------------------- |
| DataJS (`fjs/media/datajs`) | `tryStringify`, `trySerialize` | `tryMarked` | `_trySerialize`; `leafSerialize`, `keySerialize` answer chunks |
| JSON from a value (`fjs/media/datajs`) | `tryJsonStringify`, `tryJsonSerialize` | `tryJsonMarked` | `_tryJsonSerialize` |
| JSON codecs (`fjs/media/json`, `…/extended`) | `serialize`, `stringify` | — | their leaves are marked; `serialize` still answers strings |
| `.js` writer (`fjs/compiler/serializer`) | `tryStringify`, `tryModuleStringify`, `trySerialize`, `tryModuleSerialize` | `tryMarked`, `tryModuleMarked` | `_trySerialize`, `_tryModuleSerialize` |
| Rust (`fjs/compiler/rust`) | `toRust`, `generate` | `toRustMarked` | `scopeTagged`, `useLinesTagged` in `fjs/edag/rust` |
| The compiler (`fjs/compiler`) | the file `compileFile` writes | `_compileMarked(input, output)` | — |

`_compileMarked` is `compile` without its tail, creating the output's
directory and writing the file. It answers the output the output name asks
for as `Marked`, or the diagnostic `fjs compile` would print. `compileFile`
is it followed by that tail, writing `toText` of the result; so the file is
the text of the marked output, by construction.

## 6. Rendering

[`fjs/website/demo/highlight`](../../website/demo/highlight/module.f.mjs)
renders marked text for the demo pages:

- `render(marked)` draws a run with a kind as
  `['span', { 'data-token': kind }, text]` and a run without one as its bare
  string. An empty run draws as nothing.
- The stylesheet ([`website/style`](../../website/style/module.f.mjs)) owns the
  colours: `keyword` and `literal` in the value colour, `string` in the pass
  colour, `number` in `--syntax-number`, `comment` muted and italic. Both colour
  schemes are defined. A demo never sets a colour.

The compiler (side-by-side), parser, serializer and Rust demos render their
producers' runs. How a demo's code blocks look is
[`website/demo/README.md`](../../website/demo/README.md#output).

## 7. The fallback for text with no producer

Some text has no producer behind it: an example a reader typed. For that,
`highlight(text)` finds the runs by tokenizing, with the real tokenizer
([`fjs/js/tokenizer`](../../js/tokenizer/module.f.mjs)):

- `spansOf(text)` answers the `Span`s the tokenizer finds (`keyword`,
  `literal`, `string`, `number`, `comment`), or none if the tokenizer refuses
  the text: colouring the tokens before a failure would suggest the text is
  partly valid. It feeds the tokenizer code points and finds each token's
  offset through the tokenizer's own position fold (`_positions`), so it
  counts lines as the tokenizer does.
- `fromSpans(text)(spans)` turns spans beside a text into `Marked`. The spans
  must be in order, non-empty, whole and not overlapping, or it answers an
  error: **refused, never clamped.**
- `highlight(text)` is `render` of `fromSpans` of `spansOf`.

The fallback is also the **oracle** a producer is held to
([§9](#9-proving-a-producer)): `disagreement(marked)` answers where a
producer's markup and the tokenizer part ways, or `null`. The tokenizer reads
`-0` as a prefix and a number, so a leading `-` is not part of the span it
finds, and the comparison allows for it.

## 8. Invariants

Each is testable, and tested.

1. **Text is preserved.** `toText(marked)` is exactly the text the producer
   writes without markup.
2. **A kind is semantic, never presentational.** Two kinds the stylesheet draws
   alike stay two kinds.
3. **Kinds are closed.** A run's kind is a `TokenKind` or absent; an unknown
   kind is a type error.
4. **Runs are flat.** None nests inside another or overlaps.
5. **Empty runs carry nothing.** A producer may emit `['']`, and `render`
   draws no span around nothing.
6. **`fromSpans` refuses, never repairs.** An empty, non-integer, negative,
   out-of-range, overlapping or out-of-order span is an error.
7. **Producers accept and refuse what they did.** Marking a producer changes no
   input it accepts or refuses, and no refusal message.

And, for a producer that tags: **a public function never answers tagged
text**, and **a malformed tag is refused.**

## 9. Proving a producer

A producer's `proof.f.mjs`, which owes 100% coverage as every module does,
pins:

- **The text is unchanged.** The existing proofs of its plain output keep
  passing unmodified; that is the evidence that marking changed nothing a
  caller sees. For the compiler's outputs, the proof also runs the whole of
  `compile` over an in-memory file system for every shared example and output,
  and holds the page's text to the file written
  (`fjs/compiler/proof.f.mjs`, `panesAreTheFiles`).
- **The kinds.** The leaves and words it marks, one case each, and the pieces
  it does not mark (`undefined` in the `.js` writer was a gap this found).
- **The oracle**, for a language the tokenizer reads: for every example in
  [`fjs/compiler/examples`](../../compiler/examples/module.f.js), `disagreement`
  of its output is `null`. The marked pieces are the tokenizer's spans, one for
  one.
- **Without an oracle** (Rust has no tokenizer here), every run is one of the
  forms the producer says it marks, and the overview and primitives examples
  are pinned run by run.

## 10. The command line

**There is no option, and none is needed.** `fjs compile <input> <output>` takes
those two arguments and nothing else. It writes `toText` of the marked output,
and every public function strips the tags, so **a file `fjs compile` writes
never contains a marker or any markup**: byte for byte it is what it was
before this module existed.

The runs are reachable only through the library — the marked entry points of
[§5](#5-producers-and-their-entry-points) — which is what the demo pages use.

A future consumer that wants them on the command line, such as an
ANSI-coloured output to a terminal behind a flag, would render the same runs
through [`text/sgr`](../sgr/README.md). That is a separate feature; nothing
here builds it.

## 11. Adding a producer: a checklist

1. **Decide the mechanism** ([§4](#4-tagged-text-for-producers-built-from-templates)):
   lists of pieces return chunks; templates tag.
2. **Mark the leaves and words it spells**, only those it is certain of, and
   split keywords from their neighbours.
3. **Keep the public functions' types.** Answer plain text as before; add a
   marked entry point beside it, named `tryMarked` or `<name>Marked`.
4. **Derive the plain text from the marked one**, not a second time. One
   implementation.
5. **Prove it** ([§9](#9-proving-a-producer)): text unchanged, kinds pinned,
   the oracle where the tokenizer reads the language.
6. **Use it where it is shown:** a demo renders `render(marked)` and drops its
   call to `highlight`.
7. **Update the table in [§2](#2-kinds-and-what-each-producer-marks) and
   [§5](#5-producers-and-their-entry-points)** of this file.
