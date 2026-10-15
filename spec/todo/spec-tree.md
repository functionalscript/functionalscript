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
- **One program on two pages.** `Overview` shows several features; it belongs
  to *Principles*, and other pages link to it rather than repeat it.
- **Planned examples.** A program a feature cannot compile yet is a refusal
  today; whether it is listed before the feature lands (as the future example,
  its refusal pinned) or only when it lands.
