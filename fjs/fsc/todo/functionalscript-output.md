## FunctionalScript output, functions included

**Priority:** P2
**Status:** open

### Problem

`fjs compile` writes two languages and names neither by its own extension.
A `.json` output is JSON. Any other output is a DataJS document in normalized
form, written through the DataJS serializer — and a `.f.js` output is that
document too, which is FunctionalScript only by accident: DataJS is a subset
of it, and a data module denotes a value DataJS can spell. A module holding a
function no longer does. Since the non-capturing arrow function
([`compile-modules-to-edag.md`](./compile-modules-to-edag.md), Stage 2), the
compiler refuses to write such a module as anything but the EDAG document,
`.edag.f.js`, so the language's own output cannot hold what the language
accepts.

The extensions are DataJS's to settle: its specification names `.data.js`
and `.data.mjs` as the extensions of a DataJS document and says tools emit
`.data.js` ([`spec/datajs/README.md`](../../../spec/datajs/README.md#files-and-media-type)),
while `.f.js` is FunctionalScript ([`spec/README.md`](../../../spec/README.md),
File Types). The compiler writes a DataJS document under the FunctionalScript
extension.

### Proposal

An output is the language its extension declares, as an input is:

|Output|Language|Writer|
|-|-|-|
|`.json`|JSON, a tree|the JSON writer, refusing what JSON cannot spell — unchanged|
|`.data.js`, `.data.mjs`|DataJS, a graph of values|the DataJS serializer, refusing a function|
|`.f.js`, `.f.mjs`|FunctionalScript, a graph of values and functions|a new writer over the linked EDAG|
|`.edag.data.js`, `.edag.data.mjs`|the EDAG itself, as a DataJS document|the DataJS serializer — the spelling `.edag.f.js` retired, since the EDAG artifact is data|

The FunctionalScript writer reads the linked EDAG of
[`fjs/fsc/edag`](../edag/module.f.mjs) and writes a module the parser
accepts, so that compiling the output again yields the same EDAG:

- A node the graph holds more than once is hoisted into a `const`, as the
  DataJS serializer hoists a shared value, so sharing survives; a node held
  once is written in place. Which nodes those are is the analysis's to say
  ([`fjs/edag/todo/analysis.md`](../../edag/todo/analysis.md)): the writer
  reads its table and hoists in table order.
- Every `const` the writer emits, an anchor or a hoisted node, is named by
  its position among the written statements — the first is `$0`, the next
  `$1` — one sequence for both, so the same graph is the same text and an
  anchor's name cannot collide with a hoisted node's.
- The comma operation, `[',', [...anchors, result]]`, at the module root is
  written as the source form it came from: an unused `const` per anchor,
  in order, then `export default` the result — an unreached `const` *is* the
  anchor syntax ([`2340-operators.md`](../../../spec/todo/2340-operators.md)).
  Anywhere else a comma has no statement to become until the operator itself
  is in the source language — inside a function body, and inside a container
  where linking leaves one, as `import b …; export default [b];` does when
  `b`'s module has an unused `const` (the `resolve.anchored` proof pins
  `['[]', [[',', [1, 2]]]]`). Until then a comma anywhere but the root is
  refused by the writer, as JSON refuses a shared node.
- A function, `['=>', null, body]`, is written as `(...$a) => body` with
  `['args']` as the parameter, one name per nesting depth; sharing inside a
  body — the arguments reached twice, a node held twice within the body — is
  written by naming the node twice, since a body has no `const` to hoist
  into yet, and the parser reads the arguments as one node however many
  references reach them. A body that is an object literal is written in
  parentheses once the grouping operator is in the language
  ([`2350-grouping.md`](../../../spec/todo/2350-grouping.md)), and refused
  until then.
- An access, `['.', base, key]`, is written as `base.key` for a key that is
  an identifier and `base[key]` otherwise, a number key as a number. The
  parser refuses a numeric literal as a base but accepts a reference to one,
  and linking makes such a base out of an accepted module — `n.x` with `n`
  imported from a module exporting `1` links to `['.', 1, 'x']` — so a
  number or bigint base is hoisted, `const $0=1;` and `$0.x`, whether or
  not it is shared: the one case where the writer hoists for the grammar's
  sake, and the recompiled node is `['.', 1, 'x']` again.
- A node kind the writer has no spelling for is refused, naming the kind.
  Calls and operators are not in the language yet; each feature that adds a
  node kind adds its spelling to this writer in the same PR, which the
  round-trip proof below enforces, so the writer never falls behind the
  parser.
- Leaves are written as the DataJS serializer writes them: JSON's spellings,
  `undefined`, `NaN`, the infinities, `-0`, a bigint with its suffix, and
  `["__proto__"]:` for that key.
- One line, no trivia, `;` after every statement: the normalized form, so
  that the output is canonical text as the DataJS output is.

`transpile` keeps its value-producing contract for the DataJS and JSON
outputs. The FunctionalScript output does not evaluate the module: it is a
rewrite of the linked graph, so a module holding a function compiles, and a
module whose value the readers would refuse — a read of `null` — still
compiles, the failure being the program's to make when it runs. For the
`.f.js` output this supersedes the value-producing contract that
[`interpret-edag.md`](./interpret-edag.md) preserves for `fjs compile`; that
contract stays for `.data.js` and `.json`, which are values.

### Tasks

- [ ] Route the output by extension: `.json`, `.data.js`/`.data.mjs`, `.f.js`/`.f.mjs`,
      `.edag.data.js`/`.edag.data.mjs`; any other extension is refused, naming the four.
- [ ] Write the FunctionalScript writer over `Exp`: leaves, containers, accesses
      with a numeric base hoisted, functions, the root comma as `const` anchors,
      and shared nodes hoisted, every `const` named `$n` by position — one line,
      normalized.
- [ ] Refuse what the writer cannot spell yet, naming the output file as the JSON
      refusal does: a comma anywhere but the root, an object-literal body, a node
      kind without a spelling.
- [ ] Pin the round trip: for every module in the proofs the writer accepts,
      compile to `.f.js`, compile the output again, and compare the two EDAGs'
      analyses — the node tables and shared indices, equal up to the analysis's
      merge — with each refusal pinned by its message; the DataJS corpus keeps
      writing through `.data.js`.
- [ ] Update `spec/README.md` (File Types, Output) and `fjs/fsc/README.md` for the
      four outputs, and retire `.edag.f.js` where it is named.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [`compile-modules-to-edag.md`](./compile-modules-to-edag.md) — "Final EDAG
  serialization" names the `.f.js` artifact this issue writes.
- [`spec/datajs/README.md`](../../../spec/datajs/README.md) — the extensions
  DataJS names for its documents, and the normalized form.
- [`spec/todo/serialization.md`](../../../spec/todo/serialization.md) — the
  EDAG as the canonical representation of a function, which the writer
  renders back to source; `toString(f)` will be this writer over one node.
- [`interpret-edag.md`](./interpret-edag.md) — the other consumer of the linked
  EDAG; the writer and the interpreter should agree on what a node means, and
  its value-producing contract yields to this issue for `.f.js`.
