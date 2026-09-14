/**
 * The DataJS codec: `tryParse` and `tryParseBytes` read a document into the
 * value it denotes, `trySerialize` and `tryStringify` write a value as one.
 *
 * ```text
 * DataJS text  --tryParse-------->  Unknown  --tryStringify-->  DataJS text
 * UTF-8 bytes  --tryParseBytes--->
 * ```
 *
 * [DataJS](../../../spec/datajs/README.md) is JSON with sharing and the
 * leaves JSON cannot carry — `undefined`, `bigint`, `NaN`, the infinities and
 * `-0` — written as a JavaScript module of `const` statements and one
 * `export default`. The value types are in [`./types.ts`](./types.ts):
 * `Unknown` is the graph a document denotes, sharing included.
 *
 * **Every entry point is fallible, and the names say so.** A caller may
 * legitimately hand a reader text that is no document, or a writer a value
 * outside the data model, so each returns a `Result` and refuses rather
 * than approximating: a reader reports where the parse failed or which rule
 * the document breaks, a writer names what it could not write.
 *
 * The two readers are one reader over one alphabet. `tryParse` takes the
 * document as UTF-16 code units, which is what the grammar reads.
 * `tryParseBytes` takes it as UTF-8 bytes and owes the two rules of the
 * specification's §Encoding a string cannot carry — **a document is
 * UTF-8**, and **it has no BOM** — refusing both before the reader sees a
 * unit, then handing on the code units the bytes denote.
 *
 * The two writers are one writer. `trySerialize` yields the document as
 * chunks and `tryStringify` is its `concat`, mirroring
 * [`fjs/media/json`](../json/module.f.mjs)'s pair. What either writes is
 * [normalized form](../../../spec/datajs/README.md#normalized-form) — one
 * line, one byte spelling per value — so there is no `tryNormalize` beside
 * them: with one layout the two would be one function. A readable layout is
 * the second writer the specification leaves room for, and the name waits
 * for it.
 *
 * The reader is [`./parser`](./parser/module.f.mjs), the writer
 * [`./serializer`](./serializer/module.f.mjs); each is documented where it
 * lives, and [`./README.md`](./README.md) is the map.
 *
 * @module
 */

export { tryParse, tryParseBytes } from './parser/module.f.mjs'
export { trySerialize, tryStringify } from './serializer/module.f.mjs'
