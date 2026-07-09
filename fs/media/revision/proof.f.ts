import { assert, assertEq } from '../../asserts/module.f.ts'
import { mimeType, ref, hash, revision, decodeRevision } from './module.f.ts'

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
            content: validHash,
            generation: 1,
        }
        const [t, r] = decodeRevision(v)
        assertEq(t, 'ok')
        if (t === 'error') { throw r }
        assertEq(r.content, validHash)
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
    decodeRejectsWrongMimeType: () => {
        const v = { mimeType: 'text/plain', object: validHash, parents: [] }
        const [t] = decodeRevision(v)
        assertEq(t, 'error')
    },
}
