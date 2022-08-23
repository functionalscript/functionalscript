# FunctionalScript

FunctionalScript is a purely functional programming language and a strict subset of
[ECMAScript](https://en.wikipedia.org/wiki/ECMAScript)/[JavaScript](https://en.wikipedia.org/wiki/JavaScript). It's inspired by

- [JSON](https://en.wikipedia.org/wiki/JSON) as a subset of JavaScript. JSON is also a subset of FunctionalScript.
- [asm.JS](https://en.wikipedia.org/wiki/Asm.js)/[WebAssembly](https://en.wikipedia.org/wiki/WebAssembly), as a subset of JavaScript.
- [TypeScript](https://en.wikipedia.org/wiki/TypeScript), as a superset of JavaScript.

[A brief description of FunctionalScript Programming Language](./doc/LANGUAGE.md).

Create a new FunctionalScript repository on GitHub [here](https://github.com/functionalscript/template/generate).

Learn more about [FunctionalScript](https://medium.com/@sergeyshandar/purely-functional-programming-in-javascript-91114b1b2dff).

## Design Principles

In FunctionalScript:

- Any module is a valid JavaScript module. No additional build steps are required.
- Code should not have [side-effects](https://en.wikipedia.org/wiki/Side_effect_(computer_science)). Any JavaScript statement, expression, or function which has a side effect is not allowed in FunctionalScript. There are no exceptions to this rule, such as `unsafe` code, which can be found in Rust, C#, and other languages.
- A module can't depend on a non FunctionalScript module.
- It also has no standard library. Only a safe subset of standard JavaScript API can be used without referencing other modules.

## Applications

FunctionalScript code can be used

- in any JavaScript/TypeScript application,
- as a JSON with expressions,
- as a query language.
