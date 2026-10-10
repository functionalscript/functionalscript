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
established practice it follows and the alternatives it rejected, is
[§12](#12-design-record). The rest says what exists and how to use it.

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
12. [Design record](#12-design-record)

---

## 1. The model

| Type | Is | Notes |
| ---- | -- | ----- |
| `TokenKind` | `'keyword' \| 'literal' \| 'string' \| 'number' \| 'comment' \| 'operator' \| 'identifier'` | A closed set. What the producer wrote, never how it looks. |
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
| `literal` | one of the language's literal words | `null`, `true`, `false`, `undefined`, and `NaN`, `Infinity` and `-Infinity` | the same | `true`, `false` |
| `string` | a string literal, quotes included | every string, and an object key written as a string | the same | every string literal, including the function text in `Some("…")` |
| `number` | a numeric literal | numbers, bigints (`1n`), `-0` | the same | every number the printer writes: the `f64` bit patterns, an `i64`, the words of a big integer and the units of a string with a lone surrogate, a function's length, and an index or `skip` |
| `comment` | a comment | none | none | the `// @generated` line |
| `operator` | an operator | none | none | none |
| `identifier` | a name, whatever it names | the name of a shared node's `const`, `$0` | every name: a parameter or binding, `$0`, a property after `.` (even `x.true`), a global such as `Array` | every other word: crate, module, type, function and method names, `Ok`, `c0` |

Everything not in the table is plain text: punctuation, operators and
parentheses. Plain is the default, and a producer marks a piece only when it is
certain what it is. `operator` exists in the type for a producer that wants it;
none marks it yet.

**An `identifier` is a name and nothing finer.** LSP has no generic name; it has
the refinements — `variable`, `property`, `function`, `parameter`, `type`, … — and
a producer that knows which a name is can say so by marking it as one *before*
the naming pass below, additively: no producer does yet, since the tokenizer
cannot tell them apart, and the check that holds a producer to it could not
check a refinement. Every producer that spells names marks them with one call,
`withNames`: it turns each word left plain into an `identifier` and touches
nothing that already has a kind. The producers mark everything that is a keyword,
literal, string, number or comment, and the words left over are its names — a
claim about the producer, not a guess about unknown text, and one its proof holds
([§9](#9-proving-a-producer)). `x.true` is a name, not a literal: the word after
`.` is a property.

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

A producer of code ends by calling `withNames` on its runs
(`withNames(chunksMarked(chunks))`), so that its names are `identifier`s; JSON,
which spells no name, does not need it. A word that starts with a digit is left
plain, since it is a number the producer did not mark, and a proof can find it.

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
| `identifier` | `i` | | | |

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
| The compiler (`fjs/compiler`) | the file `compileFile` writes | `_outputMarked(input, output)`, `_compileMarked(input, output)` | — |

`_outputMarked` is `compile` without its tail, creating the output's
directory and writing the file. It answers the output the output name asks
for as `Marked`, or a refusal as `[message, diagnostic]`: the producer's raw
message for a demo pane and the diagnostic `fjs compile` would print.
`_compileMarked` selects the diagnostic on refusal. `compileFile` is it followed
by the directory and write, writing `toText` of the result; so the file is the
text of the marked output, by construction.

## 6. Rendering

[`fjs/website/demo/highlight`](../../website/demo/highlight/module.f.mjs)
renders marked text for the demo pages:

- `render(marked)` draws a run with a kind as
  `['span', { 'data-token': kind }, text]` and a run without one as its bare
  string. An empty run draws as nothing.
- The stylesheet ([`website/style`](../../website/style/module.f.mjs)) owns the
  colours: `keyword` and `literal` in the value colour, `string` in the pass
  colour, `number` in `--syntax-number`, `identifier` in `--syntax-name` (an
  amber in both schemes, apart from the other four), `comment` muted and
  italic. Both colour schemes are defined, and `--syntax-name` was chosen for contrast on
  the code block's background — about 5.9 to 1 in the light scheme and 7.5 to 1
  in the dark, measured once, not by a proof. A demo never sets a colour.

Signed leaves are a deliberate visible difference from the JavaScript tokenizer
fallback: a producer's `['-0', 'number']`, `['-1', 'number']` or
`['-Infinity', 'literal']` colours the sign with the whole literal. JSON's number
grammar includes the sign; JavaScript tokenization instead reads a unary `-`
followed by the number or literal word. Keep the producer's run intact.
`disagreement` excludes this leading sign when comparing with the JavaScript
oracle, so it establishes agreement modulo that boundary, not identical rendered
spans. The highlighter's `signedLeaves` proof pins both renderings explicitly.

The compiler (side-by-side), parser, serializer and Rust demos render their
producers' runs. How a demo's code blocks look is
[`website/demo/README.md`](../../website/demo/README.md#output).

## 7. The fallback for text with no producer

Some text has no producer behind it: an example a reader typed. For that,
`highlight(text)` finds the runs by tokenizing, with the real tokenizer
([`fjs/js/tokenizer`](../../js/tokenizer/module.f.mjs)):

- `spansOf(text)` answers the `Span`s the tokenizer finds (`keyword`,
  `literal`, `string`, `number`, `comment`, and `identifier` for an `id` token;
  the literal words are `literalWords` of
  [`js/keywords`](../../js/keywords/module.f.mjs), and a word after `.` or `?.`
  is a property name, an `identifier` whatever it spells), or none if the
  tokenizer refuses the text: colouring the tokens before a failure would suggest the text is
  partly valid. It feeds the tokenizer code points and finds each token's
  offset through the tokenizer's own position fold (`_positions`), so it
  counts lines as the tokenizer does.
- `fromSpans(text)(spans)` turns spans beside a text into `Marked`. The spans
  must be in order, non-empty, whole and not overlapping, or it answers an
  error: **refused, never clamped.** The refusal is a `Result`, not a panic
  ([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
  names both): `fromSpans` is where spans come from beside a text, and a
  caller may hand it spans it did not build — a language server's semantic
  tokens are the case it is shaped for — so a bad span is bad input, not a
  defect of the program. A caller whose spans are its own, as `highlight`'s
  are, `unwrap`s.
- `highlight(text)` is `render` of `fromSpans` of `spansOf`.

The fallback is also the **oracle** a producer is held to
([§9](#9-proving-a-producer)): `disagreement(marked)` answers where a
producer's markup and the tokenizer part ways, or `null`. The comparison allows
for a leading `-` in a producer's signed leaf, so it proves agreement modulo
that boundary ([§6](#6-rendering)), not identical rendered spans.

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
  of its output is `null`. The marked pieces agree with the tokenizer's spans
  apart from the deliberate leading-sign boundary ([§6](#6-rendering)).
- **Without an oracle** (Rust has no tokenizer here), two checks that need each
  other. Every run is one of the forms the printer says it marks: a list of
  what is *allowed*. And no plain run holds a word the printer marks, `let`,
  `pub`, `fn`, `use`, `true`, `false` or a number
  ([`edag/rust/unmarked`](../../edag/rust/unmarked/module.f.mjs)): a list of
  what is *required*, which the first cannot see, since a mark that goes
  missing changes no text. The second is held to every case the printer's own
  proof prints, not only the shared examples.
- **Names are held to it too.** The tokenizer oracle includes identifiers, so a
  word a `.js` or DataJS producer left plain, or marked as another kind, is a
  disagreement; and for Rust, where there is no oracle, no plain run may hold a
  word of any kind (`wordsOf` in `edag/rust/unmarked`). Removing the `withNames`
  call of any producer fails a proof.
- **Every marked site is watched.** A proof that passes with a site's kind
  swapped, or its mark removed, is not watching the site. Each producer was
  checked that way: every `keyword(`/`literal(` site of the writers and every
  tag of the Rust printer, swapped and removed, fails a proof.

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

---

## 12. Design record

Why marked text is what it is. This used to be a `todo/` file proposing the
design; the work is done, so the file is gone and what it held is here.

### The problem

The demos print code the repository generated itself: the serializer's `.js`,
the DataJS and JSON writers' documents, the EDAG, the Rust printer's module.
Colouring it by tokenizing the text again is the wrong direction for the
information to flow:

- **The producer already knew.** The serializer wrote `const` and a string
  literal on purpose; a page that re-reads them from characters can disagree
  with the producer, silently
  ([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
  refuses the plausible wrong answer).
- **A language the tokenizer cannot read stays plain.** The Rust output was
  uncoloured for that reason alone.
- **The work is done twice**, on every render.

So a producer says what it wrote.

### Established practice

Highlighting has settled into a few shapes. These were read in their own
sources or documentation for this record:

| Practice | Where the classes come from | How they are attached to the text |
| -------- | --------------------------- | --------------------------------- |
| [LSP semantic tokens](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_semanticTokens) | A language server, which has parsed and bound the program | Beside the text: five integers per token (`deltaLine`, `deltaStart`, `length`, an index into a *legend* of token types, a bitset of modifiers), positions relative to the previous token. Overlap and multi-line tokens are opt-in client capabilities. Positions count UTF-16 units unless the client and server agree otherwise |
| [Tree-sitter highlight queries](https://tree-sitter.github.io/tree-sitter/3-syntax-highlighting.html) | A parse tree, queried with patterns that capture nodes: `"return" @keyword`, `(int_literal) @number` | An event stream of start, source slice, end |
| [TextMate grammars](https://github.com/textmate/javascript.tmbundle), as in VS Code and [Shiki](https://shiki.style/) | Regex rules over the text; Shiki is "based on TextMate grammar and themes" | Dotted scope names (`constant.language`), mapped to colours by a theme. Shiki renders a styled span per token |
| [Pygments](https://pygments.org/docs/tokens/) | A lexer per language, whose methods yield `(index, token, value)` | A stream of typed text: `Token.Literal.String`, `Token.Literal.Number` |
| Roslyn's [`ClassifiedSpan`](https://github.com/dotnet/roslyn/blob/main/src/Workspaces/Core/Portable/Classification/ClassifiedSpan.cs) | The syntax and the semantic model | A `ClassifiedSpan(textSpan, classificationType)` beside the text |
| [rustdoc](https://github.com/rust-lang/rust/blob/master/src/librustdoc/html/highlight.rs) | `rustc_lexer`, run over the code block | Inline spans — it *reparses*, as this repository's fallback does |

What marked text takes from them:

1. **Highlighting is a layer apart from the text.** None of them changes the
   text; the colours are metadata.
2. **A closed, named vocabulary.** LSP publishes standard token types
   (`keyword`, `string`, `number`, `comment`, `operator`, `variable`,
   `property`, `function`, …) so that themes work across servers; the names
   here are LSP's. Where the semantics differ and LSP has no type — it has none
   for `true`, `false`, `null` or `undefined` — a kind is added, as LSP's legend
   allows a server to. TextMate keeps `constant.language` for them and
   Tree-sitter's JavaScript queries capture `true`, `false`, `null` and
   `undefined` as `@constant.builtin`. Hence `literal` beside `keyword`.
3. **The party that knows should say.** LSP semantic tokens exist because a
   lexer cannot tell a type from a variable and the server can. A generator is
   the extreme case: it needs to infer nothing.
4. **Reparsing is respectable when there is no producer.** rustdoc, Pygments and
   TextMate classify from text because the text is all they get. That is the
   situation for an example a reader typed, which is why `highlight` stays
   ([§7](#7-the-fallback-for-text-with-no-producer)).

What it leaves: hierarchical scopes and themes (one stylesheet maps a handful of
kinds, so there is no second consumer for a hierarchy); modifiers (nothing needs
them, and a field added later is compatible); LSP's relative integer encoding
(it is for large files on a wire, and a demo's block is a few kilobytes in
memory); and positions in the protocol's UTF-16 units (offsets here are code
points, as the tokenizer's are).

### Alternatives considered

- **LSP-style spans as the primary type.** Familiar, compact, and what a reader
  who knows language servers expects. Rejected for producers: the text and the
  offsets can disagree, so a generator has to track how much it has written and
  an off-by-one is a silent wrong colour; and the unit must be chosen and
  converted. A list of runs cannot disagree with its text — the text is the
  runs. Spans are kept as `fromSpans`, for annotating a text that already
  exists.
- **Inline markup in the public text** (HTML, or control characters in the
  string). Rejected: the text is also what the command line writes and what a
  copy button copies, so markup in it corrupts both. Every practice above keeps
  the layers apart. (Tagged text, [§4](#4-tagged-text-for-producers-built-from-templates),
  is internal to a producer and never public.)
- **Keep reparsing.** Correct for an unknown text and cheap, so it stays as the
  fallback and as the oracle; rejected as the *only* mechanism, chiefly for Rust
  and for silent disagreement.
- **Rewrite the Rust printer to carry runs.** The printer is large, composes its
  text by templates all through, and is shared with the VM conformance corpus;
  rewriting every template and operator table would have been a change of the
  printer, not of its colours. It tags instead.
- **A theme and scope system** (TextMate, Pygments). No second consumer.

### Decisions

- **`literal` stays a kind beside `keyword`**, although the stylesheet draws both
  in one colour: a kind states what the producer wrote, and the colour is the
  page designer's choice.
- **The lexical kinds shipped first.** A producer knows a key from a variable and
  a function name from a parameter; `property` or `function` can be added
  later, and the oracle cannot check kinds the tokenizer cannot see.
- **`identifier` is the one name kind, and `withNames` the one way to say it.**
  A reviewer asked for names to be coloured apart. The alternative to a pass was
  marking each name where a producer spells it: for the Rust printer that is
  hundreds of templates, and for the `.js` writer every `.`, parameter and
  global. The pass is sound because the producers already mark every keyword,
  literal, string, number and comment, and because the proofs hold it: the
  tokenizer's reading for the languages it reads, and "no word left plain" for
  Rust. It never overrides a kind, so a refinement can come later. The colour
  is a new stylesheet variable, `--syntax-name`.
- **The code lives in `fjs/text/marked`**, with only `render` under the website,
  so that the compiler does not depend on the website.
- **`fromSpans` answers a `Result`** ([§7](#7-the-fallback-for-text-with-no-producer)).
- **Markup reaches the page by the compiler's own seam.** A file system carries
  text, so runs cannot cross it. The demo uses `_outputMarked`; `compileFile`
  uses `_compileMarked`, which selects the CLI diagnostic, followed by the
  directory and the write. Both run the same output route to the same point,
  and the proof runs the whole of `compile` and holds each pane to the file
  written, so a pane cannot drift from the command line.
- **No command-line option** ([§10](#10-the-command-line)).

### How it was built

A chain of pull requests, each on the one before: the types, `render` and the
fallback; the JSON and DataJS writers' leaves, which the `.js` writer takes its
leaves from, so they had to come before it; the `.js` writer's own words; the
compiler seam and the demos; and the Rust printer. The order changed once the
first step was read against the code. Each step kept every public function's
text, so that no caller changed what it prints.
