# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

While the package is pre-1.0, the minor position carries the meaning the major
one will carry after 1.0: `0.Y` is bumped **only** by a release containing
`**BREAKING CHANGES:**`, and every other release — new features included — is a
patch bump. So `0.Y` is the API-compatibility boundary, which is also the
boundary `^0.Y.Z` and `~0.Y.Z` ranges already enforce: a patch upgrade is always
safe, and crossing `0.Y` always means reading the entries below. Releases through
`0.41.0` predate this convention and used a minor bump for feature-only releases
as well.

New entries are at most a few lines and link only to their pull request. A few
older entries predate that convention and have no PR link — they are kept as
history.

## Unreleased

- **BREAKING CHANGES:** `fjs/effects/eff` migrates from authored
  TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`), splitting
  the `Eff` type into a sibling `types.ts` — importers must use the
  `.f.mjs` specifier for runtime values and the `types.ts` specifier
  for types. `proof.f.ts` stays TypeScript for now
  [#1488](https://github.com/functionalscript/functionalscript/pull/1488)
- **BREAKING CHANGES:** `fjs/effects/mock` migrates from authored
  TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`), splitting
  its type-level API into a sibling `types.ts` — importers must use
  the `.f.mjs` specifier for runtime values and the `types.ts`
  specifier for types
  [#1488](https://github.com/functionalscript/functionalscript/pull/1488)
- **BREAKING CHANGES:** `fjs/effects/memory` migrates from authored
  TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`), splitting
  its type-level API into a sibling `types.ts` — importers must use
  the `.f.mjs` specifier for runtime values and the `types.ts`
  specifier for types. `proof.f.ts` stays TypeScript for now
  [#1488](https://github.com/functionalscript/functionalscript/pull/1488)
- **BREAKING CHANGES:** `fjs/effects/list` migrates from authored
  TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`), splitting
  its type-level API into a sibling `types.ts` — importers must use
  the `.f.mjs` specifier for runtime values and the `types.ts`
  specifier for types
  [#1487](https://github.com/functionalscript/functionalscript/pull/1487)
- **BREAKING CHANGES:** `fjs/effects/module.f.ts` migrates from
  authored TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`),
  splitting its type-level API into a sibling `types.ts` — importers
  must use the `.f.mjs` specifier for runtime values and the
  `types.ts` specifier for types. Updates all 30+ dependents across
  the repo; `proof.f.ts` stays TypeScript for now
  [#1487](https://github.com/functionalscript/functionalscript/pull/1487)
- **BREAKING CHANGES:** `fjs/bnf/descent` migrates from authored
  TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`), splitting
  its type-level API into a sibling `types.ts` — importers must use
  the `.f.mjs` specifier for runtime values and the `types.ts`
  specifier for types. `proof.f.ts` stays TypeScript for now
  [#1487](https://github.com/functionalscript/functionalscript/pull/1487)
- **BREAKING CHANGES:** `fjs/bnf/ll1` migrates from authored TypeScript
  (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`), splitting its
  type-level API into a sibling `types.ts` — importers must use the
  `.f.mjs` specifier for runtime values and the `types.ts` specifier
  for types. `proof.f.ts` stays TypeScript for now
  [#1487](https://github.com/functionalscript/functionalscript/pull/1487)
- **BREAKING CHANGES:** `fjs/bnf/data` migrates from authored TypeScript
  (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`), splitting its
  type-level API into a sibling `types.ts` — importers must use the
  `.f.mjs` specifier for runtime values and the `types.ts` specifier
  for types. `proof.f.ts` stays TypeScript for now
  [#1487](https://github.com/functionalscript/functionalscript/pull/1487)
- **BREAKING CHANGES:** `fjs/bnf/token_symbol` migrates from authored
  TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`), splitting
  the `Encoding<T>` type into a sibling `types.ts` — importers must use
  the `.f.mjs` specifier for runtime values and the `types.ts`
  specifier for types
  [#1486](https://github.com/functionalscript/functionalscript/pull/1486)
- **BREAKING CHANGES:** `fjs/crypto/vdf` migrates from authored
  TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`), splitting
  the `Sloth` type into a sibling `types.ts` — importers must use the
  `.f.mjs` specifier for runtime values and the `types.ts` specifier
  for types
  [#1486](https://github.com/functionalscript/functionalscript/pull/1486)
- **BREAKING CHANGES:** `fjs/bnf/module.f.ts` migrates from authored
  TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`), splitting
  its type-level API into a sibling `types.ts` — importers must use the
  `.f.mjs` specifier for runtime values and the `types.ts` specifier
  for types. `proof.f.ts` and `testlib.f.ts` stay TypeScript for now
  [#1485](https://github.com/functionalscript/functionalscript/pull/1485)
- **BREAKING CHANGES:** `fjs/media/nix` migrates from authored
  TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`), splitting
  the `Expression` type (and its private helper types) into a sibling
  `types.ts` — importers must use the `.f.mjs` specifier for runtime
  values and the `types.ts` specifier for types
  [#1485](https://github.com/functionalscript/functionalscript/pull/1485)
- **BREAKING CHANGES:** `fjs/ci/rust` migrates from authored TypeScript
  (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`) — importers must use
  the `.f.mjs` specifier
  [#1485](https://github.com/functionalscript/functionalscript/pull/1485)
- **BREAKING CHANGES:** `fjs/ci/deno` migrates from authored TypeScript
  (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`) — importers must use
  the `.f.mjs` specifier
  [#1485](https://github.com/functionalscript/functionalscript/pull/1485)
- **BREAKING CHANGES:** `fjs/ci/bun` migrates from authored TypeScript
  (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`) — importers must use
  the `.f.mjs` specifier
  [#1485](https://github.com/functionalscript/functionalscript/pull/1485)
- **BREAKING CHANGES:** `fjs/ci/common` migrates from authored
  TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`), splitting
  its type-level API (`Os`, `Architecture`, `Image`, `Step`, `Job`,
  `Jobs`, `GitHubAction`, `StepType`, `MetaStep`) into a sibling
  `types.ts` — importers must use the `.f.mjs` specifier for runtime
  values and the `types.ts` specifier for types
  [#1485](https://github.com/functionalscript/functionalscript/pull/1485)
- **BREAKING CHANGES:** `fjs/types/rtti/parse/module.f.ts` migrates from
  authored TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`),
  splitting its `Result`/`Parse` types into a sibling `types.ts` —
  importers must use the `.f.mjs` specifier for runtime values and the
  `types.ts` specifier for types. `proof.f.ts` stays TypeScript for
  now: it has a type-only dependency on the not-yet-migrated `fjs/djs`
  [#1485](https://github.com/functionalscript/functionalscript/pull/1485)
- **BREAKING CHANGES:** `fjs/types/rtti/validate/module.f.ts` migrates
  from authored TypeScript (`.f.ts`) to JSDoc-typed JavaScript
  (`.f.mjs`) — importers must use the `.f.mjs` specifier for runtime
  values and `fjs/types/rtti/common/types.ts` for the re-exported
  types. `proof.f.ts` stays TypeScript for now: it has a type-only
  dependency on the not-yet-migrated `fjs/djs`
  [#1485](https://github.com/functionalscript/functionalscript/pull/1485)
- **BREAKING CHANGES:** `fjs/types/rtti/common` migrates from authored
  TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`), splitting
  its type-level API into a sibling `types.ts` — importers must use the
  `.f.mjs` specifier for runtime values and the `types.ts` specifier
  for types
  [#1485](https://github.com/functionalscript/functionalscript/pull/1485)
- **BREAKING CHANGES:** `fjs/types/rtti/ts` migrates from authored
  TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`), splitting
  its `Ts<T>` type-transformer API into a sibling `types.ts` — importers
  must use the `.f.mjs` specifier for the `printer` runtime value and
  the `types.ts` specifier for types
  [#1485](https://github.com/functionalscript/functionalscript/pull/1485)
- **BREAKING CHANGES:** `fjs/types/rtti` migrates from authored
  TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`), splitting
  its type-level API into a sibling `types.ts` — importers must use the
  `.f.mjs` specifier for runtime values and the `types.ts` specifier
  for types
  [#1485](https://github.com/functionalscript/functionalscript/pull/1485)
- **BREAKING CHANGES:** `fjs/crypto/sign` migrates from authored
  TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`), splitting
  the `All` type into a sibling `types.ts` — importers must use the
  `.f.mjs` specifier for runtime values and the `types.ts` specifier
  for the type
  [#1485](https://github.com/functionalscript/functionalscript/pull/1485)
- **BREAKING CHANGES:** `fjs/media/html` migrates from authored
  TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`), splitting
  the `Element`/`Node` types into a sibling `types.ts` — importers must
  use the `.f.mjs` specifier for runtime values and the `types.ts`
  specifier for types
  [#1485](https://github.com/functionalscript/functionalscript/pull/1485)
- **BREAKING CHANGES:** `fjs/sul` migrates from authored TypeScript
  (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`), splitting the
  `EncodeState`/`Encode` types into a sibling `types.ts` — importers
  must use the `.f.mjs` specifier for runtime values and the `types.ts`
  specifier for types
  [#1485](https://github.com/functionalscript/functionalscript/pull/1485)
- **BREAKING CHANGES:** `fjs/types/object`, `fjs/sul/level/literal`,
  `fjs/sul/id`, `fjs/sul/level/hash`, `fjs/types/string_set`, and the
  `module.f.ts` of `fjs/types/sorted_set` and `fjs/types/byte_set`
  migrate to `.f.mjs`, splitting their public types into a sibling
  `types.ts` — importers must use the `.f.mjs` specifier for runtime
  values and the `types.ts` specifier for types
  [#1484](https://github.com/functionalscript/functionalscript/pull/1484)
- **BREAKING CHANGES:** `fjs/crypto/hmac`, `fjs/path`, and
  `fjs/media/json/serializer` migrate from authored TypeScript
  (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`) under the stage-1
  TypeScript-to-mjs migration — importers must use the `.f.mjs`
  specifier
  [#1484](https://github.com/functionalscript/functionalscript/pull/1484)
- **BREAKING CHANGES:** every public type exported by an authored `.f.mjs`
  module moves to a sibling `types.ts` (31 modules, including `asserts`,
  `types/list`, `types/bit_vec`, `types/result`, `text`, `crypto/sha2`) —
  importers of these types must use the `types.ts` specifier. The runtime-empty
  `fjs/types/option/module.f.mjs` becomes `fjs/types/option/types.ts`
  [#1483](https://github.com/functionalscript/functionalscript/pull/1483)
- `fjs/types/nullable/proof.f.ts`, `fjs/types/range/proof.f.ts`,
  `fjs/types/function/proof.f.ts`, `fjs/types/result/proof.f.ts`, and
  `fjs/types/function/compare/proof.f.ts` migrate to `proof.f.mjs` under
  the stage-1 TypeScript-to-mjs migration; no other module imports a proof
  file, so this is not a breaking change
  [#1480](https://github.com/functionalscript/functionalscript/pull/1480)
- **BREAKING CHANGES:** `fjs/text/utf8`, `fjs/text` (top module), and
  `fjs/types/uint8array` migrate from authored TypeScript (`.f.ts`) to
  JSDoc-typed JavaScript (`.f.mjs`) under the stage-1 TypeScript-to-mjs
  migration — importers must use the `.f.mjs` specifier
  [#1480](https://github.com/functionalscript/functionalscript/pull/1480)
- **BREAKING CHANGES:** `fjs/ci/config`, `fjs/text/ascii`, and `fjs/fsc`
  migrate from authored TypeScript (`.f.ts`) to JSDoc-typed JavaScript
  (`.f.mjs`) under the stage-1 TypeScript-to-mjs migration — importers
  must use the `.f.mjs` specifier
  [#1479](https://github.com/functionalscript/functionalscript/pull/1479)
- **BREAKING CHANGES:** `fjs/types/patricia_trie`, `fjs/types/sorted_list`,
  `fjs/types/range_map`, `fjs/types/range_set`, `fjs/crypto/pow`,
  `fjs/types/bigfloat`, `fjs/types/prime_field`, and `fjs/crypto/secp`
  migrate from authored TypeScript (`.f.ts`) to JSDoc-typed JavaScript
  (`.f.mjs`) under the stage-1 TypeScript-to-mjs migration — importers
  must use the `.f.mjs` specifier
  [#1478](https://github.com/functionalscript/functionalscript/pull/1478)
- **BREAKING CHANGES:** `fjs/types/number` and `fjs/types/nibble_set` migrate
  from authored TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`)
  under the stage-1 TypeScript-to-mjs migration — importers must use the
  `.f.mjs` specifier
  [#1477](https://github.com/functionalscript/functionalscript/pull/1477)
- **BREAKING CHANGES:** `fjs/types/map` migrates from authored TypeScript
  (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`) under the stage-1
  TypeScript-to-mjs migration — importers must use the `.f.mjs` specifier
  [#1476](https://github.com/functionalscript/functionalscript/pull/1476)
- **BREAKING CHANGES:** `fjs/types/btree` migrates from authored TypeScript
  (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`) under the stage-1
  TypeScript-to-mjs migration — importers must use the `.f.mjs` specifier
  [#1475](https://github.com/functionalscript/functionalscript/pull/1475)
- **BREAKING CHANGES:** `fjs/crypto/sha2` migrates from authored TypeScript
  (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`) under the stage-1
  TypeScript-to-mjs migration — importers must use the `.f.mjs` specifier
  [#1472](https://github.com/functionalscript/functionalscript/pull/1472)
- **BREAKING CHANGES:** `fjs/types/btree/set` and `fjs/types/btree/remove`
  migrate from authored TypeScript (`.f.ts`) to JSDoc-typed JavaScript
  (`.f.mjs`) under the stage-1 TypeScript-to-mjs migration — importers must use
  the `.f.mjs` specifier
  [#1471](https://github.com/functionalscript/functionalscript/pull/1471)
- **BREAKING CHANGES:** `fjs/types/btree/find` migrates from authored
  TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`) under the
  stage-1 TypeScript-to-mjs migration — importers must use the `.f.mjs`
  specifier; implementation-only typedefs (`FirstLeaf1`, `FirstBranch3`,
  `FirstLeaf2`, `FirstBranch5`, `PathItem3`, `PathItem5`) are renamed to
  their private `_`-prefixed forms
  [#1470](https://github.com/functionalscript/functionalscript/pull/1470)
- **BREAKING CHANGES:** `fjs/types/btree/types` migrates from authored
  TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`) under the
  stage-1 TypeScript-to-mjs migration — importers must use the `.f.mjs`
  specifier
  [#1469](https://github.com/functionalscript/functionalscript/pull/1469)
- **BREAKING CHANGES:** `fjs/text/utf16` migrates from authored TypeScript
  (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`) under the stage-1
  TypeScript-to-mjs migration — importers must use the `.f.mjs` specifier;
  implementation-only typedefs in `fjs/bnf/data` are renamed to their private
  `_`-prefixed forms to match the established convention
  [#1468](https://github.com/functionalscript/functionalscript/pull/1468)
- **BREAKING CHANGES:** `fjs/types/range` and `fjs/text/code_point` migrate from
  authored TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`) under the
  stage-1 TypeScript-to-mjs migration — importers must use the `.f.mjs`
  specifier
  [#1464](https://github.com/functionalscript/functionalscript/pull/1464)
- **BREAKING CHANGES:** `fjs/basen`, `fjs/basen/base64`, and `fjs/basen/cbase32`
  migrate from authored TypeScript (`.f.ts`) to JSDoc-typed JavaScript
  (`.f.mjs`) under the stage-1 TypeScript-to-mjs migration — importers must use
  the `.f.mjs` specifier
  [#1464](https://github.com/functionalscript/functionalscript/pull/1464)
- **BREAKING CHANGES:** the `fjs/base_n` module moves to `fjs/basen`, next to the
  encodings built on it — importers must use the `fjs/basen/module.f.mjs`
  specifier
  [#1464](https://github.com/functionalscript/functionalscript/pull/1464)
- **BREAKING CHANGES:** `fjs/asn.1` migrates from authored TypeScript (`.f.ts`)
  to JSDoc-typed JavaScript (`.f.mjs`) under the stage-1 TypeScript-to-mjs
  migration — importers must use the `.f.mjs` specifier
  [#1464](https://github.com/functionalscript/functionalscript/pull/1464)
- **BREAKING CHANGES:** `fjs/basen/base128` migrates from authored TypeScript
  (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`) under the stage-1
  TypeScript-to-mjs migration — importers must use the `.f.mjs` specifier
  [#1463](https://github.com/functionalscript/functionalscript/pull/1463)
-  **BREAKING CHANGES:** Implementation-only JSDoc typedefs in the migrated
  `fjs/types/array` and `fjs/types/bit_vec` modules are renamed to their private
  `_`-prefixed forms. Public declarations keep the same expanded types
  [#1462](https://github.com/functionalscript/functionalscript/pull/1462)
- **BREAKING CHANGES:** `fjs/types/bit_vec` migrates from authored TypeScript
  (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`) under the stage-1
  TypeScript-to-mjs migration — importers must use the `.f.mjs` specifier
  [#1460](https://github.com/functionalscript/functionalscript/pull/1460)
- **BREAKING CHANGES:** `fjs/types/list`, `fjs/types/result`,
  `fjs/common/monoid`, `fjs/types/bigint`, and `fjs/types/nominal` migrate from
  authored TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`) under the
  stage-1 TypeScript-to-mjs migration — importers must use the `.f.mjs`
  specifier
  [#1458](https://github.com/functionalscript/functionalscript/pull/1458)
- **BREAKING CHANGES:** `fjs/types/function/compare` and
  `fjs/types/function/operator` migrate from authored TypeScript (`.f.ts`) to
  JSDoc-typed JavaScript (`.f.mjs`) under the stage-1 TypeScript-to-mjs
  migration — importers must use the `.f.mjs` specifier
  [#1456](https://github.com/functionalscript/functionalscript/pull/1456)
- **BREAKING CHANGES:** `fjs/types/array`, `fjs/types/function`,
  `fjs/types/nullable`, and `fjs/types/option` migrate from authored
  TypeScript (`.f.ts`) to JSDoc-typed JavaScript (`.f.mjs`) under the stage-1
  TypeScript-to-mjs migration — importers must use the `.f.mjs` specifier;
  `fjs/types/array`'s fixed-arity type exports (`Array1`..`Array16`,
  `Index1`..`Index16`, `Tuple2`, `Tuple3`, `isArray2`) are replaced by the
  generic `Tuple<N, T>`, `Index<N>`, and `isTuple(n)`
  [#1454](https://github.com/functionalscript/functionalscript/pull/1454)
- `ci`: generated workflows invoke the CLI by full command name (`fjs test`,
  `functionalscript@<version> test`) instead of the `t` alias
  [#1450](https://github.com/functionalscript/functionalscript/pull/1450)

## 0.43.1

- `vnd.fjs.revision` gains optional flat subject-to-content lock maps; Evo
  validates and canonicalizes their hashes, and revision JSON is serialized
  canonically for stable CAS addresses [#1447](https://github.com/functionalscript/functionalscript/pull/1447)

## 0.43.0

- **BREAKING CHANGES:** `fjs/types/object`: `StringMap<T>` takes one type
  argument, the open-key-set record; a finite key set is `RequiredMap<K, T>` or
  `OptionalMap<K, T>`. `Map<T>` is removed — it was `StringMap<T>`
  [#1442](https://github.com/functionalscript/functionalscript/pull/1442)

## 0.42.0

- `fjs/media/json`: `stringSerialize` escapes in FunctionalScript instead of
  calling the host's `JSON.stringify`, matching it exactly down to `\uXXXX` for
  unpaired surrogates; `fjs/text/utf16` gains `codePointToString`
  [#1438](https://github.com/functionalscript/functionalscript/pull/1438)
- `fjs/djs`: the parser no longer spends a call-stack frame per container —
  the same lazy `drop(1)` pop that #1435 fixed in `fjs/media/json`
  [#1436](https://github.com/functionalscript/functionalscript/pull/1436)
- `fjs/media/json`: `parse` no longer overflows the call stack on documents
  with ~5000 or more sibling containers; the parser stack is popped eagerly
  instead of through a lazy `drop(1)` chain
  [#1435](https://github.com/functionalscript/functionalscript/pull/1435)
- **BREAKING CHANGES:** `fjs/media/json` no longer exports `parseNative`. Parse
  JSON with the total `parse` — `unwrap(parse(text))` — and narrow the result
  with an rtti schema instead of an `as` cast
  [#1433](https://github.com/functionalscript/functionalscript/pull/1433)
- `nanvm-lib`: add native-JS multiplication proofs matching the Rust coercion
  cases [#1429](https://github.com/functionalscript/functionalscript/pull/1429)
- **BREAKING CHANGES:** `fjs/media` `detect` takes the dialects to recognize —
  `detect(dialects)(bytes)`. `dialectEntry(schema, extraValidate?)` builds an
  entry, `fjs/media/revision` exports `revisionDialect`, and no dialect is
  hardcoded any more
  [#1428](https://github.com/functionalscript/functionalscript/pull/1428)
- **BREAKING CHANGES:** `fjs/media/json` `parse` is now the total
  `(text: string) => Result<Unknown, string>` built on this module's own
  tokenizer and parser; the throwing `JSON.parse` export is renamed
  `parseNative`
  [#1428](https://github.com/functionalscript/functionalscript/pull/1428)
- Test and coverage tooling recognizes authored `.f.mjs` FunctionalScript
  modules: proof discovery loads them, and `npm run cov`, `deno task cov`, and
  the generated Deno CI step include `module.f.mjs` alongside `module.f.ts`
  [#1422](https://github.com/functionalscript/functionalscript/pull/1422)

## 0.41.0

- `fjs/effects`: `match` resolves a command's handler with an own-property
  lookup, so a `command` naming an `Object.prototype` member (`constructor`,
  `toString`, …) throws instead of dispatching to the inherited function
  [#1421](https://github.com/functionalscript/functionalscript/pull/1421)
- **BREAKING CHANGES:** `Evo.list` and the `evo_list` MCP tool take an optional
  `archived?: true` filter and list active subjects by default — those with at
  least one current head that is not archived — instead of every subject
  [#1415](https://github.com/functionalscript/functionalscript/pull/1415)

## 0.40.0

- **BREAKING CHANGES:** remove the Playwright integration, which ran proofs in a
  Node worker rather than in a browser: no `@playwright/test` dependency, no
  `playwright` CI job, engine, test context, or scenario runner
  [#1414](https://github.com/functionalscript/functionalscript/pull/1414)
- **BREAKING CHANGES:** `fjs/bnf/descent`: match results are now the record
  `{ ast, success, idx, failure? }` instead of a tuple. `failure` is present only
  on a failed match and holds the furthest position a terminal was rejected at
  plus the terminals expected there — a failed result's own index rewinds and
  cannot locate an error
  [#1412](https://github.com/functionalscript/functionalscript/pull/1412)
- **BREAKING CHANGES:** `@playwright/test` moves to `1.59.1` to match the pinned
  Nixpkgs snapshot, which now provides the `playwright` CI job's browsers — the
  job runs in a generated Nix flake instead of installing them
  [#1409](https://github.com/functionalscript/functionalscript/pull/1409)
- `fjs/ci`: generate one self-contained `nix/generated/<job>/flake.nix` per
  canonical Node job, pinning an exact Nixpkgs commit; `npm run ci-update`
  writes them without running Nix
  [#1398](https://github.com/functionalscript/functionalscript/pull/1398)
- **BREAKING CHANGES:** `range_map`'s exported `get` and `fromRange` take the
  map/default-value first and the queried number/range last. Add
  `fjs/types/range_set`, a boolean-valued `range_map` wrapper
  [#1402](https://github.com/functionalscript/functionalscript/pull/1402)
- **BREAKING CHANGES:** decouple the FJS MCP server from CAS: generic MCP
  moves `fjs/mcp/` → `fjs/protocol/mcp/`, JSON-RPC moves
  `fjs/media/json/rpc/` → `fjs/protocol/json_rpc/`, and the CAS tool registry
  moves `fjs/cas/mcp/` → `fjs/mcp/cas/` (with `fjs/cas/evo/mcp/` →
  `fjs/mcp/evo/`); the server's new composition root lives at `fjs/mcp/`
  [#1401](https://github.com/functionalscript/functionalscript/pull/1401)
- `fjs/media/nix`: add a minimal checked Nix eDSL and deterministic chunk serializer
  [#1397](https://github.com/functionalscript/functionalscript/pull/1397)
- `fjs/effects/node`: **BREAKING CHANGES:** detect Deno as the new `'deno'`
  `Engine` variant and make external tests on Node 22–25 use the inline
  `expectFailure` compatibility strategy
  [#1393](https://github.com/functionalscript/functionalscript/pull/1393)
- `package.json`: drop `npm-check-updates` from `npm run update` entirely — it
  now only reinstalls/relocks; `package.json` devDependency bumps are manual
  for now
  [#1392](https://github.com/functionalscript/functionalscript/pull/1392)
- `package.json`: pin `@playwright/test` exactly (`=1.62.0`) and exclude it from
  `npm run update`'s `npm-check-updates` pass, so the pinned test runner version
  survives routine dependency updates
  [#1391](https://github.com/functionalscript/functionalscript/pull/1391)

## 0.39.0

- `fjs/cas/evo`: **BREAKING CHANGES:** add `revision(hash)` and the
  `evo_revision` MCP tool — one revision, decoded, validated, and with hashes
  canonicalized. `AddRevision` is renamed `RevisionData` and gains an optional
  `generation` field, so a read value can be added back unchanged
  [#1379](https://github.com/functionalscript/functionalscript/pull/1379)
- `fjs/effects`: add `mapStep` and the matching `Eff.map` — the functor map of
  the effect monad, for the `step(e, x => pure(f(x)))` idiom. Neither widens the
  operation set, since a pure projection issues no commands
  [#1374](https://github.com/functionalscript/functionalscript/pull/1374)
- `fjs/effects`: **BREAKING CHANGES:** make `foldStep` and `forEachStep` step
  variants — `foldStep(items, init, f)` / `forEachStep(items, f)`, with `items`
  an `Effect<O, List<T>>`, so the effect leads as in `step` and `historyStep`
  [#1373](https://github.com/functionalscript/functionalscript/pull/1373)
- `fjs/types/list`: add `tryFold` and the `Accumulator<I, T, R>` type, the
  `try*`/`Nullable` sibling of `fold`; `bit_vec`'s early-exit fold driver moves
  onto it [#1370](https://github.com/functionalscript/functionalscript/pull/1370)
- `fjs/effects`: **BREAKING CHANGES:** give `Do<O, T>` named fields —
  `{ command, payload, continuation }` replaces the numeric keys `0` / `1` / `2`
  [#1368](https://github.com/functionalscript/functionalscript/pull/1368)
- `fjs/effects`: **BREAKING CHANGES:** remove `decode` and `Decoded<O, T>`;
  `typeof e === 'function'` already discriminates. Add
  `runPure<O, T>(e): Option<T>` for callers that only want a pure effect's value
  [#1368](https://github.com/functionalscript/functionalscript/pull/1368)
- `fjs/effects`: **BREAKING CHANGES:** replace `Frame<R, P>` / `frameStep` with
  `History<O, H>`, `history`, and `historyStep` — a flat, newest-first tuple
  instead of a nested chain, so `historyStep` composes at any depth
  [#1367](https://github.com/functionalscript/functionalscript/pull/1367)
- `fjs/effects`: **BREAKING CHANGES:** remove the `lazy` constructor — `Pure`'s
  thunk is a discriminator, not a suspension, so `lazy` was the identity
  function. Use `pure(v)`, or a `Do` node for work deferred to a runner
  [#1360](https://github.com/functionalscript/functionalscript/pull/1360)
- `fjs/effects/eff`: `Eff.step(f)` now also passes every prior value in the
  chain to `f`, most recent first (`f(t, ...history)`), via a new `P` type
  parameter on `Eff<O, T, P>` that accumulates one element per `.step` call
  [#1360](https://github.com/functionalscript/functionalscript/pull/1360)
- `fjs/effects`: add `frameStep` and `Frame<R, P>` — `frameStep` captures the
  call it makes as `{ result, param }` instead of discarding the parameter
  [#1361](https://github.com/functionalscript/functionalscript/pull/1361)
- `fjs/effects`: **BREAKING CHANGE:** an `Effect<O, T>` is now the raw value — a
  `Pure` thunk or a `Do` node — instead of a `{ value, step }` wrapper.
  Composition moves to the external `step(e, f)`; `eff(value)` is added for
  method chaining
  [#1354](https://github.com/functionalscript/functionalscript/pull/1354)
- `fjs/ci`: **BREAKING CHANGE:** drop the trailing `git reset --hard && git
  clean -fdx` step from the generated jobs (a no-op on ephemeral runners) and
  remove the `clean` helper from `fjs/ci/common/module.f.ts`
  [#1353](https://github.com/functionalscript/functionalscript/pull/1353)
- `fjs/ci`: generated CI guards against stale committed generated files — the
  Node 26 job runs `npm run ci-update` after `npm ci` and fails when the
  committed tree no longer matches the generator's output
  [#1346](https://github.com/functionalscript/functionalscript/pull/1346)

## 0.38.0

- `fs/` → `fjs/`: **BREAKING CHANGE:** rename the top-level source directory, so
  every published import path changes (`functionalscript/fs/…` →
  `functionalscript/fjs/…`). `fs` collided with Node's built-in `fs` module
  [#1316](https://github.com/functionalscript/functionalscript/pull/1316)
- `fs/media/revision`, `fs/cas/evo`: **BREAKING CHANGES:** make `snapshot` and
  `generation` required in `revisionSchema`, so a revision blob is interpretable
  in isolation; `addRevision` now resolves and writes both fields explicitly
  [#1314](https://github.com/functionalscript/functionalscript/pull/1314)
- `fs/types/range`, `fs/bnf`: **BREAKING CHANGE:** `contains(a, b)` takes two
  positional arguments instead of a `Range` tuple; `eof` becomes
  `oneEncode(mask)`, and the redundant `max` constant is removed
  [#1308](https://github.com/functionalscript/functionalscript/pull/1308)
- `bnf/descent`: fix `RangeError: Maximum call stack size exceeded` on
  realistic-size input — the matcher is now an explicit-stack machine with
  unchanged semantics and O(1) JS call-stack depth
  [#1303](https://github.com/functionalscript/functionalscript/pull/1303)
- `types/uint8array`: `listToVec` now throws the descriptive
  `"the array is too big"` on overflow instead of a generic `assert` failure,
  matching its sibling `toVec`
  [#1286](https://github.com/functionalscript/functionalscript/pull/1286)

## 0.37.0

- `fs/media/revision`: add the `vnd.fjs.revision` dialect — a BLOB format for
  one step in the evolution of a mutable object over the immutable CAS store.
  Pure format only, wired into `fs/media`'s `detect` and `cas_get`
  [#1265](https://github.com/functionalscript/functionalscript/pull/1265)
- `text/utf8`: dedup the lead-byte classifier in `utf8ByteToCodePointOp` — both
  dispatch copies become one `restart(prefix)` helper. Pure refactor
  [#1258](https://github.com/functionalscript/functionalscript/pull/1258)
- `fs/`: **BREAKING CHANGE:** regroup top-level directories by concern —
  `base64`/`base128`/`cbase32` → `fs/basen/`, `types/monoid` → `fs/common/`,
  `json`/`html` → `fs/media/`, and the `fjs` CLI moves to the package root
  [#1251](https://github.com/functionalscript/functionalscript/pull/1251)
- `cas/mcp`: **BREAKING CHANGE:** align the `cas_get` response with the MCP
  resource-contents shape — `mime_type` → `mimeType`, `url` → `uri`, and the
  inline payload moves from `content` to `text` / `blob`
  [#1248](https://github.com/functionalscript/functionalscript/pull/1248)
- `nanvm-lib`: fix `BigInt` `Sub` returning the wrong sign when both operands
  share a sign and `|lhs| < |rhs|` — `Add` and `Sub` now share one
  `add_signed` dispatch parameterized by the effective right-hand sign
  [#1220](https://github.com/functionalscript/functionalscript/pull/1220)

## 0.36.0

- `cas/mcp`: **BREAKING CHANGE:** remove `type:'url'` from `cas_add` — no
  purely-TypeScript check closes every symlink/TOCTOU variant on a
  client-supplied path. Large content goes through the `cas` CLI instead
  [#1236](https://github.com/functionalscript/functionalscript/pull/1236)
- `fsc`: use `assertEq` instead of a hand-written `if/throw` in a proof case —
  an inline `if/throw` is itself a permanently-uncovered branch. Documented as
  an `AGENTS.md` testing rule
  [#1234](https://github.com/functionalscript/functionalscript/pull/1234)
- `base64`: fix `encode` silently producing a string for an over-`maxLength`
  vector — the explicit padding step is dropped, since `baseN`'s `vecToString`
  already left-pads a trailing partial chunk
  [#1229](https://github.com/functionalscript/functionalscript/pull/1229)
- `fs/effects`: add the `okStep` / `mapOk` step adapters — collapses the
  hand-written "error passes through, ok continues" check that recurred at five
  `Effect<O, IoResult<T>>` call sites
  [#1228](https://github.com/functionalscript/functionalscript/pull/1228)
- `js/tokenizer`: reject unescaped control characters in string literals, as
  RFC 8259 §7 requires — fixed once in the shared scanner, so `fs/json`,
  `fs/djs`, and `fs/js` all match `JSON.parse`
  [#1218](https://github.com/functionalscript/functionalscript/pull/1218)
- `path`: export `isProperPrefix` from `fs/path/module.f.ts` — moves the pure
  segment-based containment predicate out of the virtual FS `rename` handler
  [#1210](https://github.com/functionalscript/functionalscript/pull/1210)

## 0.35.2

- `crypto/sha2`: fix `append`'s O(n²) block-extraction loop — rewritten as a
  fold over `chunkList`, with the config-invariant partial applications hoisted.
  A 320,000-byte input drops from 3444 ms to 116 ms
  [#1203](https://github.com/functionalscript/functionalscript/pull/1203)

## 0.35.1

- `base_n`: fix `vecToString`'s O(n²) blowup on large inputs (used by
  `base64.encode` and `cbase32`) — a balanced recursive split replaces the
  per-chunk `popFront`, giving true O(n log n)
  [#1202](https://github.com/functionalscript/functionalscript/pull/1202)

## 0.35.0

- `mcp/stdio`: bound the internal-error fallback — a caller-controlled `id` can
  push even the `-32603` response past `maxLength`, so `writeResponse` retries
  once more with a fixed `id: null`
  [#1201](https://github.com/functionalscript/functionalscript/pull/1201)
- `cas/mcp`: `cas_add` now returns a clean `isError` result instead of crashing
  the server when inline content is malformed or exceeds the 128 KiB limit
  [#1198](https://github.com/functionalscript/functionalscript/pull/1198)
- `README`: update Getting Started for the full `fjs` CLI (`test`, `compile`,
  `run`, `cas`, `mcp`, `ci`); add CAS and MCP Server sections
  [#1198](https://github.com/functionalscript/functionalscript/pull/1198)
- `text`: add `tryUtf8`, the `Nullable`-returning sibling of `utf8` — reports
  `null` instead of throwing when a string's UTF-8 encoding would exceed
  `maxLength`; `utf8` is derived from it
  [#1196](https://github.com/functionalscript/functionalscript/pull/1196)
- `types/bit_vec` / `base64`: enforce `maxLength` when folding a list into a
  `Vec`; add `tryU8ListToVec`, plus `unwrap` / `mapUnwrap` in `types/nullable`
  to derive each throwing variant from its `try*` counterpart
  [#1195](https://github.com/functionalscript/functionalscript/pull/1195)
- `types/bit_vec` / `base_n`: make many-into-one bit-vector concatenation
  O(n log n) — the binary-counter accumulator is extracted into a shared
  `unpackListToVec`, used by `listToVec`, `u8ListToVec`, and `stringToVec`
  [#1192](https://github.com/functionalscript/functionalscript/pull/1192)

## 0.34.0

- `text` / `mime`: separate text-ness from well-formedness in the detector — new
  `isTextCodePoint` excludes control characters, so valid-but-control blobs are
  no longer mislabelled as `text/plain`
  [#1183](https://github.com/functionalscript/functionalscript/pull/1183)
- **BREAKING CHANGES:** `text`: move the Unicode code-point predicates into
  `fs/text/code_point/module.f.ts`; `isValidCodePoint` is no longer exported
  from `fs/text/utf8/module.f.ts`
  [#1182](https://github.com/functionalscript/functionalscript/pull/1182)
- `cas/mcp`: make metadata-only `cas_get` size-independent — the read stream is
  folded through the new `fs/mime` `detectStream` state machine instead of being
  drained into one `Vec`
  [#1181](https://github.com/functionalscript/functionalscript/pull/1181)
- **BREAKING CHANGE:** `bnf`: split the backends out of `fs/bnf/data`, leaving it
  as the pure serializable IR — LL(1) moves to `fs/bnf/ll1` and recursive descent
  to `fs/bnf/descent`
  [#1179](https://github.com/functionalscript/functionalscript/pull/1179)
- `cas`: extract `casAddFile` — streams a file through `cas.write()` and returns
  the content hash; the CLI `cas add` and MCP `cas_add` both delegate to it
  [#1158](https://github.com/functionalscript/functionalscript/pull/1158)
- `cas`: move the CLI command handlers into `fs/cas/cli/module.f.ts`, mirroring
  `fs/cas/mcp/`; `fs/cas/module.f.ts` keeps only shared types and primitives
  [#1157](https://github.com/functionalscript/functionalscript/pull/1157)
- `fs/html`: replace `escapeCharCode`'s four-arm `switch` with an `escapeTable`
  lookup and a single fallback — the escape set is now data
  [#1145](https://github.com/functionalscript/functionalscript/pull/1145)
- `cas`: reimplement `casUpload` on top of `fileCas.write()`, inheriting lease
  GC, dedup-on-publish, and `stat` size verification; the source is deleted only
  after a successful write
  [#1153](https://github.com/functionalscript/functionalscript/pull/1153)
- `cas`: implement the lock-free staging upload — `fileCas.write` streams each
  chunk to a leased `_stage/` file while hashing, then publishes by `rename`.
  Adds the `createExclusive`, `writeBytes`, and `stat` effects
  [#1149](https://github.com/functionalscript/functionalscript/pull/1149)

## 0.33.0

- Remove `kvStore`
  [#1143](https://github.com/functionalscript/functionalscript/pull/1143)
- `types/bigint`: drop the power-of-two `divUpE2` / `roundUpE2` helpers —
  `divUp8` / `roundUp8` are now derived from `divUp(8n)` / `roundUp(8n)`
  [#1131](https://github.com/functionalscript/functionalscript/pull/1131)
- `effects/node/virtual`: change the `Entity` file type from `Vec` to
  `readonly Vec[]` so the virtual filesystem can store files larger than
  `maxLengthBytes` as chunks
  [#1130](https://github.com/functionalscript/functionalscript/pull/1130)

## 0.32.4

- `cas`: add `cas upload <fileName>` — a streaming move-hash-move pipeline that
  hashes in 128 KiB chunks without loading the file into memory, then renames
  the staged file to its sharded CAS location
  [#1127](https://github.com/functionalscript/functionalscript/pull/1127)

## 0.32.3

- `cas/mcp`: temporary fix for large files — `cas_get` no longer crashes on
  files larger than `readFile`'s size limit
  [#1124](https://github.com/functionalscript/functionalscript/pull/1124)
- `fs/cas/mcp`: clearer setup instructions for Claude CLI and Codex in the
  README [#1123](https://github.com/functionalscript/functionalscript/pull/1123)

## 0.32.2

- `cas/mcp`: restrict `cas_add` with `type: 'url'` to paths under
  `~/cas_upload/`, rejecting `..` — MCP clients can no longer exfiltrate
  arbitrary files
  [#1122](https://github.com/functionalscript/functionalscript/pull/1122)

## 0.32.1

- `effects/node`: limit `ReadFile` to Bun's `bigint` size constraint
  (131,072 bytes) for cross-runtime compatibility; add `maxLength` and
  `maxLengthBytes` constants
  [#1121](https://github.com/functionalscript/functionalscript/pull/1121)
- `mcp`: extract the declarative tool-registry pattern into reusable builders
  (`ToolEntry`, `toolEntry`, `fromRegistry`, `errorResult`), removing ~100 lines
  of dispatch boilerplate per MCP server
  [#1119](https://github.com/functionalscript/functionalscript/pull/1119)
- `cas/mcp`: refactor tool definitions from a hardcoded array plus `switch` to a
  data-driven registry, so adding a tool is additive
  [#1118](https://github.com/functionalscript/functionalscript/pull/1118)

## 0.32.0

- **BREAKING CHANGE:** the MCP server as a top-level CLI command
  [#1115](https://github.com/functionalscript/functionalscript/pull/1115)

## 0.31.1

- `effects/node`: normalize the home directory path on Windows using `toPosix`,
  so `home` always uses forward slashes
  [#1108](https://github.com/functionalscript/functionalscript/pull/1108)

## 0.31.0

- `cas/mcp`: unify `cas_add`/`cas_add_url` and `cas_get`/`cas_get_meta` into
  three tools — `cas_add` gains `type:'url'`, `cas_get` gains `content?:
  boolean` and always returns metadata
  [#1106](https://github.com/functionalscript/functionalscript/pull/1106)
- `cas/mcp`: add `cas_add_url` and `cas_get_meta` to avoid token-heavy binary
  transfers; `casMcpHandlers` accepts an optional `toUrl` resolver
  [#1102](https://github.com/functionalscript/functionalscript/pull/1102)
- `cas/mcp`: smart text/binary encoding — `cas_add` accepts an optional `type`
  (`'text'` default or `'base64'`); `cas_get` returns
  `{ content, type, mime_type }` after two-phase MIME detection
  [#1104](https://github.com/functionalscript/functionalscript/pull/1104)
- `base_n`: extract a shared `Vec ↔ string` bit-codec factory,
  `baseN(bits, alphabet, normalize?)`, and rewrite `base64` and `cbase32`
  through it while each keeps its own padding
  [#1097](https://github.com/functionalscript/functionalscript/pull/1097)
- `cli`: `Command.handler` now also accepts a nested `Commands` array, and
  `dispatch` recurses into it — subcommand groups such as `fjs cas mcp` need no
  custom dispatch
  [#1093](https://github.com/functionalscript/functionalscript/pull/1093)
- `cas/mcp`: switch content encoding to standard RFC 4648 base64; hashes stay
  cBase32 for canonical identity
  [#1081](https://github.com/functionalscript/functionalscript/pull/1081)
- `json`: `stringify` now skips object properties with `undefined` values,
  matching `JSON.stringify`
  [#1080](https://github.com/functionalscript/functionalscript/pull/1080)
- `base64`: add `fs/base64/module.f.ts` with RFC 4648 `encode` / `decode` for
  byte-aligned `Vec` values, returning `null` on malformed input
  [#1079](https://github.com/functionalscript/functionalscript/pull/1079)
- `mcp`: add a stdio transport for JSON-RPC / MCP servers — `stdioTransport`
  drives the read→parse→dispatch→write loop as a recursive effect over a new
  byte-level `read` effect
  [#1072](https://github.com/functionalscript/functionalscript/pull/1072)
- `json/parser`: reject trailing commas, matching strict `JSON.parse` (it
  previously accepted `[1,]` and `{"a":1,}`)
  [#1072](https://github.com/functionalscript/functionalscript/pull/1072)
- `html`: replace the four raw hex code points in `escapeCharCode` with the
  named constants from `fs/text/ascii`. Pure refactor
  [#1064](https://github.com/functionalscript/functionalscript/pull/1064)
- `djs/serializer`: hoist the "value is referenced more than once" predicate into
  a single module-scope `sharedRef(refs)(v)` helper. Pure refactor
  [#1057](https://github.com/functionalscript/functionalscript/pull/1057)
- `types/object`: introduce `StringMap<K, T>` — one conditional type covering
  both infinite and finite key sets — plus `definedEntries`; applied across 17
  sites in 11 files
  [#1055](https://github.com/functionalscript/functionalscript/pull/1055)
- `effects/node`: add `readUtf8File` / `writeUtf8File` next to the
  `readFile` / `writeFile` effects, and migrate the open-coded UTF-8 sandwiches
  in `djs/transpiler`, `djs`, and `ci`
  [#1052](https://github.com/functionalscript/functionalscript/pull/1052)
- `effects/node`: drop the private `Io` indirection from the node effect runner
  — the handler table is inlined into a module-level `asyncRun`. Pure refactor
  [#1051](https://github.com/functionalscript/functionalscript/pull/1051)
- `fjs`: add a `proof.f.ts` covering the CLI command handlers via the virtual
  Node-effect interpreter
  [#1047](https://github.com/functionalscript/functionalscript/pull/1047)
- `effects/node/virtual`: add proofs for the `await` handler, the `fetch`
  not-found branch, and the `import_` invalid-path branch
  [#1046](https://github.com/functionalscript/functionalscript/pull/1046)
- `asn.1`: extract a private generic `decodeAll<T>(step)` and rewrite
  `decodeObjectIdentifier` and `decodeSequence` through it. Pure refactor
  [#1041](https://github.com/functionalscript/functionalscript/pull/1041)
- `types/bigfloat`: factor the abs/sign/`multiply` envelope of `round53` and
  `decToBin` into a private `withSign` combinator. Pure refactor
  [#1022](https://github.com/functionalscript/functionalscript/pull/1022)
- `types/bigfloat`: collapse the `increaseMantissa` / `decreaseMantissa` mirror
  into a single `normalizeMantissa` factory. Pure refactor
  [#1021](https://github.com/functionalscript/functionalscript/pull/1021)
- `text/utf8`: define the UTF-8 tag/payload-mask constants and the
  `contByte` / `contPayload` helpers once at module scope. Pure refactor
  [#1020](https://github.com/functionalscript/functionalscript/pull/1020)
- `types/bigint`: export `divUp8` / `roundUp8` (bits → bytes, rounding up) and
  reuse them in `crypto/sign` and `asn.1`
  [#1018](https://github.com/functionalscript/functionalscript/pull/1018)
- `types/sorted_list`: export `intersect` and `dropTail`; `types/sorted_set`
  delegates `intersect` to them, mirroring `union`
  [#1017](https://github.com/functionalscript/functionalscript/pull/1017)
- `cas`: drop the private 2-char `split` helper and reuse `splitAt(2)` from
  `fs/types/string` for the shard path
  [#1014](https://github.com/functionalscript/functionalscript/pull/1014)
- `types/bigint`: add shift-based `divUpE2(e)` / `roundUpE2(e)`, retype
  `divUp` / `roundUp`, and migrate `asn.1` and `crypto/sign` onto them
  [#1012](https://github.com/functionalscript/functionalscript/pull/1012)
- `effects/memory`: add typed `create` / `read` / `write` memory operations, a
  `Map`-backed Node interpreter, and virtual-memory composition
  [#1008](https://github.com/functionalscript/functionalscript/pull/1008)
- `json/rpc`: add JSON-RPC spec links to the JSDoc and destructure the
  `decodeRequest` result in `dispatch`
  [#1002](https://github.com/functionalscript/functionalscript/pull/1002)

## 0.30.0

- `ci`: **BREAKING CHANGE:** split generated workflows into lightweight platform
  jobs and canonical Ubuntu ARM jobs, set read-only workflow permissions, and
  expand Rust checks to release tests and release Clippy
  [#997](https://github.com/functionalscript/functionalscript/pull/997)

## 0.29.1

- `package`: relax the npm `engines.node` requirement from `>=24` to `>=22`
  [#987](https://github.com/functionalscript/functionalscript/pull/987)
- `types/prime_field`: make `quadRes(0n)` return `true`, compute Euler's
  exponent from `p - 1`, and document the `p === 2n` behavior
  [#986](https://github.com/functionalscript/functionalscript/pull/986)

## 0.29.0

- add `bun.lock` and `deno.lock` to source control and pin exact devDependency
  versions, so CI installs are reproducible via `--frozen`
  [#985](https://github.com/functionalscript/functionalscript/pull/985)

## 0.28.0

- abandon JSR publishing: remove `deno.json`, `fs/dev/index/`, `fs/dev/version/`,
  the `index` script, and every `deno publish` step
  [#984](https://github.com/functionalscript/functionalscript/pull/984)

## 0.26.0

- `fjs`: add `fjs ci` / `fjs i` as first-class commands for the standard CI
  workflow generator
  [#975](https://github.com/functionalscript/functionalscript/pull/975)
- `cli`: change `Command<O>.handler` to take `NodeProgramOptions` instead of
  `readonly string[]`; `dispatch` forwards the full options with `args` trimmed
  [#973](https://github.com/functionalscript/functionalscript/pull/973)
- `fjs`: `fjs r` now looks up `main` instead of `default` on the imported module
  [#972](https://github.com/functionalscript/functionalscript/pull/972)
- `cli`: add `fs/cli/module.f.ts` — `Command` / `Commands` types and a `dispatch`
  function with auto-generated help; replaces the `switch`-based dispatch in
  `fjs` and `cas`
  [#971](https://github.com/functionalscript/functionalscript/pull/971)

## 0.25.0

- `ci`: auto-detect Rust by checking for `Cargo.toml` at the repo root, removing
  the manual `rust: boolean` flag from `Setup`
  [#969](https://github.com/functionalscript/functionalscript/pull/969)
- `ci`: split `npm test` into explicit steps (`npx tsc`, `npm test`,
  `node --test`, `npm run cov`); add the `cov` script and remove `fst`
  [#969](https://github.com/functionalscript/functionalscript/pull/969)
- `bnf`: hoist the `commaJoin0Plus` delimited-list combinator into
  `fs/bnf/module.f.ts` and collapse three byte-identical local copies onto it
  [#964](https://github.com/functionalscript/functionalscript/pull/964)
- `types/rtti/ts`: add `README.md` documenting the TS2589 depth-overflow problem
  for recursive `Ts<T>`, the `any` fast-path and `WithOut` solutions, and the
  three remaining `as any` casts
  [#961](https://github.com/functionalscript/functionalscript/pull/961)
- `types/rtti/ts`: use a unique symbol key for `WithOut`'s phantom field instead
  of the string `$out`, so `WithOut<Struct, Out>` is valid for any `Out`
  [#960](https://github.com/functionalscript/functionalscript/pull/960)
- `types/rtti/ts`: add the `WithOut<S, Out>` phantom type and `$out` branch to
  `Ts<T>` — a pre-computed output type short-circuits the schema walk, fixing
  TS2589 for recursive struct schemas
  [#959](https://github.com/functionalscript/functionalscript/pull/959)
- `json/schema`: redesign the `unknown` rtti schema using `WithOut`, splitting it
  into `unknownConst` and `unknownThunk` so `Ts<typeof unknown>` is the single
  source of truth
  [#959](https://github.com/functionalscript/functionalscript/pull/959)
- `types/rtti`: remove unnecessary `as any` from all `verror` / `prependPath`
  returns in `validate`, `parse`, and `common`; document the root cause of the
  remaining casts
  [#959](https://github.com/functionalscript/functionalscript/pull/959)
- `json/schema`: add `toJsonSchema(rtti)` — converts any rtti `Type` to a JSON
  Schema draft 2020-12 object
  [#957](https://github.com/functionalscript/functionalscript/pull/957)
- `crypto/sha2`: collapse `bigSigma` / `smallSigma` into one `sigma(third)`
  factory parameterised by the third XOR operand. No API change
  [#954](https://github.com/functionalscript/functionalscript/pull/954)
- `json/rpc`: add a pure JSON-RPC 2.0 layer — rtti schemas for the envelopes, a
  `decodeRequest` decoder, and a pure `dispatch(handlers)(value)`
  [#950](https://github.com/functionalscript/functionalscript/pull/950)
- `json`: add rtti schemas (`primitive`, `unknown`, `object`, `array`) and derive
  `Primitive` and `Unknown` from them via `Ts<>`
  [#950](https://github.com/functionalscript/functionalscript/pull/950)
- `types/rtti`: decouple rtti from djs — `Primitive`, `Unknown`, `Array`, and
  `Object` are now defined locally
  [#950](https://github.com/functionalscript/functionalscript/pull/950)
- `types/rtti/ts`: `Ts<T>` fast-path — `unknown extends T ? Unknown`
  short-circuits when `T` is `any`, preventing TS2589 distribution
  [#950](https://github.com/functionalscript/functionalscript/pull/950)
- `crypto/vdf`: add a Sloth verifiable delay function over a fixed 3072-bit safe
  prime; extends `types/prime_field` with `reduce` / `quadRes` and a standalone
  `modSqrt` helper
  [#937](https://github.com/functionalscript/functionalscript/pull/937)

## 0.24.0

- **breaking** `effects`: hoist `fs/types/effects` → `fs/effects` and fold
  `fs/io` into `fs/effects/node/module.ts`; callers use the runner's `run(p)` /
  `runEffect(p)` entry points
  [#943](https://github.com/functionalscript/functionalscript/pull/943)
- **breaking** `emergent_testing`: remove `fs/emergent_testing/module.ts`; the
  external-runner entry is now the self-contained
  `fs/emergent_testing/all.test.ts`
  [#943](https://github.com/functionalscript/functionalscript/pull/943)

## 0.23.0

- **breaking** `io`: encapsulate `io` behind the entry points — `effectRun` is
  renamed to `run`, and the new `runEffect(p)` resolves the exit code without
  calling `process.exit`
  [#942](https://github.com/functionalscript/functionalscript/pull/942)
- **breaking** `function/compare`: add generic `min` / `max` next to `cmp` and
  retire the duplicated pairs in `function/operator` and `types/bigint`
  [#940](https://github.com/functionalscript/functionalscript/pull/940)

## 0.22.0

- **breaking** `emergent_testing`: rename `fs/emergent-testing` →
  `fs/emergent_testing`, matching the snake_case module-naming convention
  [#924](https://github.com/functionalscript/functionalscript/pull/924)
- `asserts`: add the missing `./fs/asserts/module.f.ts` entry to `deno.json`
  exports [#924](https://github.com/functionalscript/functionalscript/pull/924)

## 0.21.0

- **breaking** `tf`: rename `fs/dev/tf` → `fs/emergent-testing`; the public
  exports and the external-runner entry import change accordingly
  [#923](https://github.com/functionalscript/functionalscript/pull/923)
- `asserts`: extract `assert`, `assertEq`, `todo`, and `Assert<T>` from
  `fs/dev/module.f.ts` into a standalone `fs/asserts/module.f.ts`
  [#923](https://github.com/functionalscript/functionalscript/pull/923)
- `types/nullable`: add `fromUndefined(v)` — names the JS-host ↔
  FunctionalScript `undefined`→`null` boundary in one helper
  [#919](https://github.com/functionalscript/functionalscript/pull/919)
- `effects/node`: add `errorExit(s)` — the canonical "write an error line to
  stderr, yield exit code 1" `NodeOp` program; replaces seven inline copies
  [#917](https://github.com/functionalscript/functionalscript/pull/917)

## 0.20.0

- `tf`: widen the load gate to all `.f.ts`/`.f.js` plus vanilla
  `proof.{ts,js,mts,mjs}`; `v.proof !== undefined` is the sole gate, enabling
  co-located white-box proofs
  [#893](https://github.com/functionalscript/functionalscript/pull/893)
- `tf`: discover proofs by an exported `proof` property instead of
  `Module.default`; convert all 81 proof files
  [#889](https://github.com/functionalscript/functionalscript/pull/889)
- `text`: extract the shared streaming code-point decoder skeleton and the
  `errorMask` constant from `utf8`/`utf16` into a new `fs/text/code_point`
  [#860](https://github.com/functionalscript/functionalscript/pull/860)
- DJS serializer: factor out `buildSerialize(refLookup)` so both serializers
  share the value→string core, and remove the in-place mutation from `addRef`
  and the ref-counter flag
  [#832](https://github.com/functionalscript/functionalscript/pull/832)
- `effects`: add the `foldStep` / `forEachStep` combinators — sequential
  state-threading and void-accumulator siblings of `all`
  [#885](https://github.com/functionalscript/functionalscript/pull/885)
- `tf`: rename all `test.f.ts` / `test.f.js` → `proof.f.ts` / `proof.f.js`
  (80 files) [#883](https://github.com/functionalscript/functionalscript/pull/883)
- `tf`: fix `sandbox` timing accuracy — `p instanceof Promise ? await p : p`
  instead of the `awaitPromise` boxing handler, so spurious microtasks no longer
  inflate durations
  [#883](https://github.com/functionalscript/functionalscript/pull/883)
- `tf`: async test function support — `registerModule` and `sandbox` now await
  async test functions; adds the `Await` effect type and `awaitPromise`
  [#882](https://github.com/functionalscript/functionalscript/pull/882)
- `io`: `effectRun` now calls `process.exit` internally, fixing `fjs t` always
  exiting 0 regardless of test failures
  [#882](https://github.com/functionalscript/functionalscript/pull/882)
- `tf`: move `isTest` to `dev/module.f.ts`, consolidating the predicate used by
  both `loadFile` and `runModuleMap`
  [#882](https://github.com/functionalscript/functionalscript/pull/882)
- `tf`: prefix scenario temporary files with `_` so git ignores them, and add
  `fjs` as a scenario runner alongside node/bun/deno/playwright
  [#882](https://github.com/functionalscript/functionalscript/pull/882)
- `io`: extract the `wrapInlineTest(register)` factory shared by
  `bunTestContext` and `playwrightTestContext`. Behaviour-preserving
  [#880](https://github.com/functionalscript/functionalscript/pull/880)

## 0.19.0

- `tf`: drop Node 22 — remove `--experimental-strip-types`, bump
  `engines.node` to `>=24`, add `.node-version`, remove the `node22` CI job
  [#872](https://github.com/functionalscript/functionalscript/pull/872)
- `tf`: restore the Playwright bridge as `playwrightTestContext`, detected via
  the `PLAYWRIGHT_TEST` environment variable
  [#872](https://github.com/functionalscript/functionalscript/pull/872)
- `tf`: add the `Engine` type, `bunTestContext`, `inlineTest`, and
  `inlineContext` — fixes Bun's `ERR_NOT_IMPLEMENTED` on nested `t.test()`
  [#872](https://github.com/functionalscript/functionalscript/pull/872)
- `tf`: add scenario tests in `fs/dev/tf/scenarios/` with a `run.sh` covering
  node/bun/deno/playwright
  [#872](https://github.com/functionalscript/functionalscript/pull/872)
- `tf`: add `registerModule`, `registerModuleMap`, and `register` — a pure
  Effects layer for registering tests with external frameworks
  [#872](https://github.com/functionalscript/functionalscript/pull/872)
- `bit_vec`: make list concatenation a `BitOrder` member (`order.listToVec`) and
  drop the free `listToVec` factory
  [#865](https://github.com/functionalscript/functionalscript/pull/865)

## 0.18.0

- `rtti`: `parse` now mirrors `validate`'s container factories, and the shared
  container guards and types move into the `common` kernel
  [#853](https://github.com/functionalscript/functionalscript/pull/853)
- `tf`: add the `fmtImport` output format (`import("./f.ts").path()`), `null`
  call markers in paths, `file` on `Reporter.pass`, and relative module keys
  [#851](https://github.com/functionalscript/functionalscript/pull/851)
- `tf`: `Reporter.test` owns execution; `parseTestSet` is uncurried and
  `defaultTest` exported; `Sandbox` drops out of the `runModuleMap` constraints
  [#844](https://github.com/functionalscript/functionalscript/pull/844)
- `types`: extract the shared `bsearch` helper used by `sorted_list.find` and
  `range_map.get`, and move the curried `Cmp<T>` alias to `function/compare`
  [#845](https://github.com/functionalscript/functionalscript/pull/845)
- `tf`: export `runModuleMap` and add the experimental `run2` in `module.ts`
  [#843](https://github.com/functionalscript/functionalscript/pull/843)
- `tf`: extract `runModule` / `runModuleMap`, flatten the `walk` signature, and
  filter before reduce
  [#842](https://github.com/functionalscript/functionalscript/pull/842)
- `tf`: virtual tests via `JsModule` plus a pass-through `sandbox`; `Reporter<O>`
  and `Program<O>` become generic
  [#840](https://github.com/functionalscript/functionalscript/pull/840)
- Effects: Node: Virtual: new file type — `JsModule`
  [#834](https://github.com/functionalscript/functionalscript/pull/834)
- `tf`: extract the `Reporter` interface; `test` takes a `Reporter` and returns a
  `NodeProgram`, moving the `isGitHub` branching out of the walker
  [#831](https://github.com/functionalscript/functionalscript/pull/831)
- `fjs`: convert `main` to `NodeProgram`, dispatching sub-commands by returning
  Effects directly and dropping the `Io` dependency
  [#830](https://github.com/functionalscript/functionalscript/pull/830)
- `tf`: convert `main` to `NodeProgram` — replaces the `Io` dependency with
  `loadModuleMap2`, the `sandbox` effect, and `csiWrite`
  [#828](https://github.com/functionalscript/functionalscript/pull/828)
- `tf`: eliminate the double `sandbox` call for throw-tests; `parseTestSet`
  returns `TestEntry = { fn, throws }`. Adds the no-type-predicate rule to
  `AGENTS.md` [#827](https://github.com/functionalscript/functionalscript/pull/827)
- `uint8array`: mark the module deprecated — use `utf8` / `utf8ToString` from
  `fs/text` and `bit_vec` directly
  [#823](https://github.com/functionalscript/functionalscript/pull/823)
- `tf`: remove the unused `anyLog` helper
  [#823](https://github.com/functionalscript/functionalscript/pull/823)
- Effects: retire the `Log` / `Error` / `Console` operation types; `log` and
  `error` are now helpers built on `write`
  [#822](https://github.com/functionalscript/functionalscript/pull/822)
- Effects: add the `Write` effect (`write(stream, data)`) and `WriteConsoles` to
  `NodeOp`; add `std` to `NodeProgramOptions` and `csiWrite` to `fs/text/sgr`
  [#816](https://github.com/functionalscript/functionalscript/pull/816)
- IO: add `write(stream, data)` to `Io` with backpressure via `stream.write()`
  plus `once(stream, 'drain')`
  [#821](https://github.com/functionalscript/functionalscript/pull/821)

## 0.17.0

- Effects: replace `NodeProgram`'s two positional parameters with
  `NodeProgramOptions` — `{ args, env }`
  [#814](https://github.com/functionalscript/functionalscript/pull/814)
- `tf`: remove the `Input` intermediary type; `test` takes `Io` directly
  [#813](https://github.com/functionalscript/functionalscript/pull/813)
- `fjs`: convert the `run`/`r` command from `asyncImport`/`await` to the
  `import_` effect
  [#812](https://github.com/functionalscript/functionalscript/pull/812)
- DJS transpiler: replace `Fs`/`readFileSync` with the `ReadFile` effect; tests
  use the virtual effect runner and `fs/io/virtual` is deleted
  [#811](https://github.com/functionalscript/functionalscript/pull/811)
- IO: expose `sandbox` on the `Io` interface; the test framework replaces
  `measure` + `tryCatch` with it, eliminating state threading
  [#809](https://github.com/functionalscript/functionalscript/pull/809)
- Effects: add the `sandbox` operation — runs a sync function with try/catch and
  `performance.now()` timing in one atomic operation
  [#808](https://github.com/functionalscript/functionalscript/pull/808)
- Docs: add the required JSDoc `@module` header to every `module.f.ts` that was
  missing one [#804](https://github.com/functionalscript/functionalscript/pull/804)

## 0.16.1

- Effects: add the `now` operation returning epoch nanoseconds as `bigint`; the
  virtual runner exposes `epochNs` for deterministic tests
  [#803](https://github.com/functionalscript/functionalscript/pull/803)

## 0.16.0

- RTTI `Ts<>`: optional field inference; CI derives `Step` / `Job` /
  `GitHubAction` from RTTI schemas
  [#798](https://github.com/functionalscript/functionalscript/pull/798)
- RTTI: extract the shared kernel (error shape, primitive checks, `match`
  recognizer) from `validate`/`parse` into a new `rtti/common` module
  [#797](https://github.com/functionalscript/functionalscript/pull/797)
- NodeProgram: move `Env` to `fs/types/effects/node` and add it as the second
  parameter [#795](https://github.com/functionalscript/functionalscript/pull/795)

## 0.15.0

- Effects: unify `do_`/`doRest` and `Func`/`RestFunc` into a single
  rest-parameter form; operation payload types are now uniformly tuples
  [#794](https://github.com/functionalscript/functionalscript/pull/794)
- Test framework: parse non-default exports, so a test file can spread its tests
  across multiple named exports
  [#790](https://github.com/functionalscript/functionalscript/pull/790)

## 0.14.1

- CI: add a `ci(rust: boolean)` function to conditionally include Rust steps
  [#780](https://github.com/functionalscript/functionalscript/pull/780)
- RTTI: fix `NaN` handling in const validation by using `Object.is` instead of
  `===` [#777](https://github.com/functionalscript/functionalscript/pull/777)

## 0.14.0

- Restructure [#773](https://github.com/functionalscript/functionalscript/pull/773)
- Test framework: detect pass-on-throw tests by the enclosing `throw` key,
  supporting function references and grouped tests
  [#769](https://github.com/functionalscript/functionalscript/pull/769)
- CI: centralize tool versions, split into per-tool modules, add a Playwright
  browser cache [#764](https://github.com/functionalscript/functionalscript/pull/764)
- Refactor `StateScan` to swap the input and state parameter order
  [#763](https://github.com/functionalscript/functionalscript/pull/763)
- SUL: first three levels. BitVec: chunking functions
  [#757](https://github.com/functionalscript/functionalscript/pull/757)
- RTTI: parse (deserializer)
  [#760](https://github.com/functionalscript/functionalscript/pull/760)

## 0.13.0

- RTTI: `print(mut?: true)`
  [#754](https://github.com/functionalscript/functionalscript/pull/754)

## 0.12.9

- RTTI: TS: generating simple TypeScript definitions from RTTI
  [#751](https://github.com/functionalscript/functionalscript/pull/751)
- Io: improve `exec`
  [#752](https://github.com/functionalscript/functionalscript/pull/752)

## 0.12.8

- Effects: exec: stdin
  [#750](https://github.com/functionalscript/functionalscript/pull/750)

## 0.12.7

- bitVec: `chunkList()`
  [#749](https://github.com/functionalscript/functionalscript/pull/749)

## 0.12.6

- Effects: Exec [#748](https://github.com/functionalscript/functionalscript/pull/748)

## 0.12.5

- Effects: Rm [#747](https://github.com/functionalscript/functionalscript/pull/747)

## 0.12.2

- RTTI: Or [#737](https://github.com/functionalscript/functionalscript/pull/737)

## 0.12.1

- RTTI: type simplification for TypeScript
  [#736](https://github.com/functionalscript/functionalscript/pull/736)

## 0.12.0

- RTTI: new design
  [#734](https://github.com/functionalscript/functionalscript/pull/734)

## 0.11.11

- RTTI: the first version
  [#733](https://github.com/functionalscript/functionalscript/pull/733)

## 0.11.10

- BitVec: improve `u8ListToVec`
  [#732](https://github.com/functionalscript/functionalscript/pull/732)

## 0.11.9

- BitVec: another significant performance improvement for `u8List`
  [#731](https://github.com/functionalscript/functionalscript/pull/731)
- BitVec: `BitOrder.cmp`
  [#729](https://github.com/functionalscript/functionalscript/pull/729)

## 0.11.8

- BitVec: improve performance of `u8List`
  [#728](https://github.com/functionalscript/functionalscript/pull/728)

## 0.11.7

- BitVec: improve performance of `u8ListToVec`
  [#727](https://github.com/functionalscript/functionalscript/pull/727)

## 0.11.6

- Effects: HTTP: `createServer`: a universal request listener
  [#726](https://github.com/functionalscript/functionalscript/pull/726)

## 0.11.5

- Effects: the `forever` command
  [#725](https://github.com/functionalscript/functionalscript/pull/725)

## 0.11.4

- Effects: `createServer`: `IncomingMessage` and `ServerResponse`
  [#724](https://github.com/functionalscript/functionalscript/pull/724)

## 0.11.3

- Effects: HTTPS: `listen`
  [#722](https://github.com/functionalscript/functionalscript/pull/722)

## 0.11.2

- Effects: HTTPS: `createServer` and `listen`
  [#716](https://github.com/functionalscript/functionalscript/pull/716)

## 0.11.1

- Effects: the `both` function
  [#710](https://github.com/functionalscript/functionalscript/pull/710)

## 0.11.0

- Effects: refactoring: fluent native, operation set
  [#708](https://github.com/functionalscript/functionalscript/pull/708)
- Effects: bug: `all` should return `Effect<..., readonly T[]>`
  [#707](https://github.com/functionalscript/functionalscript/pull/707)
- Effects: generic `all`
  [#704](https://github.com/functionalscript/functionalscript/pull/704)

## 0.10.3

- Effects: no more `map`s
  [#699](https://github.com/functionalscript/functionalscript/pull/699)

## 0.10.2

- Effects: a new simplified `Effect` type, plus a `fluent` object for fluent
  programming [#698](https://github.com/functionalscript/functionalscript/pull/698)

## 0.10.1

- FJS: running Node programs
  [#696](https://github.com/functionalscript/functionalscript/pull/696)

## 0.10.0

- IO: effects by default
  [#695](https://github.com/functionalscript/functionalscript/pull/695)
- CI: cache for Playwright
  [#691](https://github.com/functionalscript/functionalscript/pull/691)
- Add module-level JSDoc headers across many modules
  [#690](https://github.com/functionalscript/functionalscript/pull/690)

## 0.9.3

- Base128: bug fix
  [#688](https://github.com/functionalscript/functionalscript/pull/688)
- Effect: `fetch` [#684](https://github.com/functionalscript/functionalscript/pull/684)
- ASN.1: unsupported tags. New module: Base128
  [#682](https://github.com/functionalscript/functionalscript/pull/682)
- ASN.1: integer, boolean, sequence, set
  [#679](https://github.com/functionalscript/functionalscript/pull/679)
- ASN.1: basic encoding/decoding
  [#678](https://github.com/functionalscript/functionalscript/pull/678)

## 0.9.2

- Effect: Node: add `Dirent` to the `readdir` result
  [#676](https://github.com/functionalscript/functionalscript/pull/676)
- Effect: move `IO` related functions to `./io`
  [#675](https://github.com/functionalscript/functionalscript/pull/675)
- Effect: remove one type parameter from operations
  [#674](https://github.com/functionalscript/functionalscript/pull/674)
- CAS: read/write/list implementation
  [#673](https://github.com/functionalscript/functionalscript/pull/673)
- Effect: `readdir` without the recursive flag
  [#671](https://github.com/functionalscript/functionalscript/pull/671)
- Connect IO and Effect
  [#670](https://github.com/functionalscript/functionalscript/pull/670)
- Effect: generating the website using Effects
  [#666](https://github.com/functionalscript/functionalscript/pull/666)
- Effect: Node: stderr
  [#665](https://github.com/functionalscript/functionalscript/pull/665)
- Effect: `flatMap` => `pipe`
  [#664](https://github.com/functionalscript/functionalscript/pull/664)
- Effect: Node: `readdir`
  [#663](https://github.com/functionalscript/functionalscript/pull/663)
- Effect: Mock [#658](https://github.com/functionalscript/functionalscript/pull/658)
- Effect: `map` and `flatMap`
  [#657](https://github.com/functionalscript/functionalscript/pull/657)
- Effect: bind [#656](https://github.com/functionalscript/functionalscript/pull/656)
- Effect: `do_` and other helpers
  [#654](https://github.com/functionalscript/functionalscript/pull/654)

## 0.9.0

- Replace legacy `fsc`/`fst` usage with the `fjs` CLI
  [#619](https://github.com/functionalscript/functionalscript/pull/619)
- Add the `fjs` CLI
  [#618](https://github.com/functionalscript/functionalscript/pull/618)
- Move the prime field module from `crypto/` to `types/`
  [#602](https://github.com/functionalscript/functionalscript/pull/602)
- Digital signatures
  [#599](https://github.com/functionalscript/functionalscript/pull/599)

## 0.8.1

- 64-bit SHA2 padding is fixed
  [#595](https://github.com/functionalscript/functionalscript/pull/595)
- A compact version of Bit Vector
  [#575](https://github.com/functionalscript/functionalscript/pull/575)
- Running tests in browsers
  [#572](https://github.com/functionalscript/functionalscript/pull/572)
- Generating a GitHub CI file
  [#569](https://github.com/functionalscript/functionalscript/pull/569)
- New `Nominal` type that prohibits `<` operations in TypeScript
  [#567](https://github.com/functionalscript/functionalscript/pull/567)

## 0.8.0

- Switch to the MIT License
  [#557](https://github.com/functionalscript/functionalscript/pull/557),
  [#559](https://github.com/functionalscript/functionalscript/pull/559)

## 0.7.0

- New automatic test runner for `Node.js`, `Deno`, and `Bun`
  [#518](https://github.com/functionalscript/functionalscript/pull/518)

## 0.6.11

- Support for Deno Test and Coverage

## 0.6.10

- Trailing comma and identifier properties
  [#484](https://github.com/functionalscript/functionalscript/pull/484)
- Property names as identifiers
  [#466](https://github.com/functionalscript/functionalscript/pull/466)
- Add the file name and symbol position to parser and transpiler errors
  [#493](https://github.com/functionalscript/functionalscript/pull/493)

## 0.6.9

- Import, const, comments, `undefined`, and `bigint`

## 0.6.8

- `fsc` can serialize as tree
  [#442](https://github.com/functionalscript/functionalscript/pull/442)

## 0.6.7

- `fsc` can parse json
  [#434](https://github.com/functionalscript/functionalscript/pull/434)

## 0.6.2

- Tests can run from a directory
  [#425](https://github.com/functionalscript/functionalscript/pull/425)

## 0.6.0

- The FunctionalScript JSR package includes `module.ts` files
  [#423](https://github.com/functionalscript/functionalscript/pull/423)
- Dropped support for Node 16, Node 18 and Deno 1

## 0.5.0

- `fsc` added as an executable into the npm package
  [#396](https://github.com/functionalscript/functionalscript/pull/396)

## 0.4.3

- Implementation of HMAC
  [#371](https://github.com/functionalscript/functionalscript/pull/371)

## 0.4.2

- Faster `types/big_int/log2` algorithm for WebKit (Bun and Safari)
  [#368](https://github.com/functionalscript/functionalscript/pull/368)

## 0.4.1

- Faster `types/big_int/log2` algorithm
  [#365](https://github.com/functionalscript/functionalscript/pull/365)

## 0.4.0

- COM and CommonJS modules are retired
  [#367](https://github.com/functionalscript/functionalscript/pull/367)

## 0.3.13

- First LL(1) parser
  [#356](https://github.com/functionalscript/functionalscript/pull/356)

## 0.3.12

- BNF types and the `RangeMapOp` interface
  [#355](https://github.com/functionalscript/functionalscript/pull/355)

## 0.3.9

- Improved `types/bigint/log2` algorithm
  [#346](https://github.com/functionalscript/functionalscript/pull/346)

## 0.3.8

- SHA2 that works on bit vectors
  [#345](https://github.com/functionalscript/functionalscript/pull/345)

## 0.3.7

- Monoid [#343](https://github.com/functionalscript/functionalscript/pull/343)

## 0.3.6

- Export `html.Node`
  [#342](https://github.com/functionalscript/functionalscript/pull/342)

## 0.3.5

- Fix for Node <= v20
  [#341](https://github.com/functionalscript/functionalscript/pull/341)
- A main module
  [#340](https://github.com/functionalscript/functionalscript/pull/340)

## 0.3.0

- Switching to TypeScript file
  [#330](https://github.com/functionalscript/functionalscript/pull/330)
- DJS: add serializer
  [#326](https://github.com/functionalscript/functionalscript/pull/326)

## 0.2.6

- Refactoring of a vector of bits
  [#328](https://github.com/functionalscript/functionalscript/pull/328)

## 0.2.5

- New `crypto/` directory
  [#327](https://github.com/functionalscript/functionalscript/pull/327)
- Simplified HTML
  [#327](https://github.com/functionalscript/functionalscript/pull/327)
- djs: add `undefined` and comments
  [#325](https://github.com/functionalscript/functionalscript/pull/325)

## 0.2.3

- BitVec and documentation update
  [#322](https://github.com/functionalscript/functionalscript/pull/322)

## 0.1.608
