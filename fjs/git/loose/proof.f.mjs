/**
 * @import { ReadWhole } from '../../effects/node/types.ts'
 * @import { MemOperationMap } from '../../effects/mock/types.ts'
 * @import { Dir } from '../../effects/node/virtual/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { run } from '../../effects/mock/module.f.mjs'
import { u8ListToVecMsb } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/alt/module.f.js'
import { error, ok } from '../../types/result/module.f.js'
import { hex, storedBytes, streams } from '../../zlib/testlib.f.mjs'
import { write as writeEnvelope } from '../object/module.f.mjs'
import { latin1, noFile, tagLoose, tagPayload } from '../testlib.f.mjs'
import { virtual, virtualAt } from '../../effects/node/virtual/module.f.mjs'
import { hexText, of } from '../oid/module.f.mjs'
import { path, tryRead, write } from './module.f.mjs'
import { hasEntry } from '../../types/object/entry/module.f.js'

/** The file, as the chunks one open takes. @type {(bytes: readonly number[], size: number) => readonly import('../../types/bit_vec/types.ts').Vec[]} */
const chunks = (bytes, size) => Array.from({ length: Math.max(1, Math.ceil(bytes.length / size)) }, (_, i) => u8ListToVecMsb(bytes.slice(i * size, (i + 1) * size)))

/** A loose file of an object, stored and not compressed, which is a stream like any other. @type {(type: 'blob' | 'tree' | 'commit' | 'tag', payload: readonly number[]) => readonly number[]} */
const looseOf = (type, payload) => storedBytes(toArray(writeEnvelope(type, payload)))

/** A blob well over the 128 KiB a `Vec` holds, which the host's `inflate` refused. */
const big = Array.from({ length: 300_000 }, (_, i) => i * 31 + 7 & 0xff)

/** The bytes of the Huffman streams, which are no object: text and no envelope. */
const compressedText = hex(streams.text6)

/** The files of the host, by path, as the bytes each holds. @type {Readonly<Record<string, readonly number[]>>} */
const files = {
    tag: tagLoose,
    junk: storedBytes(latin1('junk')),
    text: compressedText,
    big: looseOf('blob', big),
    empty: looseOf('blob', []),
    notZlib: latin1('this is not a zlib stream'),
    cut: tagLoose.slice(0, 20),
    trailing: [...tagLoose, 1, 2, 3],
    // an envelope of three bytes over a body of 100 000, and then bytes that are no
    // stream: the body is stopped at its first chunk, and the rest never read
    oversize: [...storedBytes([...latin1('blob 3\u0000'), ...Array.from({ length: 100_000 }, () => 0)]).slice(0, 1_000), ...Array.from({ length: 2_000 }, () => 0xff)],
}

/**
 * A host that holds the files, a file as the chunks of `size` bytes, and logs
 * every command it answers, so a proof can see which ran.
 *
 * @type {(size: number) => MemOperationMap<ReadWhole, readonly string[]>}
 */
const hostOf = size => ({
    readWhole: path => log => [
        [...log, `readWhole ${path}`],
        hasEntry(files, path)
            ? ok(chunks(files[path], size))
            : error(noFile(path)),
    ],
})

const runHost = run(hostOf(1000))([])

const read = (/** @type {string} */ path) => runHost(tryRead(path))

/** A blob, its id in a SHA-1 repository, and where its loose file goes. */
const hello = latin1('hello\n')

const helloId = of(20)('blob', hello)

const helloPath = path('objects', helloId)

/** The loose writer of the object directory `objects`. */
const writeOwn = write('objects', 20)

/** An object directory holding `bytes` at the blob's path. @type {(bytes: readonly number[]) => Dir} */
const withFile = bytes => {
    const h = hexText(helloId)
    return { objects: { [h.slice(0, 2)]: { [h.slice(2)]: [u8ListToVecMsb(bytes)] } } }
}

