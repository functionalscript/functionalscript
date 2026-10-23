# Shared Values, Constants

**Status:** implemented

```js
const port = 8080;
const server = { "port": port, "host": "localhost" };
export default { "dev": server, "prod": server };
```

A `const` statement names a value so that it can be *used more than once*. It
is what makes a module denote a **graph** rather than a tree, and it is the
main thing FunctionalScript data has that JSON data does not.

JSON can only represent a tree, so a value used twice is written twice. Two
copies are not one shared value: they take twice the space, they drift apart
when only one is edited, and a reader that loads them gets two objects where
the author meant one. The usual answers — an id/reference convention, a
`$ref` pointer — require a bespoke format and a bespoke resolver on both
sides, and what they load still has a different shape from the object graph
the author had in mind. In FunctionalScript the sharing *is* the language:
`const` and `import` are how a value gets more than one reference, and a
JavaScript engine loading the module rebuilds exactly the graph that was
written.

- A name is an [identifier](../../lexical/identifiers/README.md), and one rule says which
  identifiers a binding may take — a `const`, a body `const`, a parameter,
  fixed or rest, and an import's local name alike. A word JavaScript reserves
  in a module is refused: `const if = 1;`, `const export = 1;`,
  `const let = 1;` and `const await = 1;` are errors here as they are there.
  So are `eval` and `arguments`, which strict code may not bind —
  `const eval = 1;` and `(arguments) => 1` are errors in both languages —
  since any broken JavaScript program is a broken FunctionalScript program.
  `undefined`, `NaN` and `Infinity` are refused as well, although a
  JavaScript module may bind them, so that each denotes its value wherever a
  value stands ([numbers](../../values/numbers/README.md)). `Array`, `Number`, `Object` and `String`
  are also reserved under [global names](../../todo/2365-global-names.md), with no
  standalone values: `Array` stands in [instance checks](../../operators/instanceof/README.md), `Number`
  and `String` stand as [number](../../conversions/number/README.md) and
  [string](../../conversions/string/README.md) conversions, and `Object` and `Number` as the
  namespaces of the [static functions](../../built-ins/static-functions/README.md). A word
  that is a keyword only in some
  position — `async`, `of`, `get`, `set`, `from`, `as` — is an ordinary name,
  as in JavaScript, and so are `type` and `then`:
  `(from, then) => [from, then]` is a function, and `then` is refused only as
  an export's name ([exporting a value](../../modules/exports/README.md)). A key or a
  property name is not a binding, and this rule does not reach it:
  `{ if: 1 }` and `a.default` are a key and an access, as in JavaScript.
- A name must be declared before it is used. Forward references are not
  recognized yet ([forward-references](../../todo/3140-forward-references.md)).
- Imported and constant names share one namespace, the module function's
  ([a module is a function](../../modules/README.md#a-module-is-a-function)): declaring the same
  name twice is an error.
- Every `const` is evaluated as its own statement, whether or not anything
  reads it — a module's when the module loads, a function body's at every
  call ([functions](../../functions/README.md)) — so its failure is the module's or the
  call's, as in JavaScript: `const c = null.x; export default 1;` throws at
  load. The [failure contract](../../principles/README.md#failure-is-one-outcome) says what an
  implementation may reorder around it. The FunctionalScript and EDAG outputs
  keep what such a `const` computes, and the value outputs, which write only
  the value, still evaluate it and refuse the module when it fails
  ([output](../../command-line/output.md)).
- Every ordinary or exported `const`, and every `let`, comes after every
  `import` and before `export default`, when present
  ([module structure](../../modules/README.md)).
- `let` declares a variable, a name an assignment may rebind
  ([variables](../variables/README.md)); `var` is not part of the language
  ([`var`](../var/README.md)).

Sharing is a property of the *value*, not of the name, so what the compiler
preserves is what the graph actually shares. A DataJS document writes it in
[normalized form](../../datajs/README.md#normalized-form):

- a `const` referenced once is inlined into its single use;
- an object or an array referenced more than once is emitted as a `const`,
  whether the source named it or not;
- a primitive is written inline wherever it is read, however many times,
  even when a `const` or an import names it:
  `const s = "str"; export default [s, s];` writes the string twice in every
  output, JSON included, since a primitive has no identity for a second
  reference to share;
- objects and arrays are shared by identity, so two separately written objects
  with equal contents stay two objects.

```js
const a = { "x": 1 };
const b = [a, a];
export default [b, b, a];
```

is written, as DataJS and as FunctionalScript, as

```js
const $0={"x":1};const $1=[$0,$0];export default [$1,$1,$0];
```

and as JSON, a tree, with the node written where each reference reaches it,
`[[{"x":1},{"x":1}],[{"x":1},{"x":1}],{"x":1}]`. A
function has identity as an object does ([functions](../../functions/README.md)), so a
FunctionalScript document shares one the same way:
`const f = () => 1; export default [f, f];` is written
`const $0=()=>1;export default [$0,$0];`. Not every FunctionalScript
document is in normalized form: a module with a named export, among others,
gives what it computes more names than normalized form does
([output](../../command-line/output.md)).

See
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const>.

## Examples

The compiler demo offers the programs `constants` in [`module.f.js`](../module.f.js), each with its real output.

The demo on this page runs [`sample.f.js`](./sample.f.js), this page's
example as a function of one number — one `const` reached by two names:
`dev` and `prod` are the same object — with every output `fjs compile` makes
of it: the expression graph (EDAG), the Rust and the WebAssembly that Rust
builds to. Its Run button calls the default export with `0` and `1`, as
JavaScript and as WebAssembly, and shows what each call returned or threw.

```js
const port = 8080;
const server = { "port": port, "host": "localhost" };
const config = { "dev": server, "prod": server };
export default (...a) => [config.dev === config.prod, config.prod.port + a[0], config.dev.host];
```

## Reference

- ECMA-262: [Let and const declarations](https://tc39.es/ecma262/#sec-let-and-const-declarations)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const>
