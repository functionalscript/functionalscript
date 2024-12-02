# FunctionalScript

[![NPM Version](https://img.shields.io/npm/v/functionalscript)](https://www.npmjs.com/package/functionalscript)
[![JSR Version](https://img.shields.io/jsr/v/%40functionalscript/functionalscript)](https://jsr.io/@functionalscript/functionalscript)

FunctionalScript is a purely functional programming language and a strict subset of
[ECMAScript](https://en.wikipedia.org/wiki/ECMAScript)/[JavaScript](https://en.wikipedia.org/wiki/JavaScript). It's inspired by

- [JSON](https://en.wikipedia.org/wiki/JSON) and [JSON5](https://json5.org/) as subsets of JavaScript.
  JSON is also a subset of FunctionalScript.
- [asm.JS](https://en.wikipedia.org/wiki/Asm.js)/[WebAssembly](https://en.wikipedia.org/wiki/WebAssembly),
  as a subset of JavaScript.
- [TypeScript](https://en.wikipedia.org/wiki/TypeScript), as a superset of JavaScript.

[A working draft of the FunctionalScript specification](./issues/lang/README.md).

Learn more about
- [Purely Functional Programming in JavaScript](https://medium.com/@sergeyshandar/purely-functional-programming-in-javascript-91114b1b2dff),
- [FunctionalScript and I/O](https://medium.com/@sergeyshandar/functionalscript-5cf817345376).

FunctionalScript is distributed under [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.en.html#license-text). Let us know if you need another license by sending an [email](mailto:sergey.oss@proton.me).

## Vision

We aim to create a safe, cross-platform programming language that can work in any JS platform without any build step. There are thousands of programming languages, and we don't want to create another one that others must learn. Actually, we do the opposite; we remove everything that makes the most popular and cross-platform language unsafe, insecure, and less portable.

## Applications

FunctionalScript code can be used:

- safely in any JavaScript/TypeScript application or library;
- as a JSON with expressions, see [DJS](https://medium.com/@sasha.gil/bridging-the-gap-from-json-to-javascript-without-dsls-fee273573f1b);
- as a query language,
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
- [antkmsft](https://github.com/antkmsft).
