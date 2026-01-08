# FunctionalScript

[![NPM Version](https://img.shields.io/npm/v/functionalscript)](https://www.npmjs.com/package/functionalscript)
[![JSR Version](https://img.shields.io/jsr/v/%40functionalscript/functionalscript)](https://jsr.io/@functionalscript/functionalscript)

FunctionalScript is a safe, purely functional programming language and a strict subset of
[ECMAScript](https://en.wikipedia.org/wiki/ECMAScript)/[JavaScript](https://en.wikipedia.org/wiki/JavaScript). It's inspired by

- [JSON](https://en.wikipedia.org/wiki/JSON) and [JSON5](https://json5.org/) as subsets of JavaScript.
  JSON is also a subset of FunctionalScript.
- [asm.JS](https://en.wikipedia.org/wiki/Asm.js) (a precursor of [WebAssembly](https://en.wikipedia.org/wiki/WebAssembly)),
  as a subset of JavaScript.
- [TypeScript](https://en.wikipedia.org/wiki/TypeScript), as a superset of JavaScript.

[A working draft of the FunctionalScript specification](./issues/lang/README.md).

Learn more about

- [Purely Functional Programming in JavaScript](https://blog.bitsrc.io/purely-functional-programming-in-javascript-91114b1b2dff?sk=5f7132e56902f38fcf4c6164bfa681ed),
- [FunctionalScript and I/O](https://medium.com/@sergeyshandar/functionalscript-5cf817345376?sk=30b32189a81d1a2dad16c2244f32328d).

This repository is a [monorepo](https://en.wikipedia.org/wiki/Monorepo) and distributed under [MIT](LICENSE).

## Getting Started

Install FunctionalScript via npm:

```bash
npm install functionalscript
```

The FunctionalScript compiler command (`fjs compile`) currently supports:

* `import` statements
* `const` declarations

It does **not** yet support functions or complex expressions.

Example usage with `fjs`:

```bash
npx fjs compile example.f.js output.json
# or
npx fjs compile example.f.js output.f.js
```

FunctionalScript code can be compiled directly into either JSON or JavaScript without imports.

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

## Our Next Step

[Re-architecture of NaNVM](https://medium.com/@sergeyshandar/nanvm-re-architecture-8097f766ec1c?sk=d14ec1daf73ac5442f12ce20b2bc037a).

## Sponsors

- [KirillOsenkov](https://github.com/KirillOsenkov),
- [antkmsft](https://github.com/antkmsft),
- [Mark Heyman](https://opencollective.com/body-count).
