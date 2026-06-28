# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## 0.34.0

- `text` / `mime`: separate *text-ness* from *well-formedness* in the `fs/mime` detector. Adds `isTextCodePoint` to `fs/text/code_point/module.f.ts` beside the existing shared code-point predicates — a code point is text unless it is a control character (C0 `U+0000`–`U+001F`, `U+007F` DEL, and C1 `U+0080`–`U+009F`), minus the whitespace block `U+0009`–`U+000D` (TAB, LF, VT, FF, CR). The detector's UTF-8 factor now tracks a text verdict via `isTextCodePoint`, kept distinct from the `isValidCodePoint` validity check, and `finish` classifies `text`/`text/plain` only when the blob is valid UTF-8 **and** every code point is a text code point; valid-but-control blobs (NUL and other controls) fall through to `base64`/`application/octet-stream`. Fixes metadata-only `cas_get` mislabelling control-bearing binary (e.g. a NUL run) as text. `isValidCodePoint` and `fromVec` are unchanged (text-vs-binary-control-bytes)
- **BREAKING CHANGES:** `text`: move the Unicode code-point classification predicates (`isBmpCodePoint`, `isHighSurrogate`, `isLowSurrogate`, `isSupplementaryPlane`, `isValidCodePoint`) into `fs/text/code_point/module.f.ts`, the shared home for `errorMask` and `decoder`, derived from one set of boundary constants so the surrogate bounds and `0x10FFFF` appear exactly once; `utf8` and `utf16` import them instead of redefining their own range checks. `isValidCodePoint` is no longer exported from `fs/text/utf8/module.f.ts` — importers (e.g. `fs/mime`) must take it from `fs/text/code_point/module.f.ts`; adds `code_point/proof.f.ts` with full branch coverage (share-code-point-predicates) PR [#1182](https://github.com/functionalscript/functionalscript/pull/1182)
- `cas/mcp`: make metadata-only `cas_get` size-independent — fold the read stream through a new `fs/mime` `detectStream` byte-accepting state machine (running length × magic-byte signature eliminator × UTF-8 validity DFA) instead of draining the blob into one `Vec`, so `content:false` on a blob larger than one 128 KiB read chunk now returns `{ length, mime_type, type, url? }` instead of an error; `collectRead` is confined to the `content:true` transfer path (still bounded by `maxLength`), which now classifies its buffered blob with the same machine via `detectVec` rather than a parallel `detect` + UTF-8 check, so the three-way verdict has a single implementation; `fs/mime` gains `detectStream` / `detectVec` / `push` / `finish` / `detectInit` beside the pure `detect`; README and JSDoc updated to note the inspect-vs-transfer split (cas-get-large-files) PR [#1181](https://github.com/functionalscript/functionalscript/pull/1181)
- BREAKING CHANGE: `bnf`: split the parser/automaton backends out of `fs/bnf/data`, leaving that module as the pure serializable IR (`RuleSet` + `toData`). The LL(1) dispatch/matcher (`dispatchMap`, `parser`, `parserRuleSet`, and the dispatch/AST types) moves to `fs/bnf/ll1`; the recursive descent matcher (`descentParser`, `createEmptyTagMap`, and the metadata-aware AST types) moves to `fs/bnf/descent`. Importers must update their paths — e.g. `descentParser` now comes from `fs/bnf/descent` instead of `fs/bnf/data`. Each backend is a sibling built over the data IR so new backends (recognizer, dfa) can land the same way; tests are split per module and `fs/djs/tokenizer-new` updated to the new import (recognizer-backend.md) PR [#1179](https://github.com/functionalscript/functionalscript/pull/1179)
- `cas`: extract `casAddFile<O>(cas: Cas<O>)(path: string): Effect<O, IoResult<Vec>>` — streams the file at `path` through `cas.write()` and returns the content hash; CLI `cas add` and MCP `cas_add type:'url'` both delegate to it, with the MCP layer adding an explicit `rm(path)` on success; upgrades the CLI from `readFile` (128 KiB cap) to streaming; simplifies `casUpload` to wrap `casAddFile` + delete (casAddFile) PR [#1158](https://github.com/functionalscript/functionalscript/pull/1158)
- `cas`: move CLI command handlers (`commands`, `main`) from `fs/cas/module.f.ts` into a new `fs/cas/cli/module.f.ts`, mirroring the existing `fs/cas/mcp/` layout; `fs/cas/module.f.ts` now contains only shared types and primitives; `fs/fjs/module.f.ts` and `fs/cas/proof.f.ts` updated to import from the new location (Move CAS CLI logic to `fs/cas/cli`) PR [#1157](https://github.com/functionalscript/functionalscript/pull/1157)
- `fs/html`: replace `escapeCharCode`'s four-arm `switch` with a code-point keyed `escapeTable` lookup and a single `?? fromCharCode(code)` pass-through fallback; behaviour is unchanged but the escape set is now data, separated from the fallback policy (i66N-html-escape-table) [#1145](https://github.com/functionalscript/functionalscript/pull/1145)
- `cas`: reimplement `casUpload` on top of `fileCas.write()` — replaces the bespoke move-hash-move staging pipeline with a thin wrapper that streams the source file through `cas.write()`, inheriting lease GC, lease renewal, dedup-on-publish, and `stat` size verification for free; the source is deleted only after a successful write so a failed upload leaves it intact for retry; extracts a generic `streamFile` helper from `fileCas.read`'s chunk loop; updates `casMcpHandlers` / `casMcpServer` effect signatures from the old `Mkdir|Rename|RandomInt|ReadBytes|Now` to `FileCasOperation`; adds `casUploadSuccess` and `casUploadFailureKeepsSource` proofs (i66P-cas-upload-via-write) PR [#1153](https://github.com/functionalscript/functionalscript/pull/1153)
- `cas`: implement the lock-free staging upload (Step 3, staging-lease.md). `fileCas.write` now streams each chunk straight to a `.cas/_stage/<deadline>-<random256>` staging file via the new `writeBytes` effect while hashing incrementally, renews the deadline lease per chunk, fails closed (`rm` the partial file) on any error, and publishes to the hash-derived shard with a replace-`rename` confirmed by a `stat` size check; expired staging files are garbage-collected lazily at the start of each write. Adds path-based effects `createExclusive` (`O_CREAT|O_EXCL`), `writeBytes` (pwrite the whole `Vec` at a byte offset, never creating), and `stat` (`{ size }`) to `fs/effects/node`, implemented in the Node and virtual runners. Migrates `casUpload` to stage under `_stage/` with a `<deadline>-<random256>` name (dropping the old `.stage/` path) so its orphans share the same lease GC. New proof tests cover multi-chunk streaming, dedup, mid-stream abort, and GC reclamation (cas plan Step 3) PR [#1149](https://github.com/functionalscript/functionalscript/pull/1149)

## 0.33.0

- Remove `kvStore` PR [#1143](https://github.com/functionalscript/functionalscript/pull/1143)
- `types/bigint`: drop the power-of-two `divUpE2` / `roundUpE2` helpers — they had no consumers beyond their own proofs and the `divUp8` / `roundUp8` factories; `divUp8` and `roundUp8` are now derived from `divUp(8n)` / `roundUp(8n)` directly; JSDoc on `divUp8` / `roundUp8` records the non-negative-input domain (the floor-vs-truncate distinction is the only place the two forms diverge); proofs updated to keep 100% coverage (i66D-bigint-roundup-factory) [#1131](https://github.com/functionalscript/functionalscript/pull/1131)
- `effects/node/virtual`: change `Entity` file type from `Vec` to `readonly Vec[]` so the virtual filesystem can store files larger than `maxLengthBytes` (128 KiB) as an array of chunks; `readBytes` now reads across chunk boundaries; `writeFile` wraps payloads in `[payload]`; `readFile` concatenates chunks up to the 128 KiB cap; the `operation` traversal helper is fixed to not recurse into `Vec[]` arrays as directories; all related proof fixtures updated; two new proof tests verify chunk-boundary reads and large-file access (i66K-virtual-large-file-support) PR [#1130](https://github.com/functionalscript/functionalscript/pull/1130)

## 0.32.4

- `cas`: add `cas upload <fileName>` command implementing a streaming move-hash-move pipeline for files of any size — moves the source from `~/cas_upload/<name>` to a randomized staging path `~/.cas/.stage/<rnd256>-<name>`, stream-hashes it in `maxLengthBytes` (128 KiB) chunks via `readBytes` without loading the whole file into memory, then renames the staged file to its final sharded CAS location and prints the CBase32 hash; `random256` helper composes 8 × `randomInt` (32-bit) calls into a 256-bit `Vec` for collision-resistant staging names; `streamHash` is a generic chunk-loop parameterised on any `Sha2` implementation; adds proof tests for the happy path, upload-then-get roundtrip, wrong-args error, and missing-source-file error (i66J-cas-large-file-support), PR [#1127](https://github.com/functionalscript/functionalscript/pull/1127)

## 0.32.3

- `cas/mcp`: add temporary fix for large file handling — `cas_get` no longer crashes when encountering files larger than `readFile`'s size limit; issue created with proposal for proper `'toobig'` error handling in `readFile` (i66J-cas-readfile-size-limit) [#1124](https://github.com/functionalscript/functionalscript/pull/1124)
- `fs/cas/mcp`: improve documentation with clearer setup instructions for Claude CLI and Codex, explaining that `npx functionalscript m` automatically downloads the latest version on startup [#1123](https://github.com/functionalscript/functionalscript/pull/1123)

## 0.32.2

- `cas/mcp`: restrict `cas_add` with `type: 'url'` to paths within `~/cas_upload/` directory — reject any path not starting with `~/cas_upload/` or containing `..` to prevent arbitrary file read and path traversal attacks; MCP clients can no longer exfiltrate sensitive files via `cas_add({ type: 'url', content: '/etc/passwd' })`; add comprehensive proofs for valid paths (approve `~/cas_upload/*`), invalid directories (reject `/tmp/*`), and traversal attempts (reject `~/cas_upload/../../etc/passwd`); future issues track full path normalization for symlink handling (i66J-cas-add-path-restriction, i66J-normalize-home-paths) [#1122](https://github.com/functionalscript/functionalscript/pull/1122)

## 0.32.1

- `effects/node`: enforce cross-runtime compatibility by limiting `ReadFile` to Bun's `bigint` size constraint (1,048,576 bits / 131,072 bytes); add `maxLength` constant to `fs/types/bigint/module.f.ts` (computed as `0x80000n << 1n` = 2^20) and export `maxLengthBytes = maxLength >> 3n` from `fs/types/bit_vec/module.f.ts`; validate file size before reading in Node.js implementation via `stat()` to avoid loading oversized files into memory, and validate vector length in virtual implementation; all existing proofs remain below the limit (i66H-limit-readfile-by-bun-bigint) [#1121](https://github.com/functionalscript/functionalscript/pull/1121)
- `mcp`: extract declarative tool registry pattern into reusable builders for all MCP servers — `ToolEntry<O>` type combines name, description, input schema, and handler; `toolEntry` builder binds an RTTI schema with a type-safe handler that receives pre-validated arguments (typed as `Ts<T>`, no manual casting needed); `fromRegistry` factory generates complete `McpHandlers<O>` with `toolsList` and `toolsCall` dispatcher from a registry; `errorResult` helper exported for consistent error construction; eliminates ~100 lines of boilerplate dispatch logic that was duplicated per MCP server; refactor `cas/mcp` to use `fromRegistry`, reducing implementation from 65+ lines to a single factory call; add comprehensive `fs/mcp/README.md` with pattern guide, type-safety model, examples, and migration guide (i66H-mcp-registry-builder) [#1119](https://github.com/functionalscript/functionalscript/pull/1119)
- `cas/mcp`: refactor tool definitions from imperative (hardcoded array + switch statement) to declarative data-driven approach using a tool registry — each tool entry combines metadata (name, description), input schema, and handler function; `toolsList` and `toolsCall` now use generic dispatch over the registry instead of manual pattern-matching; eliminates the mismatch between `toolsList` signature and `McpHandlers<O>` type; makes adding new tools additive rather than scattered edits; follow-up issue 66H-mcp-registry-builder proposes extracting this pattern into a reusable factory in `fs/mcp` for all MCP servers (i66H-declarative-tool-definitions) [#1118](https://github.com/functionalscript/functionalscript/pull/1118)

## 0.32.0

- BREAKING CHANGE: the MCP server as top-level CLI command. PR [#1115](https://github.com/functionalscript/functionalscript/pull/1115)

## 0.31.1

- `effects/node`: normalize the home directory path on Windows using `toPosix` so `home` always uses forward slashes (`C:/Users/x/` instead of `C:\Users\x\`) [#1108](https://github.com/functionalscript/functionalscript/pull/1108)

## 0.31.0

- `cas/mcp`: unify `cas_add`/`cas_add_url` and `cas_get`/`cas_get_meta` into three tools — `cas_add` gains `type:'url'` so passing a filesystem path as `content` stores the file directly (replaces `cas_add_url`); `cas_get` gains `content?: boolean` and always returns `{ length, mime_type, type, url? }` (metadata + encoding type) so the agent can decide whether to fetch inline content without paying the token cost; pass `content: true` to also get the inline payload; `cas_add_url` and `cas_get_meta` removed (i66H-cas-mcp-unified-get-add) [#1106](https://github.com/functionalscript/functionalscript/pull/1106)
- `cas/mcp`: add `cas_add_url` and `cas_get_meta` tools to avoid token-heavy binary transfers — `cas_add_url { url }` reads a local file directly and stores it returning its cBase32 hash; `cas_get_meta { hash }` returns `{ length, mime_type, url? }` metadata without transferring content, letting the caller decide whether to call `cas_get` or use the path directly; MIME type is inferred via magic-byte sniffing then UTF-8 validation (`text/plain` / `application/octet-stream` fallback); `casMcpHandlers` / `casMcpServer` accept an optional `toUrl` resolver so the filesystem-backed stdio server returns absolute blob paths while memory-backed tests omit `url`; `toPath` exported from `fs/cas/module.f.ts`; `fromVec` added to `fs/text/utf8/module.f.ts` with full proof coverage (i66G-cas-mcp-url-tools) [#1102](https://github.com/functionalscript/functionalscript/pull/1102)
- `cas/mcp`: smart text/binary encoding for `cas_add` / `cas_get` — `cas_add` now accepts an optional `type` field (`'text'` default or `'base64'`); omitting `type` stores `content` as raw UTF-8 bytes so agents can pass plain strings without base64-encoding; `cas_get` now runs two-phase MIME detection (magic-byte sniffing via `fs/mime` `detect`, then UTF-8 validation via `fs/text/utf8` `fromVec`) and returns `{ content, type, mime_type }` JSON in a text block instead of a plain base64 string or `EmbeddedResource`; README and module JSDoc updated to document the new contract (i66G-cas-mcp-text-content) [#1104](https://github.com/functionalscript/functionalscript/pull/1104)
- `base_n`: extract a shared `Vec ↔ string` bit-codec factory used by both `base64` and `cbase32`; new `fs/base_n/module.f.ts` exports `baseN(bits, alphabet, normalize?)` returning `{ vecToString, stringToVec }`; rewrites `base64` encode/decode and `cbase32`'s `vec5xToCBase32` / `cBase32ToVec5x` through it while each format keeps its own padding (RFC 4648 `=` octet-alignment for base64, 1-then-0s stop-bit sentinel for cbase32); clears the YAGNI gate in i039-radix-encoding now that a second real `Vec → string` consumer exists (i66F-base-n-codec-factory) [#1097](https://github.com/functionalscript/functionalscript/pull/1097)
- `cli`: `Command.handler` now accepts a nested `Commands` array in addition to a handler function, enabling subcommand groups without custom dispatch boilerplate; `dispatch` recurses into nested commands transparently so `fjs cas mcp` routes correctly without changes to the top-level dispatcher; `cas` is refactored from a `main` function to a `commands` export and wired in `fjs` via `handler: casCommands`; new `nestedCommands` and `nestedHelp` proofs in `fs/cli/proof.f.ts` (i667-cli-nested-commands) [#1093](https://github.com/functionalscript/functionalscript/pull/1093)
- `cas/mcp`: switch content encoding to standard RFC 4648 base64 (hashes stay cBase32) — `cas_add` accepts base64 `content`, `cas_get` returns base64 `content`; tool descriptions, module JSDoc, and `fs/cas/mcp/README.md` updated to spell out the split (hashes = cBase32 for canonical identity across CLI / on-disk layout, content = base64 for MCP-idiomatic interop); proof fixtures rebuilt with `base64Encode`, `addUnterminatedContentIsError` (a cBase32-specific edge case) replaced with `addBadLengthContentIsError` (i66E-cas-mcp-base64-content) [#1081](https://github.com/functionalscript/functionalscript/pull/1081)
- `json`: `stringify` now skips object properties with `undefined` values, matching `JSON.stringify` behaviour — uses `definedEntries` from `fs/types/object` inside `objectSerialize` instead of raw `Object.entries`; removes the `defined` pre-filter workaround from `fs/mcp/stdio` (i66F-json-stringify-skip-undefined) [#1080](https://github.com/functionalscript/functionalscript/pull/1080)
- `base64`: add `fs/base64/module.f.ts` with RFC 4648 `encode` / `decode` for byte-aligned `Vec` values — `encode` maps a `Vec` whose bit-length is a multiple of 8 to a standard base64 string (`A–Z a–z 0–9 + /`, `=` padding), returns `null` for non-octet inputs; `decode` validates structure, rejects non-zero padding bits (RFC 4648 §3.5), and returns `null` on any malformed input; 100 % line / branch / function coverage (i66E-base64) [#1079](https://github.com/functionalscript/functionalscript/pull/1079)
- `mcp`: add a stdio transport for JSON-RPC / MCP servers. `stdioTransport(step)` drives the read→parse→dispatch→write loop as a recursive effect, fully testable against a mock stdin/stdout via the virtual Node-effect runner with no real process. It reads stdin through a new byte-level `read` effect in `fs/effects/node` (the dual of `write`, `(stream) => number | null`), with `readLine` as a pure combinator over it that accumulates bytes in a cons-list (O(n)) and materializes once at newline/EOF. The loop handles EOF (clean shutdown), notifications (`null` step result → no reply), and malformed input (a JSON-RPC `-32700` parse-error response); responses serialize with `undefined`-valued fields omitted, matching `JSON.stringify`. The Node `read` interpreter consumes `process.stdin` one byte at a time and removes both race listeners after each read (i66E-mcp-stdio-transport) [#1072](https://github.com/functionalscript/functionalscript/pull/1072)
- `json/parser`: reject trailing commas — require a value after `[` / `,` / `:` and a string key after a `,` in an object, so the parser matches strict `JSON.parse` (it previously accepted `[1,]` and `{"a":1,}`); needed so the untrusted MCP stdio wire returns `-32700` for malformed input instead of dispatching it (i66E-mcp-stdio-transport) [#1072](https://github.com/functionalscript/functionalscript/pull/1072)
- `html`: replace the four raw hex code points in `escapeCharCode` (`0x22`, `0x26`, `0x3C`, `0x3E`) with the named `quotationMark` / `ampersand` / `lessThanSign` / `greaterThanSign` constants already exported by `fs/text/ascii/module.f.ts`; brings `html` in line with `fs/js/tokenizer`, `fs/fsc`, and `fs/djs/tokenizer-new`, which already source code-point names from `ascii` — pure refactor, behaviour-identical (i66D-html-escape-ascii-constants) [#1064](https://github.com/functionalscript/functionalscript/pull/1064)
- `djs/serializer`: hoist the "value is referenced more than once" predicate into a single `sharedRef(refs)(v)` helper at module scope; route `getConstants` and `serializeWithConst` through it instead of open-coding `refs.get(v) !== undefined && [1] > 1` with raw tuple indexing at each site — pure refactor, behavior-identical (i66B-djs-serializer-shared-ref-predicate) [#1057](https://github.com/functionalscript/functionalscript/pull/1057)
- `types/object`: introduce `StringMap<K, T>` — a single conditional type that resolves to `{ readonly[k in string]?: T }` for infinite key sets (`string`) and `{ readonly[k in K]: T }` for finite literal-union key sets; add `definedEntries` alongside the existing `definedValues` helper; migrate `Map<T>` to `Map<T> = StringMap<string, T>`; apply across 17 sites in 11 files (`djs`, `djs/ast`, `json/serializer`, `bnf`, `html`, `fsm`, `dev`, `effects/node`, `rtti`, `rtti/common`, `rtti/validate`, `rtti/parse`); mutually-recursive types use the inline `{ readonly[k in string]?: T }` form; update downstream callers to use `definedEntries`/`definedValues` and `!` assertions; add compile-time proof assertions (i66C-infinite-record) [#1055](https://github.com/functionalscript/functionalscript/pull/1055)
- `effects/node`: add `readUtf8File`/`writeUtf8File` helpers next to the `readFile`/`writeFile` effects — `readUtf8File` decodes a file as UTF-8 text while preserving the `IoResult` for caller-side error handling, `writeUtf8File` encodes a string and writes it; migrate the open-coded UTF-8 sandwiches in `djs/transpiler` (read), `djs` compile output and `ci` (write) to the helpers (i198-utf8-file-effects) [#1052](https://github.com/functionalscript/functionalscript/pull/1052)
- `effects/node`: drop the private `Io` indirection from the node effect runner — inline the single handler table into a module-level `asyncRun({ … })` wired straight to the Node globals, delete the dead `Io`/`App`/`Run` types and the `io` members the interpreter never read (`console`, `tryCatch`, `asyncTryCatch`, `performance`); pure refactor, `run`/`runEffect` unchanged (i664-drop-io-interface) [#1051](https://github.com/functionalscript/functionalscript/pull/1051)
- `fjs`: add a `proof.f.ts` covering the CLI command handlers (help output, the `compile` missing-argument error path, and the `run` handler's import-and-invoke and import-failure paths) via the virtual Node-effect interpreter [#1047](https://github.com/functionalscript/functionalscript/pull/1047)
- `effects/node/virtual`: add proofs covering the virtual `await` handler, the `fetch` not-found branch, and the `import_` invalid-path branch [#1046](https://github.com/functionalscript/functionalscript/pull/1046)
- `asn.1`: extract a private generic `decodeAll<T>(step)` helper that drains a `Vec` by repeatedly applying a `(Vec) => [T, Vec]` step until empty; rewrite `decodeObjectIdentifier` and `decodeSequence` through it instead of two near-identical `let`/`while` accumulators — pure refactor, behavior-identical (i189-asn1-decode-all-unfold) [#1041](https://github.com/functionalscript/functionalscript/pull/1041)
- `types/bigfloat`: factor the abs/sign/`multiply` envelope of `round53` and `decToBin`'s negative-exponent branch into a private `withSign` combinator ("operate on the magnitude, restore the sign") — pure refactor, behavior-identical (i191-bigfloat-with-sign) [#1022](https://github.com/functionalscript/functionalscript/pull/1022)
- `types/bigfloat`: collapse the private `increaseMantissa` / `decreaseMantissa` mirror into a single `normalizeMantissa` factory parameterized by shift direction, exponent delta, and stop predicate — pure refactor, behavior-identical (i177-bigfloat-normalize-mantissa) [#1021](https://github.com/functionalscript/functionalscript/pull/1021)
- `text/utf8`: define the UTF-8 tag/payload-mask constants (`contTag`/`contMask`, `lead2Tag`–`lead4Tag`/`Mask`) and `contByte` / `contPayload` helpers once at module scope and rewrite the encoder/decoder through them — pure refactor, byte-identical behaviour (i666-utf8-continuation-helpers) [#1020](https://github.com/functionalscript/functionalscript/pull/1020)
- `types/bigint`: export `divUp8` / `roundUp8` (bits → bytes, rounding up) and reuse them in `crypto/sign` and `asn.1` instead of locally re-deriving `divUpE2(3n)` / `roundUpE2(3n)` in each consumer (i66A-divup8-bits-to-bytes) [#1018](https://github.com/functionalscript/functionalscript/pull/1018)
- `types/sorted_list`: export `intersect` and `dropTail`; `types/sorted_set`: delegate `intersect` to `sorted_list.intersect`, mirroring how `union` delegates to `sorted_list.merge` (i180-sorted-set-intersect-symmetry) [#1017](https://github.com/functionalscript/functionalscript/pull/1017)
- `cas`: drop the private 2-char `split` helper and reuse `splitAt(2)` from `fs/types/string` for the CAS shard path computation (i668-cas-reuse-splitat) [#1014](https://github.com/functionalscript/functionalscript/pull/1014)
- `types/bigint`: add shift-based `divUpE2(e)` / `roundUpE2(e)` helpers for power-of-two round-up; retype `divUp` / `roundUp` from `Reduce` to `(b: bigint) => Unary`; migrate `asn.1` and `crypto/sign` from hand-coded `>> 3n` shifts and `divUp(8n)` / `roundUp(8n)` to the new helpers ([i187](./issues/187-byte-rounding-divup.md))
- `effects/memory`: add typed `create` / `read` / `write` memory operations, a Node `Map`-backed interpreter using `crypto.randomUUID()` keys, virtual-memory composition support, and proofs for round trips and type safety (i669-effects-memory) [#1008](https://github.com/functionalscript/functionalscript/pull/1008)
- `json/rpc`: add JSON-RPC spec links to module and request/response JSDoc; destructure `decodeRequest` result and `message` fields in `dispatch`; use shorthand property in `errorResponseOf` [#1002](https://github.com/functionalscript/functionalscript/pull/1002)

## 0.30.0

- `ci`: breaking change to the public CI generator: split generated workflows into lightweight platform jobs and canonical Ubuntu ARM jobs, set explicit read-only workflow permissions, pin FunctionalScript smoke-test installs, remove the repository-specific demo compile step, and expand Rust target checks to include release tests and release Clippy (i668-ci-matrix-update).

## 0.29.1

- `package`: relax the npm `engines.node` requirement from `>=24` to `>=22` for Node 22 compatibility [#987](https://github.com/functionalscript/functionalscript/pull/987)
- `types/prime_field`: make `quadRes(0n)` return `true`, compute Euler's exponent from `p - 1`, and document/prove the `p === 2n` behavior [#986](https://github.com/functionalscript/functionalscript/pull/986)

## 0.29.0

- add `bun.lock` and `deno.lock` to source control for reproducible builds; pin exact versions in `package.json` devDependencies; use `deno install --frozen` and `bun install --frozen-lockfile` in CI; add `bun install` to `update` script to keep `bun.lock` in sync; replace JSR install instruction in `fs/emergent_testing/README.md` with `deno install npm:functionalscript` [#985](https://github.com/functionalscript/functionalscript/pull/985)

## 0.28.0

- abandon JSR publishing: remove `deno.json`, `fs/dev/index/`, `fs/dev/version/`, and the `index` npm script; replace `deno install` + `deno task` commands in CI with direct `deno test`/`deno run`; remove `deno publish --dry-run` from generated CI and `deno publish` from publish workflow; remove JSR badge from `README.md` ([i667-abandon-jsr](./issues/667-abandon-jsr.md)) [#984](https://github.com/functionalscript/functionalscript/pull/984)

## 0.26.0

- `fjs`: add `fjs ci` / `fjs i` as first-class commands for the standard CI workflow generator; update this repo's `ci-update` script to call the built-in command through `node ./fs/fjs/module.ts ci` (i667-fjs-ci-command) [#975](https://github.com/functionalscript/functionalscript/pull/975)
- `cli`: change `Command<O>.handler` signature from `(args: readonly string[])` to `(options: NodeProgramOptions)`; `dispatch` now accepts and forwards full `NodeProgramOptions` with `args` trimmed to the remainder after the matched command name; `fs/fjs/module.f.ts` `commands` becomes a module-level constant with `main = dispatch(commands)` point-free (i667-cli-handler-options) [#973](https://github.com/functionalscript/functionalscript/pull/973)
- `fjs`: `fjs r` now looks up `main` instead of `default` on the imported module; update `fs/ci/module.f.ts`, `fs/website/module.f.ts`, and `fs/dev/index/module.f.ts` from `export default` to `export const main` (i667-fjs-run-main-convention) [#972](https://github.com/functionalscript/functionalscript/pull/972)
- `cli`: add `fs/cli/module.f.ts` — `Command` / `Commands` types and a `dispatch` function that builds a name→command map, auto-generates a `help` / `h` / `?` command with padded column alignment, and includes available commands in error messages for missing or unknown input; replace `switch`-based dispatch in `fs/fjs/module.f.ts` and `fs/cas/module.f.ts` with `Commands` lists; add `fs/cli/proof.f.ts` with 7 proofs (i665-command-line-parsing-refactor) [#971](https://github.com/functionalscript/functionalscript/pull/971)

## 0.25.0

- `ci`: auto-detect Rust by checking for `Cargo.toml` at the repo root — removes the manual `rust: boolean` flag from `Setup`; `access('Cargo.toml')` in the generator determines whether to include Rust steps ([i667-ci-rust-autodetect](./issues/667-ci-rust-autodetect.md)) [#969](https://github.com/functionalscript/functionalscript/pull/969)
- `ci`: split `npm test` into three explicit CI steps — `npx tsc`, `npm test` (`tsc && fjs t`), `node --test`, `npm run cov`; add `cov` script for coverage; remove `fst` script (superseded by new `npm test`) ([i667-test-conventions](./issues/667-test-conventions.md)) [#969](https://github.com/functionalscript/functionalscript/pull/969)
- `bnf`: hoist the `commaJoin0Plus` delimited-list combinator into `fs/bnf/module.f.ts` next to `join0Plus`; collapse three byte-identical local copies (`fs/bnf/testlib.f.ts` and twice in `fs/bnf/data/proof.f.ts`) onto the shared export. Curried over the per-grammar whitespace rule: `const cj = commaJoin0Plus(ws)` then `cj('[]', item)` / `cj('{}', item)` ([i665-bnf-comma-join-combinator](./issues/665-bnf-comma-join-combinator.md)) [#964](https://github.com/functionalscript/functionalscript/pull/964)
- `types/rtti/ts`: add `README.md` — documents the TS2589 depth-overflow problem for recursive `Ts<T>`, explains the `any` fast-path (option 1) and `WithOut` phantom symbol-key solution (option 3), records why named-alias splitting (option 2) was attempted and reverted, and documents the three remaining `as any` casts as open problems requiring TypeScript rank-2 or dependent types; close [i146](./issues/146-rtti-ts-inference.md) [#961](https://github.com/functionalscript/functionalscript/pull/961)
- `types/rtti/ts`: use a unique symbol key (`withOutKey`) for `WithOut`'s phantom field instead of the string `$out` — symbol keys are excluded from string index signatures (`{ readonly [K in string]: Type }`), making `WithOut<Struct, Out>` valid for any `Out` regardless of whether `Out extends Type` ([i146](./issues/146-rtti-ts-inference.md)) [960](https://github.com/functionalscript/functionalscript/pull/960)
- `types/rtti/ts`: add `WithOut<S, Out>` phantom type and `$out` branch to `Ts<T>` (i146 option 3) — annotate a thunk with a pre-computed output type; `Ts<WithOut<S, Out>>` short-circuits to `Out` via one indexed-access instead of walking the schema body, fixing TS2589 for recursive struct schemas; first use: `json/schema` derives `Unknown = Ts<typeof unknown>` without overflow ([i146](./issues/146-rtti-ts-inference.md)) [959](https://github.com/functionalscript/functionalscript/pull/959)
- `json/schema`: redesign `unknown` rtti schema using `WithOut` — split into `unknownConst` (struct) and `unknownThunk` (thunk wrapper); `UnknownConst` phantom type derives each field type via `Ts<typeof unknownConst.field>` so the TypeScript interface is always in sync with the schema; `export type Unknown = Ts<typeof unknown>` is now the single source of truth ([i146](./issues/146-rtti-ts-inference.md)) [959](https://github.com/functionalscript/functionalscript/pull/959)
- `types/rtti/validate`, `types/rtti/parse`, `types/rtti/common`: remove unnecessary `as any` from all `verror`/`prependPath` returns — `Error<ValidationError>` is directly assignable to `Result<T>`'s union without a cast; remaining casts (`ok(value)` after container loop, `(i as any)(value)` in or-dispatch) documented with root-cause comments ([i146](./issues/146-rtti-ts-inference.md)) [959](https://github.com/functionalscript/functionalscript/pull/959)
- `json/schema`: add `toJsonSchema(rtti)` — converts any rtti `Type` to a JSON Schema draft 2020-12 object; struct optionality (`option(T)`) is encoded via `required` / property-schema stripping; `anyOf` for `or`, `prefixItems`+`items:false` for tuples, `additionalProperties` omitted (lenient, matching rtti open-struct semantics) ([i665-rtti-json-schema](./issues/665-rtti-json-schema.md)) [957](https://github.com/functionalscript/functionalscript/pull/957)
- `crypto/sha2`: collapse `bigSigma`/`smallSigma` inside `base` into one `sigma(third)` factory parameterised by how the third XOR operand is built from `c` — `bigSigma = sigma(rotr)`, `smallSigma = sigma(c => x => x >> c)`; no API change, hot path unchanged ([i664-sha2-sigma-factory](./issues/664-sha2-sigma-factory.md)) [954](https://github.com/functionalscript/functionalscript/pull/954)
- `json/rpc`: add pure JSON-RPC 2.0 layer — rtti schemas for `request` / `error` / `response` envelopes; `decodeRequest` decoder; `dispatch(handlers)(value)` pure dispatcher with the five standard error constructors; `Response` type derived from `Ts<typeof response>` ([i665-json-rpc](./issues/665-json-rpc.md)) [950](https://github.com/functionalscript/functionalscript/pull/950)
- `json`: add rtti schemas (`primitive`, `unknown`, `object`, `array`) to `fs/json/module.f.ts`; derive `Primitive` and `Unknown` from them via `Ts<>` — schema is now the single source of truth, no hand-written types ([i665-rtti-json-value](./issues/665-rtti-json-value.md)) [950](https://github.com/functionalscript/functionalscript/pull/950)
- `types/rtti`: decouple rtti from djs — `Primitive` now defined locally in `rtti/module.f.ts`; `Unknown`, `Array`, `Object` now defined locally in `rtti/ts/module.f.ts`; `rtti/parse` imports `Unknown` from `rtti/ts` instead of `djs` ([i665-rtti-defines-types](./issues/665-rtti-defines-types.md)) [950](https://github.com/functionalscript/functionalscript/pull/950)
- `types/rtti/ts`: `Ts<T>` option 1 fast-path — `unknown extends T ? Unknown` short-circuits when `T` is `any`, preventing TS2589 distribution across all branches ([i146](./issues/146-rtti-ts-inference.md)) [950](https://github.com/functionalscript/functionalscript/pull/950)
- `crypto/vdf`: add a Sloth verifiable delay function (`sloth` / `sloth_vdf`) over a fixed 3072-bit safe prime; `eval` runs the sequential modular-square-root permutation and `verify` checks it via repeated squaring. Extends `types/prime_field` with `reduce` / `quadRes` field members and a standalone `modSqrt` helper (`p ≡ 3 (mod 4)`) ([i663-crypto-vdf](./issues/663-crypto-vdf.md)) [937](https://github.com/functionalscript/functionalscript/pull/937)

## 0.24.0

- **breaking** `effects`: hoist `fs/types/effects` → `fs/effects` (effects are a foundational layer, not a `type`); fold `fs/io` into `fs/effects/node/module.ts` and remove the `fs/io` module — the `Io` interface is now a private type internal to the node runner rather than a public export. Callers use the runner's exported `run(p)` (wraps `process.exit`) / `runEffect(p)` (resolves the exit code) entry points. JSR/`deno.json` exports `./fs/io/**` and `./fs/types/effects/**` become `./fs/effects/**` [943](https://github.com/functionalscript/functionalscript/pull/943)
- **breaking** `emergent_testing`: remove `fs/emergent_testing/module.ts`; the external-runner entry is now the self-contained, published `fs/emergent_testing/all.test.ts` (does `await runEffect(register)`). Consumers re-export it with a bare `import 'functionalscript/fs/emergent_testing/all.test.js'` instead of `…/module.js` [943](https://github.com/functionalscript/functionalscript/pull/943)

## 0.23.0

- **breaking** `io`: encapsulate `io` behind the entry points — rename the default export `effectRun` → `run`; add `runEffect(p)` (the effect runner with `io` and `argv` pre-applied, resolving to the exit code without calling `process.exit`); `run` now wraps `runEffect` with `process.exit`. `fs/emergent_testing/module.ts` drops its `io` / `runProgram` imports and self-executes via top-level `await runEffect(register)` — it no longer exports `run()`, so the external-runner entry becomes a bare side-effect `import 'functionalscript/fs/emergent_testing/module.js'` [942](https://github.com/functionalscript/functionalscript/pull/942)
- **breaking** `function/compare`: add generic `min`/`max` next to `cmp`, reusing the `Cmp1`/`Cmp2<A, B>` guard so mixed-type calls like `min(1)("a")` fail to compile; retire the duplicated `Reduce<number>`-typed `min`/`max` from `function/operator` and the bigint-typed `min`/`max` from `types/bigint`; consumers (`types/number`, `types/bit_vec`, `asn.1`) now import the single generic pair from `function/compare` [940](https://github.com/functionalscript/functionalscript/pull/940)

## 0.22.0

- **breaking** `emergent_testing`: rename `fs/emergent-testing` → `fs/emergent_testing` (snake_case, matching the `bit_vec` / `prime_field` module-naming convention); public exports and the external-runner entry import change from `…/fs/emergent-testing/module.{f.ts,ts,js}` to `…/fs/emergent_testing/module.{f.ts,ts,js}` [924](https://github.com/functionalscript/functionalscript/pull/924)
- `asserts`: add the missing `./fs/asserts/module.f.ts` entry to `deno.json` exports (the module was extracted in 0.21.0 but not published via JSR) [924](https://github.com/functionalscript/functionalscript/pull/924)

## 0.21.0

- **breaking** `tf`: rename `fs/dev/tf` → `fs/emergent-testing`; public exports `./fs/dev/tf/module.f.ts` and `./fs/dev/tf/module.ts` become `./fs/emergent-testing/module.f.ts` and `./fs/emergent-testing/module.ts`; external-runner entry import changes from `functionalscript/fs/dev/tf/module.js` to `functionalscript/fs/emergent-testing/module.js` [923](https://github.com/functionalscript/functionalscript/pull/923)
- `asserts`: extract `assert`, `assertEq`, `todo`, and the `Assert<T>` type from `fs/dev/module.f.ts` into a new standalone `fs/asserts/module.f.ts`; ~13 modules and proofs now import asserts directly instead of through `dev` [923](https://github.com/functionalscript/functionalscript/pull/923)
- `types/nullable`: add `fromUndefined(v)` — names the JS-host ↔ FunctionalScript `undefined`→`null` boundary in one helper; `array.at` collapses to `fromUndefined(a[i])` and `object.at` composes `map(d => d.value)` over `fromUndefined(getOwnPropertyDescriptor(...))` ([i188](./issues/188-nullable-from-undefined.md)) [919](https://github.com/functionalscript/functionalscript/pull/919)
- `effects/node`: add `errorExit(s)` — the canonical "write an error line to stderr, yield exit code 1" `NodeOp` program; replaces a private `e` helper in `fs/cas/module.f.ts` (5 sites) and two inline `error(...).step(() => pure(1))` copies in `fs/fjs/module.f.ts` ([i192](./issues/192-error-exit-effect.md)) [917](https://github.com/functionalscript/functionalscript/pull/917)

## 0.20.0

- `tf`: step 2 — widen load gate to all `.f.ts`/`.f.js` + vanilla `proof.{ts,js,mts,mjs}`; rename `isTest` → `shouldLoad`; drop filename filter from `runModuleMap`/`registerModuleMap` — `v.proof !== undefined` is the sole gate; enables co-located white-box proofs ([i65Y-proof-by-export](./issues/65Y-proof-by-export.md)) [893](https://github.com/functionalscript/functionalscript/pull/893)
- `tf`: step 1 — discover proofs by exported `proof` property; `Module.default` → `Module.proof`; convert all 81 proof files from `export default` to `export const proof`; runner ignores all other module properties ([i65Y-proof-by-export](./issues/65Y-proof-by-export.md)) [889](https://github.com/functionalscript/functionalscript/pull/889)
- `text`: DRY — extract the shared streaming code-point decoder skeleton (EOF sentinel, unit-vs-EOF dispatch, `flat(stateScan(...))` body) and the `errorMask` constant from `utf8`/`utf16` into a new `fs/text/code_point` module (`decoder` factory + `errorMask`) ([i168](./issues/168-utf-codepoint-decoder.md)) [860](https://github.com/functionalscript/functionalscript/pull/860)
- DJS serializer: factor out `buildSerialize(refLookup)` so `serializeWithoutConst` and `serializeWithConst` share the value→string core; the only difference (the const-ref short-circuit) is now a single `RefLookup` parameter; remove in-place mutation — `addRef` returns a fresh `Map` instead of `.set()`-mutating, and the "already added to consts" flag moves from `RefCounter[2]` into an immutable `Set<Unknown>` threaded through `getConstants`; `RefCounter` shrinks to `readonly [number, number]` and `Refs` becomes `ReadonlyMap` [832](https://github.com/functionalscript/functionalscript/pull/832)
- `effects`: add `foldStep` / `forEachStep` combinators — sequential state-threading and void-accumulator siblings of `all`; replaces two `reduce<Effect<O, S>>((acc, x) => acc.step(...), pure(init))` sites in `fs/dev/tf` and `fs/djs/transpiler` and a mutable `let`/`for` loop in `fs/cas` (with its `TODO: make it lazy`) ([i209](./issues/209-effect-fold-step.md)) [885](https://github.com/functionalscript/functionalscript/pull/885)
- `tf`: rename all `test.f.ts` / `test.f.js` → `proof.f.ts` / `proof.f.js` (80 files); remove dead `test.f.ts`/`test.f.js` entries from `isTest` ([i65Y-rename-test-to-proof](./issues/65Y-rename-test-to-proof.md)) [883](https://github.com/functionalscript/functionalscript/pull/883)
- `tf`: fix `sandbox` timing accuracy — use `p instanceof Promise ? await p : p` instead of routing through the `awaitPromise` boxing handler; spurious microtasks no longer inflate per-test durations (~30 s reported → ~7 s accurate) ([i65Y-sandbox-await-overhead](./issues/65Y-sandbox-await-overhead.md)) [883](https://github.com/functionalscript/functionalscript/pull/883)
- `tf`: async test function support — `registerModule` and `sandbox` now properly await async test functions; add `Await` effect type and `awaitPromise` Func; in `registerModule`, unify sync/async paths via `awaitPromise(r) | pure(r)`; make `sandbox` handler async to catch post-await errors ([i65X-async-test-functions](./issues/65X-async-test-functions.md)) [882](https://github.com/functionalscript/functionalscript/pull/882)
- `io`: `effectRun` now calls `process.exit` internally — return type changes from `Promise<number>` to `Promise<never>`; fixes `fjs t` always exiting 0 regardless of test failures ([i65X-effectrun-exit-code](./issues/65X-effectrun-exit-code.md)) [882](https://github.com/functionalscript/functionalscript/pull/882)
- `tf`: `isTest` moved to `dev/module.f.ts` — consolidates predicate used by both `loadFile` and `runModuleMap`; eliminates duplicated `endsWith` logic; `dev/tf/test.f.ts` imports directly from `../module.f.ts` [882](https://github.com/functionalscript/functionalscript/pull/882)
- `tf`: scenario tests use underscore prefix for temporary files (`_scenario.proof.f.ts`, `_all.test.ts`) — automatically ignored by git; added `fjs` as a scenario runner alongside node/bun/deno/playwright; `loadFile` now imports `proof.ts` / `proof.js` files [882](https://github.com/functionalscript/functionalscript/pull/882)
- `io`: extract `wrapInlineTest(register)` factory — collapses the identical `(name, opts, fn) => register(name, () => inlineTest(name, opts, fn))` shape shared by `bunTestContext` and `playwrightTestContext` into one helper; behaviour-preserving [880](https://github.com/functionalscript/functionalscript/pull/880)

## 0.19.0

- `tf`: drop Node 22 — remove `--experimental-strip-types`, bump `engines.node` to `>=24`, add `.node-version` for Cloudflare Pages, remove `node22` CI job ([i203](./issues/203-node22-expectfailure.md)) [872](https://github.com/functionalscript/functionalscript/pull/872)
- `tf`: `playwrightTestContext` — restore Playwright bridge removed in `iteration2`; detect via `PLAYWRIGHT_TEST` (set automatically by Playwright workers); `pwTest` resolved once via top-level `await`; same `inlineTest` pattern as Bun ([i202](./issues/202-playwright-context.md)) [872](https://github.com/functionalscript/functionalscript/pull/872)
- `tf`: `Engine` type (`'node' | 'bun' | 'playwright'`), `bunTestContext`, `inlineTest`, `inlineContext` — fix Bun's `ERR_NOT_IMPLEMENTED` on nested `t.test()` by registering with native `nodeTest.test` and running sub-tests inline; `expectFailure` handled manually ([i201](./issues/201-bun-inline-context.md)) [872](https://github.com/functionalscript/functionalscript/pull/872)
- `tf`: scenario tests — `fs/dev/tf/scenarios/` with `run.sh` (node/bun/deno/playwright), `all.ts` entry point, and three scenario files (`return-value.pass.f.ts`, `throw.pass.f.ts`, `fail.fail.f.ts`); runner uses hard links + `cd` so no `INIT_CWD` env var is needed ([i183](./issues/183-tf-framework-scenario-tests.md)) [872](https://github.com/functionalscript/functionalscript/pull/872)
- `tf`: `registerModule`, `registerModuleMap`, `register` — pure Effects layer for registering tests with external frameworks (Node `--test`, Bun, Playwright); `TestFn` return type changed to `Promise<void>`; `module.ts` reduced to a thin async shell ([i200](./issues/200-register-module.md)) [872](https://github.com/functionalscript/functionalscript/pull/872)
- `bit_vec`: DRY ([i167](./issues/167-bit-vec-msb-concat.md)) — make list concatenation a `BitOrder` member (`order.listToVec`); drop the free `listToVec` factory and replace the per-module `listToVec(msb)` re-binds in `crypto/sign`, `asn.1`, `sul/id`, `sul/level/literal` (and the `asn.1` test) with `msb.listToVec` [865](https://github.com/functionalscript/functionalscript/pull/865)

## 0.18.0

- `rtti`: DRY — `parse` mirrors `validate`'s container factories (`containerParse`/`constContainerParse` with a `rebuild` callback); move shared container guards/types (`IsContainer`, `GetEntries`, `Container`, `isArray`, `isObject`, `arrayEntries`) into the `common` kernel; drop `indexedFirstError` ([i162](./issues/162-rtti-parse-container-factories.md)) [853](https://github.com/functionalscript/functionalscript/pull/853)
- `tf`: `fmtImport` output format (`import("./f.ts").path()`), `null` call markers in path, `Reporter.pass` gains `file`, relative module keys in `loadModuleMap` [851](https://github.com/functionalscript/functionalscript/pull/851)
- `tf`: `Reporter.test` owns execution; `parseTestSet` uncurried; `oldThrows` rename; `defaultTest` exported; `Sandbox` removed from `runModuleMap`/`test` constraints; `run2` scaffold ([i163](./issues/163-reporter-test-method.md)) [844](https://github.com/functionalscript/functionalscript/pull/844)
- `types`: DRY — extract shared `bsearch` helper used by `sorted_list.find` and `range_map.get`; move curried `Cmp<T>` alias to `function/compare` and import it in `sorted_list`/`sorted_set` ([i158](./issues/158-sorted-binary-search.md)) [845](https://github.com/functionalscript/functionalscript/pull/845)
- `tf`: issue [i163](./issues/163-reporter-test-method.md) — `Reporter.test` design doc; export `runModuleMap`; experimental `run2` in `module.ts` [843](https://github.com/functionalscript/functionalscript/pull/843)
- `tf`: extract `runModule`/`runModuleMap`; flatten `walk` signature; filter before reduce; rename pass-continuation to `cont` [842](https://github.com/functionalscript/functionalscript/pull/842)
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
