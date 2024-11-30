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

[A brief description of FunctionalScript Programming Language](./doc/LANGUAGE.md).

Learn more about
- [Purely Functional Programming in JavaScript](https://medium.com/@sergeyshandar/purely-functional-programming-in-javascript-91114b1b2dff),
- [FunctionalScript and I/O](https://medium.com/@sergeyshandar/functionalscript-5cf817345376).

## Design Principles

In FunctionalScript:

- Any module is a valid JavaScript module. No additional build steps are required.
- Code should not have [side-effects](https://en.wikipedia.org/wiki/Side_effect_(computer_science)). Any JavaScript statement, expression, or function that has a side effect is not allowed in FunctionalScript. There are no exceptions to this rule, such as `unsafe` code, which can be found in Rust, C#, and other languages.
- A module can depend only on another FunctionalScript module.
- It also has no standard library. Only a safe subset of standard JavaScript API can be used without referencing other modules.

## Applications

FunctionalScript code can be used:

- in any JavaScript/TypeScript application,
- as a JSON with expressions,
- as a query language.

## Sponsors

- [KirillOsenkov](https://github.com/KirillOsenkov),
- [antkmsft](https://github.com/antkmsft).
