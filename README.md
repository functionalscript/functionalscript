# FunctionalScript

FunctionalScript is a pure functional programming language and a strict subset of 
[ECMAScript](https://en.wikipedia.org/wiki/ECMAScript)/[JavaScript](https://en.wikipedia.org/wiki/JavaScript). It's inspired by 

- [JSON](https://en.wikipedia.org/wiki/JSON), as a subset of JavaScript. JSON is also a subset of FunctionalScript.
- [asm.JS](https://en.wikipedia.org/wiki/Asm.js)/[WebAssembly](https://en.wikipedia.org/wiki/WebAssembly), as a subset of JavaScript.
- [TypeScript](https://en.wikipedia.org/wiki/TypeScript), as a superset of JavaScript.

Try FunctionalScript [here](https://functionalscript.com/).

Create a new FunctionalScript repository on GitHub [here](https://github.com/functionalscript/template/generate).

To install this repository as a library use:

```
npm install -S github:functionalscript/functionalscript
```

## Principles

- Any FunctionalScript module is a valid JavaScript module
- A FunctionalScript modules can't depend on non FunctionalScript module. 
- A FunctionalScript can contain only pure functional statements. No exceptions, such `unsafe` code in Rust or C#.
- A FunctionalScript has no standard library. Only a safe subset of standard JavaScript API is allowed.

## Outlines


