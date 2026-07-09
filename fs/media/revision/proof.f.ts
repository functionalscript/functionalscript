import { assert, assertEq } from '../../asserts/module.f.ts'
import {
    mimeType, ref, hash, revision, isHash, isHttpsRef, isRef, decodeRevision,
} from './module.f.ts'

const validHash = '00000000000000000000000000000000000000000000000028t8'

export const proof = {
    mimeTypeTag: () => {
        assertEq(mimeType, 'application/vnd.functionalscript.revision+json')
    },
    schemaFieldsExist: () => {
        // `ref`/`hash` are exported schema fragments (unconstrained `string`).
        assert(ref === hash)
        assert(typeof revision.mimeType === 'string')
    },
    isHashValid: () => {
        assert(isHash(validHash))
    },
    isHashInvalid: () => {
        assert(!isHash('not a hash!'))
    },
    isHttpsRefTrue: () => {
        assert(isHttpsRef('https://example.com/x'))
    },
    isHttpsRefFalse: () => {
        assert(!isHttpsRef('http://example.com/x'))
    },
    isRefHash: () => {
        assert(isRef(validHash))
    },
    isRefHttps: () => {
        assert(isRef('https://example.com/x'))
    },
    isRefNeither: () => {
        assert(!isRef('ftp://example.com/x'))
    },
    decodeFirstRevisionNoContent: () => {
        const v = { mimeType, object: validHash, parents: [] }
        const [t, r] = decodeRevision(v)
        assertEq(t, 'ok')
        if (t === 'error') { throw r }
        assertEq(r.object, validHash)
        assertEq(r.parents.length, 0)
    },
    decodeWithContentAndParents: () => {
        const v = {
            mimeType,
            object: validHash,
            parents: [validHash],
            content: 'https://example.com/doc',
            generation: 1,
        }
        const [t, r] = decodeRevision(v)
        assertEq(t, 'ok')
        if (t === 'error') { throw r }
        assertEq(r.content, 'https://example.com/doc')
        assertEq(r.generation, 1)
    },
    decodeArchived: () => {
        const v = { mimeType, object: validHash, parents: [], archived: true as const }
        const [t, r] = decodeRevision(v)
        assertEq(t, 'ok')
        if (t === 'error') { throw r }
        assertEq(r.archived, true)
    },
    decodeWithChanges: () => {
        const v = { mimeType, object: validHash, parents: [validHash], changes: [validHash] }
        const [t, r] = decodeRevision(v)
        assertEq(t, 'ok')
        if (t === 'error') { throw r }
        assertEq(r.changes?.length, 1)
    },
    decodeRejectsBadShape: () => {
        const [t] = decodeRevision({ mimeType, object: validHash })
        assertEq(t, 'error')
    },
    decodeRejectsBridgeUrlParent: () => {
        const v = { mimeType, object: validHash, parents: ['https://example.com/x'] }
        const [t] = decodeRevision(v)
        assertEq(t, 'error')
    },
    decodeRejectsBadObjectRef: () => {
        const v = { mimeType, object: 'ftp://nope', parents: [] }
        const [t] = decodeRevision(v)
        assertEq(t, 'error')
    },
    decodeRejectsBadContentRef: () => {
        const v = { mimeType, object: validHash, parents: [], content: 'ftp://nope' }
        const [t] = decodeRevision(v)
        assertEq(t, 'error')
    },
    decodeRejectsBadChangesRef: () => {
        const v = { mimeType, object: validHash, parents: [validHash], changes: ['ftp://nope'] }
        const [t] = decodeRevision(v)
        assertEq(t, 'error')
    },
}
