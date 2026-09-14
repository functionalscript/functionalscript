/**
 * @import { Assert } from '../../asserts/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Equal } from '../../types/ts/types.ts'
 * @import { U8 } from '../../text/utf8/types.ts'
 * @import { Unknown } from './types.ts'
 */

import { assertEq } from '../../asserts/module.f.mjs'
import { fromCodePointList } from '../../text/utf8/module.f.mjs'
import { stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { tryParse, tryParseBytes, trySerialize, tryStringify } from './module.f.mjs'
import { difference } from './vectors/module.f.mjs'

/** A document in normalized form: sharing, and the leaves JSON cannot carry. */
const document = 'const $0=[1n,undefined,NaN,-0];export default {"a":$0,"b":$0,"c":"é€𐀀"};'

/** The document's UTF-8 bytes. @type {(text: string) => List<U8>} */
const utf8 = text => fromCodePointList(stringToCodePointList(text))

/** The graph the document denotes, read as code units. */
const graph = unwrap(tryParse(document))

export const proof = {
    // The surface holds the four signatures the design fixed, and the
    // deeper proofs are each entry point's own: `parser/proof.f.mjs` for the
    // two readers, `serializer/proof.f.mjs` for the two writers, and the
    // conformance corpus for all four. What is proved here is that the four
    // compose as one codec.
    signatures: () => {
        /** @typedef {Assert<Equal<typeof tryParse, (text: string) => Result<Unknown, string>>>} _TryParse */
        /** @typedef {Assert<Equal<typeof tryParseBytes, (bytes: List<U8>) => Result<Unknown, string>>>} _TryParseBytes */
        /** @typedef {Assert<Equal<typeof trySerialize, (value: Unknown) => Result<List<string>, string>>>} _TrySerialize */
        /** @typedef {Assert<Equal<typeof tryStringify, (value: Unknown) => Result<string, string>>>} _TryStringify */
    },
    // Writing what was read gives the document back: normalized form is one
    // spelling per value, and the reader keeps the sharing the writer hoists.
    roundTrip: () => assertEq(unwrap(tryStringify(graph)), document),
    // The byte path reads the same graph from the document's UTF-8 bytes,
    // the four-byte scalar in `"c"` crossing the bridge back to a pair.
    bytes: () => assertEq(difference(graph)(unwrap(tryParseBytes(utf8(document)))), null),
    // The chunked writer and the string writer are one writer.
    chunks: () => assertEq(concat(unwrap(trySerialize(graph))), document),
    // Each side refuses rather than approximating.
    refused: {
        text: () => assertEq(tryParse('export default [1,]')[0], 'error'),
        bytes: () => assertEq(tryParseBytes([0xef, 0xbb, 0xbf])[0], 'error'),
        // a value outside the model reaches the writer as a host would hand
        // it, cast; a FunctionalScript caller cannot hand one at all
        value: () => assertEq(tryStringify(/** @type {Unknown} */ (/** @type {unknown} */ (() => 1)))[0], 'error'),
    },
}
