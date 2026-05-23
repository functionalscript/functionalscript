# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

- `tf`: virtual tests via `JsModule` + pass-through `sandbox`; `Reporter<O>` generic; `Program<O>` generic type; `LoadModuleOperations` alias; export `defaultReporter`, `fmtPath`, `fmtTerm`, `ghEscape`, `isInteger`, `isIdentifier` ([i156](./issues/156-tf-virtual-tests.md)) [840](https://github.com/functionalscript/functionalscript/pull/840)
- Effects: Node: Virtual: new file type - JsModule. PR [834](https://github.com/functionalscript/functionalscript/pull/834)
- `tf`: extract `Reporter` interface (`moduleStart` / `enter` / `pass` / `fail` / `summary`, each an `Effect<NodeOp, void>`); `test` now takes a `Reporter` and returns a `NodeProgram`; `main` builds the default CSI/GitHub reporter and calls `test(reporter)(options)`; `isGitHub` branching moves out of the walker into the default reporter; describe quiet/dynamic-progress reporter modes in [i155](./issues/155-test-runner-integration.md); remove unused `loadModuleMap` from `dev/module.f.ts`
- `fjs`: convert `main` to `NodeProgram`; dispatch sub-commands by returning Effects directly; remove `Io`/`fromIo`/`runProgram` dependency; `module.ts` switches from `legacyRun` to `effectRun` ([i122](./issues/README.md)) [830](https://github.com/functionalscript/functionalscript/pull/830)
- `tf`: convert `main` to `NodeProgram` — `(options: NodeProgramOptions) => Effect<NodeOp, number>`; replace `Io` dependency with `loadModuleMap2`, `sandbox` effect, and `csiWrite`; sequential test walk uses effectful `.reduce()` + `.step()` instead of synchronous `fold` ([i148](./issues/148-test-framework-effects.md)) [828](https://github.com/functionalscript/functionalscript/pull/828)
- `tf`: eliminate double `sandbox` call for throw-tests; `parseTestSet` returns `TestEntry = { fn, throws }` instead of a wrapper; discriminate branches with `instanceof Array`; add `TestEntry` type; document dependency-free test design in README; add no-type-predicate rule to `AGENTS.md` ([i154](./issues/154-parseset-throws.md)) [827](https://github.com/functionalscript/functionalscript/pull/827)
- `uint8array`: mark module deprecated — use `utf8`/`utf8ToString` from `fs/text` and `bit_vec` directly; replace all internal usages in `djs`, `sgr`, and virtual runner
- `tf`: remove unused `anyLog` helper
- Effects: retire `Log`/`Error`/`Console` operation types; replace with `log`/`error` helpers built on `write` — `log(s)` writes to `stdout`, `error(s)` to `stderr`, both UTF-8-encoded with `\n` [822](https://github.com/functionalscript/functionalscript/pull/822)
- Effects: add `Write` effect (`write(stream, data)`) and `WriteConsoles` to `NodeOp`; add `std` to `NodeProgramOptions` for startup TTY constants; add `csiWrite` to `fs/text/sgr` for TTY-aware UTF-8 writes; wire `write` handler in `fromIo` and virtual runner ([i152](./issues/152-write-effect.md)) [816](https://github.com/functionalscript/functionalscript/pull/816)
- IO: add `write(stream, data)` to `Io` with backpressure via `stream.write()` + `once(stream, 'drain')`; add `WriteConsoles` type ([i153](./issues/153-write-queue.md)) [821](https://github.com/functionalscript/functionalscript/pull/821)

## 0.17.0

- Effects: replace `NodeProgram`'s two positional parameters with `NodeProgramOptions` — `{ args, env }` [814](https://github.com/functionalscript/functionalscript/pull/814)
- `tf`: remove `Input` intermediary type; `test` takes `Io` directly [813](https://github.com/functionalscript/functionalscript/pull/813)
- `fjs`: convert `run`/`r` command from `asyncImport`/`await` to `import_` effect [812](https://github.com/functionalscript/functionalscript/pull/812)
- DJS transpiler: replace `Fs`/`readFileSync` with `ReadFile` effect; tests use virtual effect runner; delete `fs/io/virtual` ([i151](./issues/151-transpiler-effects.md)) [811](https://github.com/functionalscript/functionalscript/pull/811)
- IO: expose `sandbox` on `Io` interface; test framework: replace `measure`+`tryCatch` with `sandbox`, eliminating state threading ([i149](./issues/149-sandbox.md)) [809](https://github.com/functionalscript/functionalscript/pull/809)
- Effects: add `sandbox` operation — runs a plain sync function with try/catch and `performance.now()` timing in one atomic operation; `SandboxResult<T>` carries result and duration ([i149](./issues/149-sandbox.md)) [808](https://github.com/functionalscript/functionalscript/pull/808)
- Docs: add the required JSDoc `@module` header to every `module.f.ts` that was missing one, so each module has a one-line description on JSR ([i13](./issues/README.md)) [804](https://github.com/functionalscript/functionalscript/pull/804)

## 0.16.1

- Effects: add `now` operation returning epoch nanoseconds as `bigint` via `Date.now()`; virtual runner exposes `epochNs` for deterministic tests [803](https://github.com/functionalscript/functionalscript/pull/803)

## 0.16.0

- RTTI `Ts<>`: optional field inference; CI: derive `Step`/`Job`/`GitHubAction` types from RTTI schemas; allow `--allow-slow-types` in Deno publish ([i147](./issues/README.md)) [798](https://github.com/functionalscript/functionalscript/pull/798)
- RTTI: extract shared kernel (error shape, primitive checks, `match` recognizer) from `validate`/`parse` into a new `rtti/common` module ([i133](./issues/README.md)) [797](https://github.com/functionalscript/functionalscript/pull/797)
- NodeProgram: move `Env` to `fs/types/effects/node` and add as second parameter [795](https://github.com/functionalscript/functionalscript/pull/795)

## 0.15.0

- Effects: unify `do_`/`doRest` and `Func`/`RestFunc` into a single rest-parameter form; operation payload types are now uniformly tuples ([i121](./issues/README.md)) [794](https://github.com/functionalscript/functionalscript/pull/794)
- Test framework: parse non-default exports — a test file can now spread its tests across multiple named exports ([i27](./issues/README.md)) [790](https://github.com/functionalscript/functionalscript/pull/790)

## 0.14.1

- CI: add `ci(rust: boolean)` function to conditionally include Rust steps [780](https://github.com/functionalscript/functionalscript/pull/780)
- RTTI: fix `NaN` handling in const validation by using `Object.is` instead of `===` [777](https://github.com/functionalscript/functionalscript/pull/777)

## 0.14.0

- Restructure [773](https://github.com/functionalscript/functionalscript/pull/773)
- Test framework: detect pass-on-throw tests by enclosing `throw` key, supporting function references and grouped tests [769](https://github.com/functionalscript/functionalscript/pull/769)
- CI: centralize tool versions, split into per-tool modules, add Playwright browser cache [764](https://github.com/functionalscript/functionalscript/pull/764)
- Refactor StateScan to swap input and state parameter order [763](https://github.com/functionalscript/functionalscript/pull/763).
- SUL: first three levels. BitVec: chunking functions. [755](https://github.com/functionalscript/functionalscript/pull/757)
- RTTI: parse (deserializer) [760](https://github.com/functionalscript/functionalscript/pull/760)

## 0.13.0

- RTTI: `print(mut?: true)` [754](https://github.com/functionalscript/functionalscript/pull/754)

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
