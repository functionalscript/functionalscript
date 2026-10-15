# Specification Tree

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
list of `[name, source]` pairs in a sibling `examples.f.js`. The compiler demos'
list is *assembled from the tree*, never spelled a second time, so an example
lives next to the text it illustrates and a change to one is a change to the
other. The picker groups the assembled list by area (`<optgroup>`), which
needs `Examples` in
[`website/demo/examples`](../../fjs/website/demo/examples/types.ts) to carry the
group. A refusal is an example of the page whose rule it shows: `"\x41"` sits
with string literals, a failing initializer with evaluation. The register of
refused constructs ([refused-constructs](./refused-constructs.md)) stays the
cross-cutting index and links the pages.

**A feature the compiler lacks has a page too**, marked *planned*, with its
`todo/` and the example that will show it. The tree is then the roadmap as
well: the gaps are visible as empty pages.

### What a page holds

**No page says "allowed unless forbidden".** FunctionalScript is a whitelist
([principles](../README.md#principles)), so every JavaScript feature gets a
page that says which side of the line it is on, and the tree's coverage is
checked against the ECMAScript feature list: a feature with no page is a gap,
not a default. A page is one of two kinds.

**An included feature** (JavaScript that FunctionalScript keeps):

1. What the feature is and the exact form accepted, with the restrictions that
   narrow JavaScript's.
2. Examples, each shown with the compiler's real output for every output
   (`.json`, `.data.js`, `.js`, EDAG, Rust), including the outputs that refuse
   it and why.
3. A status line. If the feature is **not implemented yet**, the page says so in
   its text, and its examples show what the compiler does *today* — a refusal
   or a wrong output — not what it will do. The proof pins that output, so the
   day the feature lands the proof fails and the page is updated with it,
   never silently out of date.

**A refused feature** (valid JavaScript that FunctionalScript rejects):

1. What is refused, as a program that fails, shown with the compiler's own
   refusal.
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
   - `●` Arrays; `●` objects (repeated key, shorthand, computed key)
   - `○` Spread (array, call, object)
4. **Modules**
   - `●` Module structure; a module is a function
   - `●` Exporting: default and named; `◌` [export lists](./export-lists.md)
   - `●` Importing: default, named, combined; `○` JSON import attributes;
     `◌` [namespace import](./2220-namespace-import.md)
5. **Bindings**
   - `●` `const`; `●` sharing (a `const` used twice, a repeated expression)
   - `●` [Destructuring](./2450-destructuring.md)
   - `◌` [Shadowing](./3150-shadowing.md),
     [forward references](./3140-forward-references.md), [`let`](./3220-let.md)
     beyond the loop, [assignments](./3430-assignments.md)
6. **Operators**
   - `●` Grouping and precedence
   - `●` Arithmetic, comparison, bitwise
   - `●` Lazy operators `&& || ??` and `?:`; `●` `!`
   - `●` `typeof`; `●` `instanceof`
   - `◌` `==` `!=` (refused by design); `◌` [`in`](./2346-in-operator.md)
     (refused); `◌` unary `+`, comma
7. **Conversions**
   - `●` `Number(...)`; `○` `String(...)`; `◌` [number spread](./2363-number-spread.md)
8. **Property access**
   - `●` Own-property read; `●` [optional chaining](./2335-optional-chaining.md)
   - `●` Reading an entry at run time (the `entry` helper)
   - `◌` [`hasOwnProperty`](./2345-has-own-property.md); `◌` prototype reads (refused)
9. **Functions**
   - `●` Arrow functions, parameters, rest; `◌` [default parameters](./3125-default-parameters.md)
   - `●` Captures, closures, self recursion
   - `●` Calls; `○` function identity and text
10. **Control flow**
    - `●` Guards and early `return`; `●` `throw`; `●` the `let`/`while` loop
    - `◌` other loops and statements
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

Each step is one pull request and leaves the specification complete:

1. Add `examples.f.js` beside nothing yet: define the page-owned example shape
   (name, source, optional refusal note) and the group in `Examples`, and have
   the picker draw `<optgroup>`. The demo list is still the current one.
2. Move one area — the smallest, *Lexical grammar* — into `spec/lexical/`: its
   pages, its examples, a link from the index. The demo list now takes that
   area from the tree.
3. Repeat per area; each move deletes the matching section of `spec/README.md`
   and re-points the links that named it. The numbered `todo/` entries above
   link to pages instead of anchors as they move.
4. When the last area has moved, `spec/README.md` is the index and the
   principles, and the compiler's examples file is only the assembly.
5. Each `◌` or `○` row gets its example when the feature lands, or a refusal
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
