## Specification Tree

**Priority:** P2
**Status:** open — proposal

### Problem

[The specification](../README.md) is one document of about three thousand
lines. A reader looking for one feature — optional chaining, `let`, a
template literal — searches a long page; a writer changing it edits the same
file as everyone else; and the examples the compiler demos offer
([`fjs/compiler/examples`](../../fjs/compiler/examples/module.f.js)) are a
second list, grouped by what a program shows, not by what the specification
says. The two drift apart.

### Design

**A tree of small pages, one per feature.** A directory per area, a page per
feature, each page short enough to read at once: what the feature accepts, what
it refuses and why, and how each output treats it. `spec/README.md` becomes the
index and the principles; the text moves out of it page by page, and none of
the moves waits on the others
([AGENTS.md §1](../../AGENTS.md#1-workflow)).

**A page owns its examples.** A page ends with the programs that show it, as a
list of `[name, source]` pairs, one list per page, exported by the area's
`module.f.js` beside its pages (pages are files of the area's directory, so a
file per page would share one path). The compiler demos'
list is *assembled from the tree*, never spelled a second time, so an example
lives next to the text it illustrates and a change to one is a change to the
other. The picker groups the assembled list by area (`<optgroup>`), which
needs `Examples` in
[`website/demo/examples`](../../fjs/website/demo/examples/types.ts) to carry the
group. A refusal is an example of the page whose rule it shows: `"\x41"` sits
with string literals, a failing initializer with evaluation. The register of
refused constructs ([refused-constructs](./refused-constructs.md)) stays the
cross-cutting index and links the pages.

**A page with a demo is a directory.** A page is a file of its area's
directory until it shows its example running; then it becomes a directory of
its own, `<area>/<page>/README.md`, beside the `demo.f.mjs` the site draws on
that directory's page and the sample the demo runs.
[Comma](../operators/comma/README.md) was the first: its demo shows the
example's EDAG, Rust and WebAssembly and calls it both ways. Every page of a
feature the language admits now has one, its example rewritten as a function
of one number so the demo can call it; an area's own README that describes a
feature (functions, operators, property access, values) carries its demo in
the area's directory. A refused construct's page has none yet, and neither
have the import pages, whose example needs a second module. The site renders
the README above the demo where it can
([render-readme](../../fjs/website/todo/render-readme.md)).

**A feature the compiler lacks has a page too**, marked *planned*, with its
`todo/` and the example that will show it. The tree is then the roadmap as
well: the gaps are visible as empty pages.

### What a page holds

**No page says "allowed unless forbidden".** FunctionalScript is a whitelist
([principles](../principles/README.md)), so every JavaScript feature gets a
page that says which side of the line it is on, and the tree's coverage is
checked against the ECMAScript feature list: a feature with no page is a gap,
not a default. A page is one of two kinds.

**An included feature** (JavaScript that FunctionalScript keeps):

1. What the feature is and the exact form accepted, with the restrictions that
   narrow JavaScript's.
2. **Reference**: the ECMA-262 section that defines the feature, and its MDN
   page. Every page has one, an included or a refused feature alike, so a
   reader can check FunctionalScript's rule against the standard's.
3. Examples, each shown with the compiler's real output for every output
   (`.json`, `.data.js`, `.js`, EDAG, Rust), including the outputs that refuse
   it and why.
4. A status line. If the feature is **not implemented yet**, the page says so in
   its text, and its examples show what the compiler does *today* — a refusal
   or a wrong output — not what it will do. The proof pins that output, so the
   day the feature lands the proof fails and the page is updated with it,
   never silently out of date.
5. **Where it is implemented**: the compiler layer that owns the feature —
   tokenizer, grammar, binding, desugaring, admission, graph construction,
   linking, graph optimization, graph-to-FAST, serialization, evaluation or
   orchestration — in the vocabulary of
   [compiler vocabulary and modularization](../../fjs/todo/compiler-vocabulary-and-modularization.md#where-a-feature-is-implemented),
   which records where a feature lives today where that differs. One layer
   per page, the one whose decision the feature is: a command-line page's,
   file types or output, is orchestration's, and what each output writes
   or refuses for a feature is on that feature's page, under its examples.
   The page names the layer; the module's own documentation says how. A
   refused feature names the layer that refuses it the same way, admission
   where the whitelist does.

**A refused feature** (valid JavaScript that FunctionalScript rejects):

1. What is refused, as a program that fails, shown with the compiler's own
   refusal, and the ECMA-262 and MDN **Reference** as above.
2. **Why** — the rationale, tied to a principle (purity, determinism, a
   single way to do it, the graph model) so that a restriction is
   justified rather than merely stated
   ([DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)).
3. **What to write instead** — the recommended replacement and a
   before/after pair: the refused program and the FunctionalScript program
   that does the same job, as two examples, the second one accepted. This is
   the page a reader lands on when porting JavaScript, so it is written for
   them.
4. **The friendly error**: the message the compiler *should* print, with the
   rewrite hint and a link to this page. Until that is implemented, the page
   gives the intended text beside the real one, marked planned. Its
   implementation is a `todo/` in the compiler; the page is its specification.

An included feature that is refused in one context (for example `a.toString`,
which is refused as a read but accepted as a call) is an included page with a
*refused forms* section that follows the refused-feature layout.

### The tree

`●` has examples in the compiler demo today; `○` is specified but has none;
`◌` is planned or refused-by-design and has a `todo/`.

1. **Principles** — source inclusion, purity, failure is one outcome.
   - `●` Overview (the program every demo opens on)
2. **Lexical grammar**
   - `●` Whitespace and line terminators
   - `●` Comments
   - `○` Identifiers; `◌` non-ASCII names
   - `●` String escapes; `◌` [JS string literals](./2460-js-string-literals.md)
   - `◌` Numeric spellings: [binary](./2470-binary-literals.md),
     [separators](./2471-numeric-separators.md), `0o7`, `.5`
3. **Values**
   - `●` Primitives: `null`, booleans, `undefined`
   - `●` Numbers; `●` bigints
   - `●` Strings; `●` template literals
   - `●` Arrays; `●` objects (repeated key, shorthand); `○` computed key
   - `○` Spread (array, call, object)
4. **Modules**
   - `●` Module structure; a module is a function
   - `●` Exporting: default and named; `◌` [export lists](./export-lists.md)
   - `●` Importing: default, named, combined; `○` JSON import attributes;
     `◌` [namespace import](./2220-namespace-import.md)
5. **Bindings**
   - `●` `const`; `●` sharing (a `const` used twice, a repeated expression)
   - `●` [Destructuring](./2450-destructuring.md)
   - `●` [Variables](../bindings/variables/README.md): `let` and assignment
     ([normalization](../bindings/variables/README.md#normalization))
   - `◌` [Shadowing](./3150-shadowing.md),
     [forward references](./3140-forward-references.md),
     [compound assignments](./3430-assignments.md)
6. **Operators**
   - `●` Grouping and precedence
   - `●` Arithmetic, comparison, bitwise
   - `●` Lazy operators `&& || ??` and `?:`; `●` `!`
   - `●` `typeof`; `●` `instanceof`
   - `●` `in`
   - `◌` `==` `!=` (refused by design); `◌` unary `+`, comma
7. **Conversions**
   - `●` `Number(...)`; `○` `String(...)`; `◌` other call shapes ([refused by design](../principles/README.md#operators-and-functions))
8. **Property access**
   - `●` Own-property read; `●` [optional chaining](./2335-optional-chaining.md)
   - `●` Reading an entry at run time (the `entry` helper, presence included)
   - `◌` prototype reads (refused)
9. **Functions**
   - `●` Arrow functions, parameters, rest; `◌` [default parameters](./3125-default-parameters.md)
   - `●` Captures, closures, self recursion
   - `●` Calls; `○` function identity and text
10. **Control flow**
    - `●` Guards and early `return`; `●` `throw`; `●` the one-variable `while` loop
    - `●` [call statements](../functions/call-statements/README.md); `◌` other loops and statements
11. **Built-ins**
    - `●` Member functions (`at`, `toString`, …); `●` static functions
      (`Object.is`, `Number.isInteger`, …); `◌` [global names](./2365-global-names.md)
12. **Refused JavaScript**
    - `●` Failure at run time; `●` hex escape; `●` parse error; `●` import with
      no file; `◌` [classes](./3390-class.md), [promises](./3380-promise.md),
      regular expressions, type annotations
13. **Command line and output**
    - `○` File types; `○` JSON input; `●` per-output behavior (what `.json`,
      `.data.js`, `.js`, EDAG and Rust each write or refuse)

### Migration

**Done in the conversion pull request.** `spec/README.md` is the index, the
contents tree and the roadmap; the text moved into twelve areas, each a directory
of pages with a status line, an Examples section and a Reference
(ECMA-262 and MDN):

| Area | Pages |
| --- | --- |
| `principles/` | principles, failure |
| `lexical/` | whitespace, comments, identifiers, string escapes |
| `values/` | numbers, bigints, strings, template literals, arrays, objects |
| `modules/` | structure, exports, imports |
| `bindings/` | constants, variables, destructuring |
| `operators/` | operators, grouping, `instanceof`, `in` |
| `conversions/` | `Number`, `String` |
| `property-access/` | access, optional chaining, entries |
| `functions/` | functions, parameters, captures, calls, names and identity, outputs |
| `control-flow/` | guards, loops, switch |
| `built-ins/` | member functions, static functions |
| `command-line/` | command line, checking, source text, file types, JSON input, output |

Each area with programs has a `module.f.js` that exports one example list per
page, and a proof that the lists build a valid drop-down; the compiler's
`examples/module.f.js` is only the assembly, in tree order. Choices made along
the way: one module per *area*, not per page, to keep the proof count down; a
refusal's example lives on the page it shows (`Hex escape` with string escapes,
`An import` with imports, `A failure at run time` and `Parse error` with the
principles' failure rules), so the *Refused JavaScript* area is not a directory
but the register [refused-constructs](./refused-constructs.md); subsections
stayed headings inside their page, so every old anchor still exists, now on its
page. Pages whose programs are not written yet say so under *Examples*; they
and the rewrite of moved text into the included/refused layout above are the
remaining work.

What is left, each its own pull request:

1. The picker draws `<optgroup>` per area, which needs `Examples` to carry the
   group (today the area is only a comment in the assembly).
2. Rewrite each moved page into the included or refused layout above: *why*,
   *what to write instead*, the friendly error, the not-implemented status.
3. Programs for the pages that have none, and a page for every ECMAScript
   feature that has none (the coverage list below).
4. Each `◌` or `○` row gets its example when the feature lands, or a refusal
   example when it is refused by design.

### Open questions

- **Where the examples file lives.** Beside its page keeps text and programs
  together; a single `spec/examples/` mirrors the tree for tooling. Beside the
  page is the default here.
- **Example names across pages.** The demo proofs look examples up by name
  ([compiler proof](../../fjs/compiler/proof.f.mjs)); the tree should keep
  names unique, or a name becomes `area/page/name`, which touches every proof
  that mentions one.
- **Status in the data.** The page text says "not implemented yet", but the
  example list could carry it too (`[name, source, status]`) so the demo can
  badge a pane whose output is not final, and a proof can list the examples
  that are waiting for a feature.
- **Friendly errors.** A refusal today is a message from the parser or the
  evaluator. Whether the friendly text is a separate table keyed by refusal
  (the page's *friendly error* section assembled into the compiler) or lives
  only in the page until the compiler grows it is open.
- **The coverage list.** Which ECMAScript feature list the tree is checked
  against (the specification's grammar productions, or a feature inventory),
  and who owns keeping it current.
- **One program on two pages.** `Overview` shows several features; it belongs
  to *Principles*, and other pages link to it rather than repeat it.
- **Planned examples.** A program a feature cannot compile yet is a refusal
  today; whether it is listed before the feature lands (as the future example,
  its refusal pinned) or only when it lands.
