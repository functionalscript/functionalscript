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

An output is the language its extension declares, as an input is, matched
by the longest suffix first, so that `result.edag.data.js` is the EDAG route
and never the DataJS one:

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

- A node that mints identity — a constructor, `[]`, `{}` or `=>`, or a
  call in any spelling, `()` and an access whose continuation calls, since
  `const x = f(); export default [x, x];` is one call and `f` may return a
  fresh array — is hoisted into a `const` when the graph holds it more than
  once, as the DataJS serializer hoists a shared value, so its identity
  survives; a node held once is written in place. Which
  nodes those are is the analysis's to say
  ([`fjs/edag/todo/analysis.md`](../../edag/todo/analysis.md)): the writer
  reads its table and hoists in table order. A node the analysis merged —
  an access, an operator — is never hoisted, however many times it is
  reached: it is written in place at every occurrence, and the recompiled
  occurrences merge again, which is the equality the round trip is stated
  over. Hoisting one would also evaluate it eagerly where the source kept
  it lazy, `[a && x.y, b && x.y]` once the operators land, and turn a
  short-circuit into a throw. Hoisting a shared identity-minting node
  changes no order, because in a compiled graph it always has an eager edge: a `const`
  the export reaches only through lazy positions is anchored by the comma
  ([`2340-operators.md`](../../../spec/todo/2340-operators.md)), so
  `const s = [null.x]; export default [a && s, b && s];` throws at load in
  JavaScript, in the EDAG and in the output alike. A graph holding an
  identity-minting node reached only through lazy edges, `[a && s, b && s]`
  with no anchor for `s`, is not one the compiler emits, and the writer
  refuses it by name, as it refuses a comma outside the root.
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
  but an identity-minting node shared within a body, `['=>', null, ['[]', [s, s]]]`
  with `s` an array or a call, has no spelling that keeps it one value per call, and
  is refused until body constants
  ([`3130-body-const.md`](../../../spec/todo/3130-body-const.md)) give it a
  `const` inside the body — which makes that feature the one this writer
  waits on first. A body that is an object literal is written as a block,
  `(...a) => { return { x: a }; }`, the spelling the expression body has
  none of; the parenthesized `=> ({ x: a })` waits on the grouping operator
  ([`2350-grouping.md`](../../../spec/todo/2350-grouping.md)) and is the
  writer's only once it lands, if it prefers it.
- An access, `['.', base, key]`, is the own read
  ([`entry.md`](../../edag/todo/entry.md)), whose general spelling
  is `Object.getOwnPropertyDescriptor(base, key)?.value`; the writer uses
  the simpler form wherever it means the same, which today is always —
  under the assumption `entry.md` states, a realm whose prototypes are
  the standard's, which every FunctionalScript file run by a JavaScript
  engine already relies on, since every standard prototype name is refused
  at the key and so `a.x` and the own read agree on every accepted name:
  `base.key` for a key the tokenizer reads as one `id` token and
  `base[key]` otherwise — the characters classified by code point through
  [`fjs/text/ascii`](../../text/ascii/module.f.mjs), never by a case fold,
  which would make `\u212a` a letter, and the six words that denote a value
  ([`literalWords`](../../js/keywords/module.f.mjs)) bracketed, being token
  kinds of their own where every other keyword is an `id` — and a number key
  as a number. Three numbers are refused instead, since no
  literal reads back as the same key: `NaN` and the two infinities have no
  literal at all — `Infinity` is a word and not a key token, and `1e999`,
  which this issue first proposed for it, is read back as the key `null`
  rather than as an infinity, which is the tokenizer's own bug and not a
  spelling to build on — and `-0`, whose literal the parser already reads
  as `0`. The compiler emits none of the three: `a[-0]` is the key `0` by
  the time a graph holds it. A computed key, `['Number', e]`, is refused
  too, rather than written `base[Number(k)]` as this issue first proposed:
  the grammar's index is a string or a number literal, so that spelling is
  one the parser would not read back, and it is a spelling to add with
  computed keys. The grammar takes no access on two bases the parser accepts
  through a reference and linking then puts in place: a number or bigint literal —
  `n.x` with `n` imported from a module exporting `1` links to
  `['.', 1, 'x']`, which `1.x` cannot spell — and a function — `f.length`
  with `f` exporting `(...a) => a` links to `['.', ['=>', null, ['args']], 'length']`,
  which `(...$a) => $a.length` would read as a body access. Such a base is
  hoisted, `const $0=1;` and `$0.x`, whether or not it is shared: a hoist
  the writer makes for the grammar's sake, and the recompiled node is the
  same access on the same base. That hoist is a module-level spelling:
  inside a body it would move a function's constructor to the module's
  scope, and a hoisted number would be read back as a capture, so a numeric
  or function base inside a body is refused, as a shared constructor there
  is, until body constants give the body a `const`, which keeps the scope.
