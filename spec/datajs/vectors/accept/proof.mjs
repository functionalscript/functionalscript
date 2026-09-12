/**
 * The whole-set JavaScript check: every accept document, imported as an ES
 * module by the engine, yields the graph its vector asserts.
 *
 * This is the subset law over the whole set rather than one document at a
 * time — DataJS is JavaScript, so a document *is* a module and an engine
 * loads one with no parser and no library. The corpus's other proofs run
 * the documents through this repository's reader; this one runs them
 * through the host, and a disagreement between the two is exactly what the
 * law forbids.
 *
 * **It is host code because it has to be.** A proof in the subset cannot
 * call dynamic `import`, so no `.f.mjs` can load a document as a module.
 * That is the whole reason this file exists beside `proof.f.mjs` rather
 * than inside it, and it is not the back door §1.6 forbids: what it proves
 * is a property of the corpus's data, not a FunctionalScript API driven
 * against inputs the subset cannot build.
 *
 * @import { Accept } from '../../../../fjs/media/datajs/vectors/types.ts'
 */

import { assert, assertEq } from '../../../../fjs/asserts/module.f.mjs'
import { bytes, difference } from '../../../../fjs/media/datajs/vectors/module.f.mjs'
import accept from './data.f.mjs'

/** The set, typed at the import since a data module carries no annotations. */
const set = /** @type {readonly Accept[]} */ (accept)

/**
 * Whether a document holds a surrogate code unit with no partner.
 *
 * Such a document has **no UTF-8 encoding at all**, so it cannot be carried
 * to the engine by any route: a `data:` URL is base64 of its UTF-8 or the
 * percent-encoding of the same, and a file is bytes. Encoding it anyway
 * substitutes
 * U+FFFD and quietly tests a different document, which is worse than not
 * testing it — so these are named below rather than skipped, and a ninth
 * one appearing is a failure.
 *
 * The corpus can hold them at all only because it is JavaScript: the data
 * module's own source writes the escape, and the string it denotes holds
 * the unit itself.
 *
 * @type {(document: string) => boolean}
 */
const unpaired = document => {
    for (let i = 0; i < document.length; i += 1) {
        const c = document.charCodeAt(i)
        if (c >= 0xdc00 && c <= 0xdfff) { return true }
        if (c >= 0xd800 && c <= 0xdbff) {
            const next = document.charCodeAt(i + 1)
            if (!(next >= 0xdc00 && next <= 0xdfff)) { return true }
            i += 1
        }
    }
    return false
}

/** The eight documents that cannot reach an engine, by id. @type {readonly string[]} */
const noEncoding = [
    'string-surrogate-lone-raw-d800',
    'key-surrogate-lone-raw-d800',
    'string-surrogate-lone-raw-dbff',
    'key-surrogate-lone-raw-dbff',
    'string-surrogate-lone-raw-dc00',
    'key-surrogate-lone-raw-dc00',
    'string-surrogate-lone-raw-dfff',
    'key-surrogate-lone-raw-dfff',
]

/**
 * The bytes of a document, or `null` where it has none: a string through
 * `TextEncoder`, which is its UTF-8, and a byte-form document as the bytes it
 * already is — no encode between it and the engine, which is the point of
 * carrying it that way and makes this the one place the corpus checks that a
 * byte document is a JavaScript module too.
 *
 * @type {(document: import('../../../../fjs/media/datajs/vectors/types.ts').Document) => readonly number[] | Uint8Array | null}
 */
const documentBytes = document => typeof document === 'string'
    ? (unpaired(document) ? null : new TextEncoder().encode(document))
    : /** @type {readonly number[]} */ (bytes(document[1]))

/**
 * Bytes as the one-character-per-byte string `btoa` takes.
 *
 * @type {(raw: readonly number[] | Uint8Array) => string}
 */
const latin1 = raw => Array.from(raw, b => String.fromCharCode(b)).join('')

/**
 * A document as a module the engine can load, or `null` where it has no
 * encoding to be one.
 *
 * The body is **base64**, and that is the one spelling every runtime this
 * suite runs on decodes. Measured: Bun hands back the URL itself as the
 * module's default export for `data:text/javascript,` with a percent-encoded
 * body, so a vector comparing the export against its graph fails with the
 * URL in the message. Node and Deno take either. Base64 it is.
 *
 * `btoa` rather than `Buffer`, since `Buffer` is Node's and is not a global
 * everywhere the suite runs; `TextEncoder` and `btoa` are the same Web API
 * in all three.
 *
 * @type {(document: import('../../../../fjs/media/datajs/vectors/types.ts').Document) => string | null}
 */
const moduleUrl = document => {
    const raw = documentBytes(document)
    return raw === null ? null : `data:text/javascript;base64,${btoa(latin1(raw))}`
}

export const proof = {
    // Every document an engine can be handed is a module, and the value it
    // exports is the graph the vector asserts — compared with `difference`,
    // so sharing counts: a document whose engine-built graph inlined a
    // shared node would denote something else and is caught here.
    javaScript: async () => {
        let checked = 0
        for (const vector of set) {
            const { id, document, graph } = vector
            const url = moduleUrl(document)
            if (url === null) { continue }
            let loaded = undefined
            try {
                loaded = (await import(url)).default
            } catch (e) {
                assert(false, `${id}: the engine refused the document: ${String(e)}`)
            }
            const d = difference(graph)(loaded)
            assert(d === null, `${id}: the engine's graph is not the vector's: ${d}`)
            checked += 1
        }
        assertEq(checked, set.length - noEncoding.length)
    },
    // And exactly those eight are the ones that cannot be carried, so a
    // document that quietly stops being checkable fails rather than
    // disappears from the count above.
    unencodable: () => {
        const found = set.filter(v => typeof v.document === 'string' && unpaired(v.document)).map(v => v.id)
        assertEq(found.length, noEncoding.length)
        for (const id of noEncoding) {
            assert(found.includes(id), `${id}: named as unencodable, but its document encodes`)
        }
    },
}
