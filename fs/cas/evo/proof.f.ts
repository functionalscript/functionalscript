import { assertEq } from '../../asserts/module.f.ts'
import { vec } from '../../types/bit_vec/module.f.ts'
import { vecToCBase32 } from '../../basen/cbase32/module.f.ts'
import { expectedGeneration, heads, materialize, mergeRevision, verifyGeneration, type Entry } from './module.f.ts'

const subject = vecToCBase32(vec(256n)(1n))
const snapshot1 = vecToCBase32(vec(256n)(2n))
const snapshot2 = vecToCBase32(vec(256n)(3n))
const snapshot3 = vecToCBase32(vec(256n)(4n))
const r1Hash = vecToCBase32(vec(256n)(5n))
const r2Hash = vecToCBase32(vec(256n)(6n))
const r3Hash = vecToCBase32(vec(256n)(7n))
const r4Hash = vecToCBase32(vec(256n)(8n))
const otherSubject = vecToCBase32(vec(256n)(9n))

const r1: Entry = {
    hash: r1Hash,
    revision: { dialect: 'vnd.fjs.revision', subject, parents: [], generation: 0 },
}

const r2: Entry = {
    hash: r2Hash,
    revision: { dialect: 'vnd.fjs.revision', subject, parents: [r1Hash], snapshot: snapshot1, generation: 1 },
}

const r3: Entry = {
    hash: r3Hash,
    revision: { dialect: 'vnd.fjs.revision', subject, parents: [r1Hash], snapshot: snapshot2, generation: 1 },
}

const r4: Entry = {
    hash: r4Hash,
    revision: mergeRevision(subject)([r2Hash, r3Hash])(snapshot3),
}

const otherChild: Entry = {
    hash: vecToCBase32(vec(256n)(10n)),
    revision: { dialect: 'vnd.fjs.revision', subject: otherSubject, parents: [r2Hash], snapshot: otherSubject },
}

const archived: Entry = {
    hash: vecToCBase32(vec(256n)(11n)),
    revision: { dialect: 'vnd.fjs.revision', subject, parents: [r4Hash], snapshot: snapshot3, archived: true },
}

export const proof = {
    firstRevisionMaterializesFromSubject: () => {
        assertEq(materialize([r1])(r1)[0] === 'ok' ? materialize([r1])(r1)[1] : '', subject)
    },
    linearHistoryAndRetroactiveDemotion: () => {
        assertEq(heads(subject)([r1]).length, 1)
        assertEq(heads(subject)([r1, r2])[0]?.hash, r2Hash)
        assertEq(materialize([r1, r2])(r2)[0] === 'ok' ? materialize([r1, r2])(r2)[1] : '', snapshot1)
    },
    manyHeadsForOneSubject: () => {
        assertEq(heads(subject)([r1, r2, r3, otherChild]).length, 2)
    },
    branchAndMerge: () => {
        assertEq(heads(subject)([r1, r2, r3, r4]).length, 1)
        assertEq(heads(subject)([r1, r2, r3, r4])[0]?.hash, r4Hash)
        assertEq(materialize([r1, r2, r3, r4])(r4)[0] === 'ok' ? materialize([r1, r2, r3, r4])(r4)[1] : '', snapshot3)
    },
    archivedObject: () => {
        assertEq(heads(subject)([r1, r2, r3, r4, archived]).length, 0)
    },
    generationCacheMismatch: () => {
        const bad: Entry = { ...r2, revision: { ...r2.revision, generation: 9 } }
        assertEq(expectedGeneration([r1])(r2), 1)
        assertEq(verifyGeneration([r1])(r2)[0], 'ok')
        assertEq(verifyGeneration([r1])(bad)[0], 'error')
    },
    materializeErrors: () => {
        const missing: Entry = { ...r2, revision: { ...r2.revision, parents: [r3Hash], snapshot: undefined } }
        const multi: Entry = { ...r4, revision: { ...r4.revision, snapshot: undefined } }
        assertEq(materialize([missing])(missing)[0], 'error')
        assertEq(materialize([r2, r3, multi])(multi)[0], 'error')
    },
}
