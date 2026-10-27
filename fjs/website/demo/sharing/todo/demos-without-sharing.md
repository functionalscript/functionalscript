## Share every demo's inputs

**Priority:** P2
**Status:** wip

### Problem

Editing a demo pushes its inputs to the address bar, and **Copy with inputs**
copies them, only when the demo declares a `sharing` contract
([sharing README](../README.md)). A demo with editable controls and no
contract is silently left out: the URL never changes while the reader types,
Copy with inputs is disabled as if the demo had none, and an `?example=…`
or input link to its page is refused as an unknown input.

`fjs/compiler`'s demo is one. It builds its `demo` by hand around a
`stageDemo` and keeps that demo's `init`, `update` and `view` but not its
`sharing`, so `/fjs/compiler/?example=hex-escape#demo`, the example the
[website README](../../../README.md) gives, does not restore.

### Proposal

Give the compiler demo a `sharing` that adapts the `stageDemo`'s to its
`{ text, panes }` state. `restore` cannot compile the panes: edited source is
compiled only through `catch`, in `update`, so a host failure stays in its
pane. It restores the text with no panes, and `update` compiles them on
`start`, which follows every restore.

### Demos

At `ed7a1148`, the tree had 126 `demo.f.mjs` modules. Each was imported and
its `view(init)` searched for enabled `input`, `textarea` and `select`
elements. Controls that only appear in a later state are not seen by this.

**Editable, without `sharing` (to fix):**

- [fjs/compiler](../../../../../fjs/compiler/demo.f.mjs) — `compiler` and the `example` picker

**With `sharing` (shared fields):**

- [fjs/basen/base64](../../../../../fjs/basen/base64/demo.f.mjs) — `text`
- [fjs/basen/cbase32](../../../../../fjs/basen/cbase32/demo.f.mjs) — `text`
- [fjs/compiler/edag](../../../../../fjs/compiler/edag/demo.f.mjs) — `edag`
- [fjs/compiler/parser](../../../../../fjs/compiler/parser/demo.f.mjs) — `parser`
- [fjs/compiler/rust](../../../../../fjs/compiler/rust/demo.f.mjs) — `rust`
- [fjs/compiler/serializer](../../../../../fjs/compiler/serializer/demo.f.mjs) — `serializer`
- [fjs/compiler/tokenizer](../../../../../fjs/compiler/tokenizer/demo.f.mjs) — `tokenizer`
- [fjs/crypto/hmac](../../../../../fjs/crypto/hmac/demo.f.mjs) — `algorithm`, `key`, `text`
- [fjs/crypto/pow](../../../../../fjs/crypto/pow/demo.f.mjs) — `text`, `nonce`, `nBits`
- [fjs/crypto/secp](../../../../../fjs/crypto/secp/demo.f.mjs) — `view`, `operation`, `k`, `p`, `q`, `target`, `realP`, `realQ`, `branchP`, `branchQ`, `curve`, `privateKey`
- [fjs/crypto/sha1](../../../../../fjs/crypto/sha1/demo.f.mjs) — `text`
- [fjs/crypto/sha2](../../../../../fjs/crypto/sha2/demo.f.mjs) — `algorithm`, `text`
- [fjs/crypto/sign](../../../../../fjs/crypto/sign/demo.f.mjs) — `curve`, `hash`, `key`, `message`, `reuse-key`, `reuse-nonce`, `reuse-message1`, `reuse-message2`
- [fjs/crypto/vdf](../../../../../fjs/crypto/vdf/demo.f.mjs) — `text`, `steps`, `claimed`
- [fjs/edag](../../../../../fjs/edag/demo.f.mjs) — `module`
- [fjs/effects](../../../../../fjs/effects/demo.f.mjs) — `words`
- [fjs/js/tokenizer](../../../../../fjs/js/tokenizer/demo.f.mjs) — `source`
- [fjs/media/datajs](../../../../../fjs/media/datajs/demo.f.mjs) — `datajs`
- [fjs/media/json](../../../../../fjs/media/json/demo.f.mjs) — `json`
- [fjs/media/markdown](../../../../../fjs/media/markdown/demo.f.mjs) — `changelog`
- [fjs/rtti](../../../../../fjs/rtti/demo.f.mjs) — `example`, `schema`, `value`, `compare`
- [fjs/rtti/guide/in-the-project/effects](../../../../../fjs/rtti/guide/in-the-project/effects/demo.f.mjs) — `example`, `schema`, `value`, `compare`
- [fjs/rtti/guide/in-the-project/expression-graph](../../../../../fjs/rtti/guide/in-the-project/expression-graph/demo.f.mjs) — `example`, `schema`, `value`, `compare`
- [fjs/rtti/guide/in-the-project/media](../../../../../fjs/rtti/guide/in-the-project/media/demo.f.mjs) — `example`, `schema`, `value`, `compare`
- [fjs/rtti/guide/in-the-project/protocols](../../../../../fjs/rtti/guide/in-the-project/protocols/demo.f.mjs) — `example`, `schema`, `value`, `compare`
- [fjs/rtti/guide/in-the-project/tooling](../../../../../fjs/rtti/guide/in-the-project/tooling/demo.f.mjs) — `example`, `schema`, `value`, `compare`
- [fjs/rtti/guide/outputs/data-form](../../../../../fjs/rtti/guide/outputs/data-form/demo.f.mjs) — `example`, `schema`, `value`, `compare`
- [fjs/rtti/guide/outputs/json-schema](../../../../../fjs/rtti/guide/outputs/json-schema/demo.f.mjs) — `example`, `schema`, `value`, `compare`
- [fjs/rtti/guide/outputs/typescript](../../../../../fjs/rtti/guide/outputs/typescript/demo.f.mjs) — `example`, `schema`, `value`, `compare`
- [fjs/rtti/guide/readers/errors](../../../../../fjs/rtti/guide/readers/errors/demo.f.mjs) — `example`, `schema`, `value`, `compare`
- [fjs/rtti/guide/readers/parse-and-validate](../../../../../fjs/rtti/guide/readers/parse-and-validate/demo.f.mjs) — `example`, `schema`, `value`, `compare`
- [fjs/rtti/guide/schemas/arrays-and-records](../../../../../fjs/rtti/guide/schemas/arrays-and-records/demo.f.mjs) — `example`, `schema`, `value`, `compare`
- [fjs/rtti/guide/schemas/closed-containers](../../../../../fjs/rtti/guide/schemas/closed-containers/demo.f.mjs) — `example`, `schema`, `value`, `compare`
- [fjs/rtti/guide/schemas/constants](../../../../../fjs/rtti/guide/schemas/constants/demo.f.mjs) — `example`, `schema`, `value`, `compare`
- [fjs/rtti/guide/schemas/open-containers](../../../../../fjs/rtti/guide/schemas/open-containers/demo.f.mjs) — `example`, `schema`, `value`, `compare`
- [fjs/rtti/guide/schemas/option](../../../../../fjs/rtti/guide/schemas/option/demo.f.mjs) — `example`, `schema`, `value`, `compare`
- [fjs/rtti/guide/schemas/primitives](../../../../../fjs/rtti/guide/schemas/primitives/demo.f.mjs) — `example`, `schema`, `value`, `compare`
- [fjs/rtti/guide/schemas/recursion](../../../../../fjs/rtti/guide/schemas/recursion/demo.f.mjs) — `example`, `schema`, `value`, `compare`
- [fjs/rtti/guide/schemas/unions](../../../../../fjs/rtti/guide/schemas/unions/demo.f.mjs) — `example`, `schema`, `value`, `compare`
- [fjs/sul](../../../../../fjs/sul/demo.f.mjs) — `input`, `text`, `bits`
- [fjs/text/utf8](../../../../../fjs/text/utf8/demo.f.mjs) — `text`
- [fjs/types/bigint](../../../../../fjs/types/bigint/demo.f.mjs) — `size`
- [fjs/types/btree](../../../../../fjs/types/btree/demo.f.mjs) — `example`, `key`, `count`
- [fjs/types/list](../../../../../fjs/types/list/demo.f.mjs) — `xs`
- [fjs/types/patricia_trie](../../../../../fjs/types/patricia_trie/demo.f.mjs) — `example`, `key`, `count`
- [fjs/website/changelog](../../../../../fjs/website/changelog/demo.f.mjs) — `release`
- [fjs/website/demo](../../../../../fjs/website/demo/demo.f.mjs) — `greeting`
- [fjs/website/issue](../../../../../fjs/website/issue/demo.f.mjs) — `issue`

