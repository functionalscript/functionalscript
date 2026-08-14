# FunctionalScript

[![NPM Version](https://img.shields.io/npm/v/functionalscript)](https://www.npmjs.com/package/functionalscript)

FunctionalScript is a safe, purely functional programming language and a strict subset of
[ECMAScript](https://en.wikipedia.org/wiki/ECMAScript)/[JavaScript](https://en.wikipedia.org/wiki/JavaScript). It's inspired by

- [JSON](https://en.wikipedia.org/wiki/JSON) and [JSON5](https://json5.org/) as subsets of JavaScript.
  JSON is also a subset of FunctionalScript.
- [asm.JS](https://en.wikipedia.org/wiki/Asm.js) (a precursor of [WebAssembly](https://en.wikipedia.org/wiki/WebAssembly)),
  as a subset of JavaScript.
- [TypeScript](https://en.wikipedia.org/wiki/TypeScript), as a superset of JavaScript.

[A working draft of the FunctionalScript specification](./spec/README.md).

Learn more about

- [Purely Functional Programming in JavaScript](https://blog.bitsrc.io/purely-functional-programming-in-javascript-91114b1b2dff?sk=5f7132e56902f38fcf4c6164bfa681ed),
- [FunctionalScript and I/O](https://medium.com/@sergeyshandar/functionalscript-5cf817345376?sk=30b32189a81d1a2dad16c2244f32328d).

This repository is a [monorepo](https://en.wikipedia.org/wiki/Monorepo) and distributed under [MIT](LICENSE).

## Getting Started

Install FunctionalScript via npm:

```bash
npm install -g functionalscript
```

or run the CLI without installing it, with `npx functionalscript <command>`.

### Compiling a module

A FunctionalScript module is already a valid JavaScript module, so nothing has to
be compiled in order to *run* it. The compiler serves the other direction: it
evaluates a module and emits the data it exports, with every `import` resolved.

`m.f.js`:

```js
export default "text"
```

`input.f.js`:

```js
import c from "./m.f.js"
const a = 1
export default [a, a, c, { x: c }]
```

The output file extension picks the format:

```bash
fjs compile input.f.js output.f.js   # JavaScript
fjs compile input.f.js output.json   # JSON
```

`output.f.js` preserves the object graph — a value referenced more than once
stays shared and is emitted as a `const`:

```js
const c0 = "text"
export default [1,1,c0,{"x":c0}]
```

`output.json` is a tree, so shared values are expanded, and types that JSON
cannot express (`bigint`, `undefined`) are not available:

```json
[1,1,"text",{"x":"text"}]
```

The compiler currently accepts `import` statements, `const` declarations, and
data expressions (objects, arrays, strings, numbers, `bigint`, booleans, `null`,
`undefined`). Functions and computed expressions are not supported yet. See
[fjs/djs/README.md](fjs/djs/README.md) for the data language and its roadmap, and
[fjs/fsc/README.md](fjs/fsc/README.md) for the compiler itself.

### The `fjs` CLI

| Command       | Description                                                    | Documentation                                          |
|---------------|----------------------------------------------------------------|--------------------------------------------------------|
| `fjs test`    | Run the FunctionalScript test suite                            | [fjs/emergent_testing](fjs/emergent_testing/README.md) |
| `fjs compile` | Compile a FunctionalScript module to JavaScript or JSON        | [fjs/djs](fjs/djs/README.md)                           |
| `fjs run`     | Run a FunctionalScript module as a Node program                | [fjs/README.md](fjs/README.md)                         |
| `fjs cas`     | Content-addressable storage (`add`, `get`, `list`)             | [fjs/cas/README.md](fjs/cas/README.md)                 |
| `fjs mcp`     | [MCP](https://modelcontextprotocol.io/) server over stdio, exposing the CAS and Evo as tools | [fjs/mcp/README.md](fjs/mcp/README.md) |
| `fjs ci`      | Generate the GitHub Actions CI workflow                        | [fjs/ci/README.md](fjs/ci/README.md)                   |

Run `fjs help` to print the available commands, or see
[fjs/README.md](fjs/README.md) for the full CLI reference. Commands also accept
short aliases, which `fjs help` prints; the documentation spells them out
instead.

## Vision

We aim to create a safe, cross-platform programming language that can work in any JS platform without any build step. There are thousands of programming languages, and we don't want to create another one that others must learn. Instead, we take the opposite approach: we remove everything that makes the most popular and cross-platform language unsafe, insecure, or less portable.

## Applications

FunctionalScript code can be used:

- safely in any JavaScript/TypeScript application or library;
- as a JSON with expressions, see [DJS](https://medium.com/@sasha.gil/bridging-the-gap-from-json-to-javascript-without-dsls-fee273573f1b);
- as a query language;
- as a smart contract programming language in DeFi.

## Design Principles

In FunctionalScript:

- Any module is a valid JavaScript module. No additional build steps are required.
- Code should not have [side-effects](https://en.wikipedia.org/wiki/Side_effect_(computer_science)). Any JavaScript statement, expression, or function that has a side effect is not allowed in FunctionalScript. There are no exceptions to this rule, such as `unsafe` code, which can be found in Rust, C#, and other languages.
- A module can depend only on another FunctionalScript module.
- It also has no standard library. Only a safe subset of standard JavaScript API can be used without referencing other modules.

## Sponsors

- [KirillOsenkov](https://github.com/KirillOsenkov),
- [antkmsft](https://github.com/antkmsft),
- [Mark Heyman](https://opencollective.com/body-count).
