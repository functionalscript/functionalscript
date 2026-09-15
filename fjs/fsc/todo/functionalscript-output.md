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

The DataJS extensions are the two its specification recognizes. It once also
named `.d.js` and `.d.mjs`, and no longer does — `.d.ts` is a TypeScript
declaration, and a `.d.` infix reads as one — so an output under either is
refused with the rest, and a `.d.js` output the compiler accepted by falling
through to the DataJS writer is a `.data.js` output now.

The FunctionalScript writer reads the linked EDAG of
[`fjs/fsc/edag`](../edag/module.f.mjs) through its analysis — the table
whose entries name their operands by index — and writes a module the parser
accepts, so that compiling the output again yields the same EDAG:

- A constructor — `[]`, `{}`, `=>` — the graph holds more than once is
  hoisted into a `const`, as the DataJS serializer hoists a shared value,
  so its identity survives; a node held once is written in place. Which
  nodes those are is the analysis's to say
  ([`fjs/edag/todo/analysis.md`](../../edag/todo/analysis.md)): the writer
  reads its table and hoists in table order. A node the analysis merged —
  an access, an operator — is never hoisted, however many times it is
  reached: it is written in place at every occurrence, and the recompiled
  occurrences merge again, which is the equality the round trip is stated
  over. Hoisting one would also evaluate it eagerly where the source kept
  it lazy, `[a && x.y, b && x.y]` once the operators land, and turn a
  short-circuit into a throw.
- Every `const` the writer emits, an anchor or a hoisted node, is named by
  its position among the written statements — the first is `$0`, the next
  `$1` — one sequence for both, so the same graph is the same text and an
  anchor's name cannot collide with a hoisted node's. The statements come in
  one pass over the root in the analysis's walk order: the root comma's
  operands in order, each preceded by the hoisted constructors its subtree
  reaches that are not yet written, so
  `const unused = 0; const s = []; export default [s, s];` is
  `const $0=0;const $1=[];export default [$1,$1];` and nothing else.
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
  `['args']` as the parameter, named by nesting depth as a spreadsheet
  names its columns — `$a` at the top, `$b` one level in, `$z` then `$aa`,
  `$ab` — so the sequence is total, never digits alone, which keeps it apart
  from the hoisted `$n`, and never the same name in nested functions
  ([`3150-shadowing.md`](../../../spec/todo/3150-shadowing.md)). Sharing
  inside a body has no `const` to hoist into yet: the arguments reached
  twice are written by naming the parameter twice, which the parser reads
  as one node, and a merged access is written in place as anywhere else;
  but a constructor shared within a body, `['=>', null, ['[]', [s, s]]]`
  with `s` an array, has no spelling that keeps it one array per call, and
  is refused until body constants
  ([`3130-body-const.md`](../../../spec/todo/3130-body-const.md)) give it a
  `const` inside the body — which makes that feature the one this writer
  waits on first. A body that is an object literal is written in
  parentheses once the grouping operator is in the language
  ([`2350-grouping.md`](../../../spec/todo/2350-grouping.md)), and refused
  until then.
- An access, `['.', base, key]`, is the own read
  ([`own-access.md`](../../edag/todo/own-access.md)), whose general spelling
  is `Object.getOwnPropertyDescriptor(base, key)?.value`; the writer uses
  the simpler form wherever it means the same, which today is always:
  `base.key` for a key that is an identifier and `base[key]` otherwise, a
  number key as a number, a computed number as `base[Number(k)]` — a
  non-finite one, which `a[1e999]` produces, as `1e999` or `-1e999`, the
  literal the tokenizer reads back to the same key, since `Infinity` is a
  reserved word and not a key token. The
  grammar takes no access on two bases the parser accepts through a
  reference and linking then puts in place: a number or bigint literal —
  `n.x` with `n` imported from a module exporting `1` links to
  `['.', 1, 'x']`, which `1.x` cannot spell — and a function — `f.length`
  with `f` exporting `(...a) => a` links to `['.', ['=>', null, ['args']], 'length']`,
  which `(...$a) => $a.length` would read as a body access. Such a base is
  hoisted, `const $0=1;` and `$0.x`, whether or not it is shared: the one
  hoist the writer makes for the grammar's sake, and the recompiled node is
  the same access on the same base. That hoist is a module-level spelling:
  inside a body it would move a function's constructor to the module's
  scope, and a hoisted number would be read back as a capture, so a numeric
  or function base inside a body is refused, as a shared constructor there
  is, until body constants give the body a `const`, which keeps the scope.
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
outputs: they are written from the executed value, whose sharing is
JavaScript's identity, and the DataJS serializer decides hoisting and the
JSON refusal on that value, never on the analysis. The FunctionalScript
output does not evaluate the module: it is a
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
      with a numeric or function base hoisted, functions with parameters named by
      depth, the root comma as `const` anchors, shared constructors hoisted and
      merged nodes written in place, every `const` named `$n` by position — one
      line, normalized.
- [ ] Refuse what the writer cannot spell yet, naming the output file as the JSON
      refusal does: a comma anywhere but the root, an object-literal body, a
      constructor shared within a body, a numeric or function base within a
      body, a node kind without a spelling.
- [ ] Pin the round trip: for every module in the proofs the writer accepts,
      compile to `.f.js`, compile the output again, and compare the two EDAGs'
      analyses whole — root, nodes, scope and shared, equal up to the
      analysis's merge — so that `export default 1;`, whose table is empty,
      is held by its root; with each refusal pinned by its message; the DataJS
      corpus keeps writing through `.data.js`. The promise is for the JavaScript-compatible
      model: an EDAG optimized by a content-addressable VM
      ([`fjs/edag/execution-models.md`](../../edag/execution-models.md) §4)
      is not necessarily expressible in `.f.js` and may not survive the round
      trip, since the writer writes the JavaScript meaning.
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
- [`3130-body-const.md`](../../../spec/todo/3130-body-const.md) — the
  `const` inside a body that a shared constructor there needs; the writer's
  first dependency on the language.
- [`interpret-edag.md`](./interpret-edag.md) — the other consumer of the linked
  EDAG; the writer and the interpreter should agree on what a node means, and
  its value-producing contract yields to this issue for `.f.js`.