**No editable controls (nothing to share):**

- [fjs/compiler/parser/grammar](../../../../../fjs/compiler/parser/grammar/demo.f.mjs)
- [fjs/ebnf/lib/datajs](../../../../../fjs/ebnf/lib/datajs/demo.f.mjs)
- [fjs/ebnf/lib/js](../../../../../fjs/ebnf/lib/js/demo.f.mjs)
- [fjs/ebnf/lib/json](../../../../../fjs/ebnf/lib/json/demo.f.mjs)
- [fjs/ebnf/lib/markdown](../../../../../fjs/ebnf/lib/markdown/demo.f.mjs)
- [fjs/emergent_testing/browser](../../../../../fjs/emergent_testing/browser/demo.f.mjs)
- [fjs/nanvm/demos/collatz](../../../../../fjs/nanvm/demos/collatz/demo.f.mjs)
- [fjs/nanvm/demos/hello](../../../../../fjs/nanvm/demos/hello/demo.f.mjs)
- [fjs/nanvm/demos/sort](../../../../../fjs/nanvm/demos/sort/demo.f.mjs)
- `spec/` pages: `bindings/constants`, `bindings/destructuring`, `bindings/globals`, `bindings/intrinsic-names`, `bindings/literal-words`, `bindings/var`, `bindings/variables`, `built-ins/eval`, `built-ins/member-functions`, `built-ins/static-functions`, `built-ins/static-functions/guarded`, `control-flow/guards`, `control-flow/loops`, `control-flow/switch/default-position`, `control-flow/switch`, `conversions/guarded`, `conversions/number`, `conversions/operands`, `conversions/string`, `functions/body-end`, `functions/call-statements`, `functions/call-statements/expression-statements`, `functions/calls`, `functions/captures`, `functions`, `functions/function-outputs`, `functions/names-and-identity`, `functions/parameters`, `functions/parameters/limit`, `functions/unreachable`, `lexical/comments`, `lexical/identifiers`, `lexical/string-escapes`, `lexical/whitespace`, `modules/empty-pattern-export`, `modules/empty-statements`, `modules/export-after-default`, `modules/export-let`, `modules/exports`, `modules/exports/then`, `modules/import-after-export`, `modules/no-export`, `modules/throw-position`, `operators/comma`, `operators`, `operators/grouping`, `operators/in`, `operators/instanceof`, `operators/instanceof/other-classes`, `operators/loose-equality`, `operators/this`, `property-access`, `property-access/entries`, `property-access/optional-chaining`, `property-access/prototype-calls`, `property-access/prototype-names`, `property-access/runtime-keys`, `undecided`, `values/arrays`, `values/arrays/holes`, `values/bigints`, `values`, `values/numbers`, `values/objects`, `values/objects/proto-key`, `values/strings/apostrophe-escape`, `values/strings`, `values/template-literals`

### Tasks

- [ ] Add `sharing` to `fjs/compiler`'s demo, compiling restored panes on `start`
