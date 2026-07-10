import { assert, assertEq } from '../../asserts/module.f.ts'
import { vec, length } from '../../types/bit_vec/module.f.ts'
import { vecToCBase32 } from '../../basen/cbase32/module.f.ts'
import { decode, encode, hasRevisionPrefix, isHash, isRef, mimeType, validate, type Revision } from './module.f.ts'

const hash = vecToCBase32(vec(256n)(1n))
const otherHash = vecToCBase32(vec(256n)(2n))
const shortHash = vecToCBase32(vec(8n)(1n))

const firstRevision: Revision = {
    dialect: 'vnd.fjs.revision',
    subject: hash,
    parents: [],
}

const snapshotRevision: Revision = {
    dialect: 'vnd.fjs.revision',
    subject: 'https://example.com/document',
    parents: [hash],
    snapshot: otherHash,
    generation: 1,
    archived: true,
}

export const proof = {
    isHash: () => {
        assert(isHash(hash))
        assert(!isHash(shortHash))
        assert(!isHash('https://example.com/document'))
    },
    isRef: () => {
        assert(isRef(hash))
        assert(isRef('https://example.com/document'))
        assert(!isRef('http://example.com/document'))
    },
    encodeDecode: () => {
        const encoded = encode(firstRevision)
        assert(hasRevisionPrefix(encoded))
        const decoded = decode(encoded)
        assertEq(decoded[0], 'ok')
        assertEq(decoded[0] === 'ok' ? decoded[1].subject : '', hash)
    },
    validate: () => {
        assertEq(mimeType, 'application/vnd.fjs.revision+json')
        assertEq(validate(snapshotRevision)[0], 'ok')
        assertEq(validate({ ...firstRevision, subject: 'ftp://example.com' })[0], 'error')
        assertEq(validate({ ...firstRevision, parents: ['https://example.com/rev'] })[0], 'error')
        assertEq(validate({ ...firstRevision, parents: [hash, otherHash] })[0], 'error')
        assertEq(validate({ ...firstRevision, dialect: 'other' })[0], 'error')
        assertEq(decode('{')[0], 'error')
        assertEq(length(vec(256n)(1n)), 256n)
    },
}
