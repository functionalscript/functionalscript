# Output

**Status:** implemented

An output is the language its extension declares, matched by the longest
suffix first and case-sensitively. A `.json` output is a **tree**; a
`.data.js` or `.data.mjs` output is a [DataJS](../datajs/README.md) document,
which is a **graph** of values; and any other name ending in `.js` or `.mjs`,
`.f.js` and `.f.mjs` included, is a FunctionalScript module, a graph of values
*and functions*. An `.mjs` name asks for the writer its `.js` twin does, for a
file that must load as an ES module whatever the enclosing package's `"type"`
field says ([files and media type](../datajs/README.md#files-and-media-type)).

```sh
fjs compile input.f.js output.data.js   # DataJS, a JavaScript module
fjs compile input.f.js output.js        # FunctionalScript
fjs compile input.f.js output.json      # JSON
```

The JavaScript names are nested, not disjoint: a DataJS document is a
FunctionalScript module, so the narrower name is what asks for the narrower
writer — the one that refuses a function.

`fjs compile` writes two more things, neither of them a document of this
language: the program's EDAG under `.edag.data.js` or `.edag.data.mjs`, and a
generated Rust module under `.rs`, which [nanvm-lib](../../nanvm/lib/README.md)
runs. They are compiler artifacts, and [`fjs/compiler`](../../fjs/compiler/README.md)'s to
describe. A name ending in none of the eight suffixes — `.json`, `.data.js`,
`.data.mjs`, `.js`, `.mjs`, `.edag.data.js`, `.edag.data.mjs` and `.rs` —
declares none of the five, and is refused before the input is read, rather
than written in a language the name does not declare: `.ts`, `.JSON` and a
name with no extension alike.

## Evaluation and Projection

`.json` and `.data.js` are the **value outputs**: they evaluate the program
and write the data it computes. `.js` and `.rs` are the **code outputs**:
they evaluate the program too, and write its value with its functions.
`.edag.data.js` is the **graph output**: it writes the program's graph and
evaluates none of it.

|Program or selected result|`.json`|`.data.js`|`.js`|`.rs`|`.edag.data.js`|
|----------------|-------|----------|-----|-----|---------------|
|a function in selected data|refused|refused|written|written|written|
|a function used to compute data|computed|computed|computed|computed|written|
|a reached initialization failure|refused|refused|written as the program|written as the program|written|
|a call or any admitted operator|computed|computed|computed|computed|written|
|an object or array reached twice|written twice|a `const`|a `const`|a shared value|a shared node|
|a `bigint`|refused|written|written|written|written|

An evaluating output runs the program through the Memo EDAG interpreter
([EDAG values](../../fjs/edag/values.md#module-initialization)). It computes
calls and coercions: `const f = x => x + 2; export default f(3);` writes
`5` as JSON and `export default 5;` as DataJS and as FunctionalScript;
`export default [1, 2].map(x => x + 1);` writes `[2,3]` as JSON. An evaluated
function, including one nested in a selected array or object, is refused by
both data formats with
`callable materialization requires a target compile/load boundary`, and
written by both code outputs. An initialization failure is reported against
its source module by a value output.

**A code output is the module initialized.** Nothing of the module's
initialization is left in it: every `const` is the value it was given, and a
definition the exports do not reach is not written. What a function computes
the same way in every call is computed as well: a part of its body that reads
none of its arguments is evaluated once, when the module is compiled, and the
function holds the result
([precomputation](../../fjs/edag/todo/precompute-closed-nodes.md)). So
`const table = n => [n, n * n]; export const at = i => table(3)[Number(i)];`
is written `const $0=[3,9];export const at=($1)=>$0[Number($1)];`. Two calls
of such a function can answer one array or object where the program as
written made two; which is the executor's to choose
([value identity](../todo/value-identity.md)).

**A module that fails is written as its failure.** A failed initialization
is as much computed as a value is: the code output is a `throw` of what the
module failed with, and nothing else of the program. So
`const a = []; throw "boom";` is written `throw "boom";`, and a module that
imports it is written the same, since it fails with what its import throws.
A failure the language makes itself, as `export default null.x;` does, is
written `throw undefined;` ([failures](../principles/README.md)). In Rust
the module answers `Err` of that value.

Nothing else is written in place of a code output. A module the compiler
cannot read is the input's error, and a value the writer has no spelling
for is the output's, `cannot write as FunctionalScript:` followed by the
reason. A part of a function that fails when it is evaluated ahead, or
does not end within the compiler's count of steps, stays in the function as
written.

The EDAG output is the program as written, and a caller of the compiler can
ask for a code output of that graph in place of the value. There, the
FunctionalScript writer spells
calls and every admitted operator; the EDAG output preserves their nodes,
folding unary `-` where its operand lowers to a number or a `bigint`
([numbers](../values/numbers/README.md)). The Rust output emits the native
implementation of those nodes. All executors evaluate a lazy operand or
conditional arm only where JavaScript does, so an unreached `1n / 0n` never
throws. Source and Rust writers can still refuse a graph they cannot
reconstruct within their output profile; recognizing a node does not
guarantee every sharing or capture arrangement has a source spelling
([source and runtime compilation](../../fjs/edag/values.md#runtime-compilation)).
Deep container, function and conversion nesting can also exhaust the host
call stack during compilation. In particular, parsing and lowering a long
`Number`/`String` conversion chain can succeed before source serialization
overflows. These are compiler resource limits, not fixed language depth limits
([tracked inputs and remaining work](../../fjs/compiler/todo/deep-nesting-recursion.md)).
A module whose initialization overflows the host's stack or does not end
stops every evaluating output, a code output included.

The Rust writer
spells a `bigint` of any size, a literal within `i64` as one number and a
larger one as its sign and `u64` words. A string holding a lone surrogate,
which no Rust `&str` can hold, is written as its UTF-16 code units. A literal
Rust has no spelling for is refused, naming the output and writing nothing;
none is left among the primitives.

For a FunctionalScript input, JSON and DataJS output serialize the module
result's `default` property.
Selecting the `default` does not narrow what they evaluate: a value output
evaluates the whole program — every `const`, exported or not, of the input and
of every module it loads, one an `import {}` loads included — and a required
failure anywhere prevents output. Only after initialization succeeds is the
default export selected and converted to data. Unselected function exports
and local functions are allowed:
`export const g = () => 1; export default 5;` writes `5` as JSON, and
`const f = (a, b) => 1; export default [f.length];` writes `[2]`.
A named-only root projects to `undefined`: DataJS writes
`export default undefined;`, while JSON refuses `undefined`. FunctionalScript
output preserves each named export as `export const` and writes `export default`
last when present. Dependencies and shared values are declared before use;
recompilation does not add another wrapper. EDAG and Rust
output write the complete export object. A direct `.json` input remains a
document: its value is used without projection, even when it contains a property
named `default`. Imported JSON instead exposes `{ default: document }` at the
module boundary, from which a default import selects the document.

## Serialization Rules

- A DataJS document is written in
  [normalized form](../datajs/README.md#normalized-form): one line, and an
  object or array referenced more than once hoisted into a `const` named `$0`,
  `$1`, … in post-order, so it stays shared
  ([shared values](../bindings/constants/README.md)); a primitive is written inline
  wherever it is read, however often, since sharing one is not observable.
  Every function-free selected value has a DataJS document, shared nodes, `bigint`,
  `undefined`, `NaN` and the infinities included.
- JSON is a tree, and a JSON document carries no identity: every object and
  array in it is a fresh one when it is read. So an object or array the value
  reaches along more than one reference — through a `const`, an import or a
  property access — is written where each reference reaches it, as
  `JSON.stringify` writes it: `const o = {}; export default [o, o];` is
  `[{},{}]`, the one tree the value has. The compiler refuses what JSON
  cannot spell rather than write a file that reads back as a different
  value: `bigint`, `undefined`, `NaN`, `Infinity` and `-Infinity`, which JSON
  has no word for. A `bigint` is refused even though its digits are JSON,
  since `1` reads back as the *number* `1`. The refusal names the output
  file and writes nothing.

  A JSON document is written as `JSON.stringify` writes the value: one line,
  no whitespace and no trailing newline, members in the value's order
  (below), and numbers and strings spelled by the
  [normalized form](../datajs/README.md#normalized-form)'s rules. The one
  departure is `-0`, written `-0` where `JSON.stringify` writes `0`. A
  `.json` input compiled to `.json` is written the same way, its whitespace
  and escapes normalized.
- A FunctionalScript document is written from the module's value, with
  its functions, which is what DataJS and JSON have no spelling for:
  `const a = { b: 1 }; export default a.b;` is `export default 1;` here as
  it is as DataJS. Where a caller asks for the program's graph instead (above),
  the rules of this section describe that text: the same program is
  `export default {"b":1}.b;`. The two agree on a normalized DataJS
  document, which computes nothing — every one of them is a fixed point of
  both.

  A module whose only export is `default` is written in the same normalized
  form, unless a module it loads holds a `const` or an import nothing reads.
  In that form a node referenced more than once is hoisted, whatever it is —
  an object, a function, an access, an operation — and a node referenced
  once is written where it stands, so `const a = 1 + 2; const b = 1 + 2;
  export default [a, a, b];` is `const $0=1+2;export default [$0,$0,1+2];`:
  the text shares what the graph shares, and two equal nodes are two. The
  one exception is a node that mints nothing and that two lazy operands
  reach with no eager path, a loop's condition and block among them: no
  block holds both uses, so it is written in each, two equal nodes, and the
  one value. A `const` the value never reaches stays a statement, since
  loading the module evaluates it. Any other module — one with a named
  export, or one loading such a module — gives every array, object,
  function, access and operation outside a function body a `const` of its
  own, however many references reach it, in graph order with dependencies
  first, while a function body is written in the normalized form above: a
  node it shares is a `const` of its block, and the rest stands in place —
  `export const a = 1; export default x => { const t = x + 1; return t * t;
  };` is `const $0=($1)=>{const $2=$1+1;return $2*$2;};export const
  a=1;export default $0;`. Only a leaf stays inline, and `undefined` is
  not one there: it lowers to the node `["undefined"]`, so it gets a `const`
  as a node does — `export const a = 1; export default undefined;` is
  `const $0=undefined;export const a=1;export default $0;`. Each export names
  its value's `const` or holds its leaf:
  `const once = [1]; export const b = [once]; export default 3;` is
  `const $0=[1];const $1=[$0];export const b=$1;export default 3;`. The
  generated names use one `$n` counter across constants and parameters in
  every scope, allocated in declaration order. An export named `$n` reserves
  that number, which the counter skips; the prefix always stays `$`.

  The writer spells a property access, every operator the language has
  ([operators](../operators/README.md)) and every call. A number or a function that is
  an access's base or a callee takes a `const`, and so does a callee that
  is an access: `a.b(c)` and `(a.b)(c)` are both the method call. The front
  end inlines a function written at the call only when the call has no
  arguments, the function has zero fixed parameters, and its body does not
  read its own rest array ([bodies and guards](../control-flow/guards/README.md)). The
  writer hoists function callees when retaining a call node, so reading its
  output does not inline that call away.
- Object properties are emitted in the order the value carries them for the
  value outputs — JavaScript's own-property order, array-index keys first,
  a repeated key keeping its first position and its last value — and in the
  order the *literal* carries them for a FunctionalScript document, whose
  members are the graph's: `{b:1,"0":2,a:3,b:4}` stays as written there and is
  `{"0":2,"b":4,"a":3}` as DataJS. A member a later duplicate shadows is in
  the graph and not in the value, so `const x = []; export default {a: x, a: 1};`
  writes that `[]` in a FunctionalScript document and nowhere else.
- A `__proto__` key is emitted as `["__proto__"]:` in a DataJS or
  FunctionalScript document and as `"__proto__":` in JSON
  ([the `__proto__` key](../values/objects/README.md#the-__proto__-key)).
- An access in a FunctionalScript document is written from its constant key
  ([property access](../property-access/README.md)): a string key that is an
  [identifier](../lexical/identifiers/README.md), a reserved word included, follows a `.`, and
  any other string key is a normalized string in brackets — with the object
  named `$0`, `a["if"]` and `a['c']` are `$0.if` and `$0.c`, while
  `a["a-b"]`, `a["é"]` and `a["1"]` stay bracketed. A number key stays a
  number in brackets, in normalized spelling — `a[1e21]` is `$0[1e+21]` — so
  `a["0"]` and `a[0]` keep their own spellings. A number, a `bigint` or a
  function an access is taken on is named first rather than written in
  place: `1 .x` is `const $0=1;export default $0.x;`, and so is `(-1).x`,
  whose `-1` folds to a number. An operator's text under an access stands
  in a group: `(-[1])[0]` and `(1 + 2).x` come back as `(-[1])[0]` and
  `(1+2).x`.
- `NaN`, `Infinity` and `-Infinity` — a literal, or a number that overflowed
  to infinity — are emitted as those words in a DataJS or FunctionalScript
  document, and `-0` as `-0` in every format.

## Examples

No programs yet: this page's accepted and refused examples are a follow-up.

## Reference

- ECMA-262: none; this is FunctionalScript's own tool, not a feature of the language.