- A node kind the writer has no spelling for is refused, naming the kind.
  Calls are not in the language yet, and Stage A operators
  ([`2340-operators.md`](../../../spec/todo/2340-operators.md)) landed after
  this writer's own design and before its implementation — this doc's own
  policy, that each feature adding a node kind adds its spelling to this
  writer in the same PR, could not be honored for a writer that does not yet
  exist to receive it. Whoever builds this writer owes it every `op1`/
  `op12`/`op2` tag the parser now emits, verified the same way as every other
  kind here: refused by name until spelled, then round-tripped. Once this
  writer exists, the same-PR policy resumes for whatever operator stage lands
  next.
- Leaves are written as the DataJS serializer writes them: JSON's spellings,
  `undefined`, `NaN`, the infinities, `-0`, a bigint with its suffix, and
  `["__proto__"]:` for that key. An object key is written as a string; a
  key that is not a string, `[':', 1, 0]`, which the schema allows and the
  compiler never emits since `{ 1: 0 }` is not in the grammar, is refused by
  name until number and computed keys land.
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

- [ ] Route the output by extension, longest suffix first: `.edag.data.js`/`.edag.data.mjs`,
      then `.data.js`/`.data.mjs`, `.f.js`/`.f.mjs`, `.json`; any other extension is
      refused, naming the four; `x.edag.data.js` pinned as the EDAG route.
- [x] Write the FunctionalScript writer over `Exp`: leaves, containers, accesses
      with a numeric or function base hoisted, functions with parameters named by
      depth, the root comma as `const` anchors, shared identity-minting nodes —
      constructors and calls — hoisted and
      merged nodes written in place, every `const` named `$n` by position — one
      line, normalized.
- [x] Refuse what the writer cannot spell yet, each by a message of its own,
      for the compiler to name the output file with as the JSON refusal does:
      a comma anywhere but the root, an
      identity-minting node shared within a body, a numeric or function base
      within a body, an identity-minting node reached only through lazy edges,
      a root comma with fewer than two operands — with one it has no anchor to
      write and reads back as its operand alone, with none it is no module,
      and linking emits neither — an anchor whose operand already has a name,
      whose statement would be the alias `const $1=$0;` that the front end
      reads back as nothing, taking the comma with it,
      a key no number literal reads back, a computed key, an access key naming
      a property of a built-in prototype — which the grammar refuses in either
      spelling, so `prohibitedNames` has one owner and the writer imports it —
      an object key that is not a string, and a node kind without a spelling.
      A body whose text opens with `{` is not among them: it is written as a
      block, which the block body
      ([`3110-function.md`](../../../spec/todo/3110-function.md)) gives it —
      an object literal, and an access on one, alike.
      An identity-minting node reached only through lazy edges needs no rule
      of its own: every lazy node kind is a kind with no spelling, so such a
      graph is refused at the operator before its sharing is reached.
- [x] Pin the writer's law over generated graphs: every shape over every shape
      over the atoms, each either refused or written to text the front end
      reads back to the same table. Four accept sets chosen by hand missed a
      hole each; this catches all four when the fix is removed.
- [ ] Pin the round trip through the compiler: for every module in the proofs the writer accepts,
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