export const proof = {
    // The signed tag's loose file: read whole, inflated, and past its envelope,
    // the payload Git wrote, byte for byte; one command, and no inflate.
    tag: () => {
        const [log, r] = read('tag')
        assertStructurallySame(log, ['readWhole tag'])
        assert(r[0] === 'ok')
        const e = r[1]
        assert(e !== null)
        assertEq(e.type, 'tag')
        assertStructurallySame(toArray(e.payload), tagPayload)
    },
    // The file in chunks of every size: the same object.
    chunked: () => {
        for (const size of [1, 7, 64, 100_000]) {
            const [, r] = run(hostOf(size))([])(tryRead('tag'))
            assert(r[0] === 'ok' && r[1] !== null)
            assertStructurallySame(toArray(r[1].payload), tagPayload, size)
        }
    },
    // A blob of 300 000 bytes, over what a `Vec` holds: read in chunks, inflated
    // to many, and the payload as long as the object is.
    big: () => {
        const [, r] = read('big')
        assert(r[0] === 'ok' && r[1] !== null)
        assertEq(r[1].type, 'blob')
        assertStructurallySame(toArray(r[1].payload), big)
        const [, empty] = read('empty')
        assert(empty[0] === 'ok' && empty[1] !== null)
        assertStructurallySame(toArray(empty[1].payload), [])
    },
    // Bytes that inflate to no object are `null`, not an error: the inflater
    // did its part. A Huffman stream of text is one too.
    notAnObject: () => {
        assertStructurallySame(read('junk')[1], ['ok', null])
        assertStructurallySame(read('text')[1], ['ok', null])
    },
    // A stream that goes on past what its envelope says is no object, and is not
    // inflated to find out: a stream no one has read to its end is no error.
    oversize: () => {
        assertStructurallySame(read('oversize')[1], ['ok', null])
    },
    // A file that cannot be read is the channel's, and nothing is inflated.
    missing: () => {
        const [log, r] = read('missing')
        assertStructurallySame(log, ['readWhole missing'])
        assert(r[0] === 'error')
        const e = r[1]
        assert(e[0] === 'ioError')
        assertEq(e[1].code, 'ENOENT')
    },
    // A file that is no zlib stream, one that ends before its stream does, and
    // one that holds bytes after it are the channel's, with the codes the host's
    // `inflate` gave.
    refused: () => {
        for (const [path, code] of /** @type {const} */ ([['notZlib', 'Z_DATA_ERROR'], ['cut', 'Z_BUF_ERROR'], ['trailing', 'ERR_TRAILING_BYTES']])) {
            const [, r] = read(path)
            assert(r[0] === 'error', path)
            const e = r[1]
            assert(e[0] === 'ioError', path)
            assertEq(e[1].code, code, path)
        }
    },
    // Where a loose object lives: below the object directory, the first two
    // hex digits of the id, then the rest; a directory that ends in a
    // separator gets no second one.
    path: () => {
        const h = hexText(helloId)
        assertEq(path('objects', helloId), `objects/${h.slice(0, 2)}/${h.slice(2)}`)
        assertEq(path('/', helloId), `/${h.slice(0, 2)}/${h.slice(2)}`)
    },
    // A write stores the object where the reader finds it, answers its id,
    // and leaves no temporary file behind.
    write: () => {
        const [state, r] = virtualAt({ objects: {} })(writeOwn('blob', hello))
        assertStructurallySame(r, ['ok', helloId])
        const objects = /** @type {Dir} */ (state.root.objects)
        assertStructurallySame(Object.keys(objects), [hexText(helloId).slice(0, 2)])
        const [, read] = virtual(state)(tryRead(helloPath))
        assert(read[0] === 'ok' && read[1] !== null)
        assertEq(read[1].type, 'blob')
        assertStructurallySame(toArray(read[1].payload), hello)
    },
    // The object already at its path is left as it is: nothing is written.
    present: () => {
        const root = withFile(looseOf('blob', hello))
        const [state, r] = virtualAt(root)(writeOwn('blob', hello))
        assertStructurallySame(r, ['ok', helloId])
        assertStructurallySame(state.root, root)
    },
    // A file at the path that is not the object — no zlib stream, no object,
    // or another object's bytes — is replaced by it.
    replaced: () => {
        for (const bytes of [latin1('no stream'), storedBytes(latin1('junk')), looseOf('blob', latin1('other'))]) {
            const [state, r] = virtualAt(withFile(bytes))(writeOwn('blob', hello))
            assertStructurallySame(r, ['ok', helloId])
            const [, read] = virtual(state)(tryRead(helloPath))
            assert(read[0] === 'ok' && read[1] !== null)
            assertStructurallySame(toArray(read[1].payload), hello)
        }
    },
    // A rename that fails takes the temporary file with it: a directory that
    // is not empty stands where the file would go.
    renameFails: () => {
        const h = hexText(helloId)
        /** @type {Dir} */
        const root = { objects: { [h.slice(0, 2)]: { [h.slice(2)]: { x: [] } } } }
        const [state, r] = virtualAt(root)(writeOwn('blob', hello))
        assert(r[0] === 'error', r)
        assertStructurallySame(state.root, root)
    },
}
