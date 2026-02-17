# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

- CAS: read/write implementation [673](https://github.com/functionalscript/functionalscript/pull/673)
- Effect: Effect: readdir w/o recursive flag. [671](https://github.com/functionalscript/functionalscript/pull/671)
- Connect IO and Effect [670](https://github.com/functionalscript/functionalscript/pull/670)
- Effect: Generating the website using Effects. [666](https://github.com/functionalscript/functionalscript/pull/666)
- Effect: Node: stderr [665](https://github.com/functionalscript/functionalscript/pull/665)
- Effect: `flatMap` => `pipe` [664](https://github.com/functionalscript/functionalscript/pull/664)
- Effect: Node: readdir [663](https://github.com/functionalscript/functionalscript/pull/663)
- Effect: Mock [658](https://github.com/functionalscript/functionalscript/pull/658)
- Effect: `map` and `flatMap` [PR657](https://github.com/functionalscript/functionalscript/pull/657)
- Effect: bind [PR 656](https://github.com/functionalscript/functionalscript/pull/656)
- Effect: do_ and other helpers [PR 654](https://github.com/functionalscript/functionalscript/pull/654)

## 0.9.0

- Replace legacy fsc/fst usage with fjs CLI [PR 619](https://github.com/functionalscript/functionalscript/pull/619)
- Add fjs CLI [PR 618](https://github.com/functionalscript/functionalscript/pull/618)
- Move the prime field module from `crypto/` to `types/`[PR 602](https://github.com/functionalscript/functionalscript/pull/602)
- Digital signatures [PR 599](https://github.com/functionalscript/functionalscript/pull/599)

## 0.8.1

- 64bit SHA2 padding is fixed [PR 595](https://github.com/functionalscript/functionalscript/pull/595)
- A compact version of Bit Vector [PR 575](https://github.com/functionalscript/functionalscript/pull/575)
- Running tests in browsers [PR 572](https://github.com/functionalscript/functionalscript/pull/572)
- Generating a GitHub CI file [PR 569](https://github.com/functionalscript/functionalscript/pull/569)
- New Nominal type that prohibits '<' operations in Type Script
  [PR 567](https://github.com/functionalscript/functionalscript/pull/567).

## 0.8.0

- Switch to MIT License [PR 557](https://github.com/functionalscript/functionalscript/pull/557) and
  [559](https://github.com/functionalscript/functionalscript/pull/559).

## 0.7.0

- New automatic test runner for `Node.js`, `Deno`, and `Bun`
  [PR 518](https://github.com/functionalscript/functionalscript/pull/518)

## 0.6.11

- Support for Deno Test and Coverage.

## 0.6.10

- Trailing comma and identifier properties [PR 484](https://github.com/functionalscript/functionalscript/pull/484),
- Property names as identifiers [PR 466](https://github.com/functionalscript/functionalscript/pull/466),
- Add file name and position of the symbol in the file to parser and transpiler errors [PR 493](https://github.com/functionalscript/functionalscript/pull/493).

```js
export default [
    {
        a: "x",
    },
]
```

## 0.6.9

Import, const, comments, undefined, and bigint.

```js
import a from "./a.f.js"
// const
const c = -24n
export default {
    /* properties: */
    "a": [5.3, false, -24n, undefined],
    "c": c
}
```

## 0.6.8

- `fsc` can serialize as tree [PR 442](https://github.com/functionalscript/functionalscript/pull/442)

## 0.6.7

- `fsc` can parse json [PR 434](https://github.com/functionalscript/functionalscript/pull/434)

## 0.6.2

- Tests can run from a directory [PR 425](https://github.com/functionalscript/functionalscript/pull/425)

## 0.6.0

- The FunctionalScript JSR package includes `module.ts` files [PR #423](https://github.com/functionalscript/functionalscript/pull/423),
- Dropped support for Node 16, Node 18 and Deno 1.

## 0.5.0

- `fsc` added as an executable into npm package [PR #396](https://github.com/functionalscript/functionalscript/pull/396)

## 0.4.3

- Implementation of HMAC [PR #371](https://github.com/functionalscript/functionalscript/pull/371)

## 0.4.2

- Faster `types/big_int/log2` algorithm for WebKit (Bun and Safari) [PR #368](https://github.com/functionalscript/functionalscript/pull/368)

## 0.4.1

- Faster `types/big_int/log2` algorithm [PR #365](https://github.com/functionalscript/functionalscript/pull/365)

## 0.4.0

- COM and Commonjs modules are retired [PR #367](https://github.com/functionalscript/functionalscript/pull/367).

## 0.3.13

- First LL(1) parser [PR #356](https://github.com/functionalscript/functionalscript/pull/356)

## 0.3.12

- BNF types and `RangeMapOp` interface [PR #355](https://github.com/functionalscript/functionalscript/pull/355)

## 0.3.9

- Improved `types/bigint/log2` algorithm [PR #346](https://github.com/functionalscript/functionalscript/pull/346)

## 0.3.8

- SHA2 that works on bit vectors [PR #345](https://github.com/functionalscript/functionalscript/pull/345)

## 0.3.7

- Monoid [PR #343](https://github.com/functionalscript/functionalscript/pull/343)

## 0.3.6

- export `html.Node` [PR #342](https://github.com/functionalscript/functionalscript/pull/342)

## 0.3.5

- fix for Node <=v20 [PR #341](https://github.com/functionalscript/functionalscript/pull/341)
- a main module [PR #340](https://github.com/functionalscript/functionalscript/pull/340)

## 0.3.0

- Switching to TypeScript file [PR #330](https://github.com/functionalscript/functionalscript/pull/330)
- DJS: add serializer [PR #326](https://github.com/functionalscript/functionalscript/pull/326)

## 0.2.6

- Refactoring of a vector of bits [PR #328](https://github.com/functionalscript/functionalscript/pull/328)

## 0.2.5

- new [crypto/] directory [PR #327](https://github.com/functionalscript/functionalscript/pull/327)
- simplified HTML [PR #327](https://github.com/functionalscript/functionalscript/pull/327)
- djs: add undefined and comments [PR #325](https://github.com/functionalscript/functionalscript/pull/325)

## 0.2.3

- BitVec and documentation update [PR #322](https://github.com/functionalscript/functionalscript/pull/322)

## 0.1.608
