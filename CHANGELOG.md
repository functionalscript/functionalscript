# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## 0.12.9

- RTTI: TS: generating simple TypeScript definitions from RTTI. [751](https://github.com/functionalscript/functionalscript/pull/751)
- Io: Improve exec [752](https://github.com/functionalscript/functionalscript/pull/752)

## 0.12.8

- Effects: exec: stdin [750](https://github.com/functionalscript/functionalscript/pull/750)

## 0.12.7

- bitVec: chunkList() [749](https://github.com/functionalscript/functionalscript/pull/749)

## 0.12.6

- Effects: Exec [748](https://github.com/functionalscript/functionalscript/pull/748)

## 0.12.5

- Effects: Rm [747](https://github.com/functionalscript/functionalscript/pull/747)

## 0.12.2

- RTTI: Or [737](https://github.com/functionalscript/functionalscript/pull/737)

## 0.12.1

- RTTI: type simplification for TypeScript [736](https://github.com/functionalscript/functionalscript/pull/736)

## 0.12.0

- RTTI: new design [734](https://github.com/functionalscript/functionalscript/pull/734)

## 0.11.11

- RTTI: the first version [733](https://github.com/functionalscript/functionalscript/pull/733)

## 0.11.10

- BitVec: BitVec: improve `u8ListToVec` [732](https://github.com/functionalscript/functionalscript/pull/732)

## 0.11.9

- BitVec: another significant performance improvement for `u8List` [731](https://github.com/functionalscript/functionalscript/pull/731)
- BitVec: BitVec: `BitOrder.cmp` [729](https://github.com/functionalscript/functionalscript/pull/729)

## 0.11.8

- BitVec: improve performance of `u8List` [728](https://github.com/functionalscript/functionalscript/pull/728)

## 0.11.7

- BitVec: improve performance of `u8ListToVec` [727](https://github.com/functionalscript/functionalscript/pull/727)

## 0.11.6

- Effects: HTTP: createServer: a universal request listener [726](https://github.com/functionalscript/functionalscript/pull/726)

## 0.11.5

- Effects: the `forever` command [725](https://github.com/functionalscript/functionalscript/pull/725)

## 0.11.4

- Effects: createServer: IncomingMessage and ServerResponse [724](https://github.com/functionalscript/functionalscript/pull/724)

## 0.11.3

- Effects: HTTPS: `listen` [722](https://github.com/functionalscript/functionalscript/pull/722)

## 0.11.2

- Effects: HTTPS: `createServer` and `listen`. [716](https://github.com/functionalscript/functionalscript/pull/716)

## 0.11.1

- Effects: the `both` function [710](https://github.com/functionalscript/functionalscript/pull/710)

## 0.11.0

- Effects: refactoring: 1. fluent native, 2. operation set. [708](https://github.com/functionalscript/functionalscript/pull/708)
- Effects: bug: `all` should return `Effect<..., readonly T[]>` [707](https://github.com/functionalscript/functionalscript/pull/707)
- Effects: generic `all` [704](https://github.com/functionalscript/functionalscript/pull/704)

## 0.10.3

- Effects: No more `map`s. [699](https://github.com/functionalscript/functionalscript/pull/699).

## 0.10.2

- Effects: Effects: a new simplified `Effect` type. Also, we provide a `fluent` object for fluent programming. [698](https://github.com/functionalscript/functionalscript/pull/698)

## 0.10.1

- FJS: running Node programs [696](https://github.com/functionalscript/functionalscript/pull/696)

## 0.10.0

- IO: effects by default [695](https://github.com/functionalscript/functionalscript/pull/695)
- CI: Cache for Playwright [691](https://github.com/functionalscript/functionalscript/pull/691)
- Add module-level JSDoc headers across many modules [690](https://github.com/functionalscript/functionalscript/pull/690)

## 0.9.3

- Base128: bug fix [688](https://github.com/functionalscript/functionalscript/pull/688)
- Effect: `fetch` [684](https://github.com/functionalscript/functionalscript/pull/684)
- ASN.1: Unsupported tags. New module: Base128 [682](https://github.com/functionalscript/functionalscript/pull/682)
- ASN.1: integer, boolean, sequence, set [679](https://github.com/functionalscript/functionalscript/pull/679)
- ASN.1: basic encoding/decoding [678](https://github.com/functionalscript/functionalscript/pull/678)

## 0.9.2

- Effect: Node: Add `Dirent` to the `readdir` result [676](https://github.com/functionalscript/functionalscript/pull/676)
- Effect: move `IO` related functions to `./io` [675](https://github.com/functionalscript/functionalscript/pull/675)
- Effect: Remove one type parameter from operations [674](https://github.com/functionalscript/functionalscript/pull/674)
- CAS: read/write/list implementation [673](https://github.com/functionalscript/functionalscript/pull/673)
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
- New Nominal type that prohibits `<` operations in Type Script
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
