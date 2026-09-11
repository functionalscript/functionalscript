/**
 * @import { Corpus } from './types.ts'
 */

import { assert, assertEq } from '../../../../asserts/module.f.mjs'
import { step as ioStep } from '../../../../effects/module.f.mjs'
import { exitCode, readUtf8File } from '../../../../effects/node/module.f.mjs'
import {
    defaultNodeProgramOptions,
    emptyState,
    virtual,
} from '../../../../effects/node/virtual/module.f.mjs'
import { corpus, main, matrix, path, program, write } from './module.f.mjs'

/** A vector as the matrix reads one: an id and the class it covers. @type {(id: string, c: string) => { id: string, class: string }} */
const v = (id, c) => ({ id, class: c })

/** A corpus of two roles, the second with no sets, and no reasons. @type {Corpus} */
const two = {
    roles: [
        { role: 'reader', sets: [['accept', [v('a', 'x'), v('b', 'x'), v('c', 'y')]]] },
        { role: 'serializer', sets: [] },
    ],
    notApplicable: [],
}

/** The same, with the serializer's sets landed and `y` unanswered. @type {Corpus} */
const landed = {
    roles: [
        { role: 'reader', sets: [['accept', [v('a', 'x'), v('c', 'y')]]] },
        { role: 'serializer', sets: [['serializer-accept', [v('s', 'x')]]] },
    ],
    notApplicable: [],
}

/** @type {(c: Corpus) => string} */
const failure = c => {
    const r = matrix(c)
    assert(r[0] === 'error', 'expected the matrix to refuse this corpus')
    return r[1]
}

/** @type {(c: Corpus) => string} */
const text = c => {
    const r = matrix(c)
    assert(r[0] === 'ok', r[1])
    return r[1]
}

export const proof = {
    // A cell is the ids that role has for the class, in the order the sets
    // carry them; a class one role covers and another has no set for says
    // so rather than reading as a gap.
    cells: () => {
        const t = text(two)
        assert(t.includes('| `x` | `a`, `b` | *awaiting the set* |'), t)
        assert(t.includes('| `y` | `c` | *awaiting the set* |'), t)
        // the summary counts the three answers apart
        assert(t.includes('| `reader` | `accept` | 2 | 0 | 0 |'), t)
        assert(t.includes('| `serializer` | no set yet | 0 | 0 | 2 |'), t)
        assert(t.includes('2 classes.'), t)
    },
    // A role whose sets have landed owes every class an answer, and the
    // generator names the ones it does not get.
    unanswered: () => {
        assertEq(failure(landed), [
            'the class-by-role matrix has 1 unanswered cells:',
            '  y in serializer: no vector and no reason',
            'a class a role owes no vector needs a record in spec/datajs/vectors/not-applicable saying why.',
        ].join('\n'))
    },
    // The corpus answers it with a reason, which the cell then carries.
    notApplicable: () => {
        const answered = { ...landed, notApplicable: [{ class: 'y', role: 'serializer', because: 'a serializer never emits it' }] }
        const t = text(answered)
        assert(t.includes('| `y` | `c` | not applicable: a serializer never emits it |'), t)
        assert(t.includes('| `serializer` | `serializer-accept` | 1 | 1 | 0 |'), t)
    },
    // A reason that has outlived its gap is a failure of its own: a cell
    // with vectors needs none, and neither does a class or a role the
    // corpus does not have.
    stale: () => {
        assertEq(failure({ ...two, notApplicable: [{ class: 'x', role: 'reader', because: 'no' }] }),
            [
                'the class-by-role matrix has 1 unanswered cells:',
                '  x in reader: a reason for a cell that has 2 vectors',
                'a class a role owes no vector needs a record in spec/datajs/vectors/not-applicable saying why.',
            ].join('\n'))
        assert(failure({ ...two, notApplicable: [{ class: 'z', role: 'reader', because: 'no' }] })
            .includes('z in reader: no vector carries that class'))
        assert(failure({ ...two, notApplicable: [{ class: 'x', role: 'writer', because: 'no' }] })
            .includes('x in writer: no such role'))
    },
    // Every class of the corpus is a row, and every vector's id is in it.
    corpus: () => {
        const t = text(corpus)
        for (const { role, sets } of corpus.roles) {
            assert(t.includes(`| \`${role}\` |`), role)
            for (const [, vectors] of sets) {
                for (const { id, class: c } of vectors) {
                    assert(t.includes(`\`${id}\``), id)
                    assert(t.includes(`| \`${c}\` |`), c)
                }
            }
        }
    },
    write: () => {
        const written = ioStep(write('hello'), () => readUtf8File(path))
        const [, [tag, result]] = virtual(emptyState)(written)
        assert(tag === 'ok', result)
        assertEq(result, 'hello')
    },
    main: () => {
        const [, result] = virtual(emptyState)(main(defaultNodeProgramOptions))
        assertEq(exitCode(result), 0)
    },
    // A corpus the matrix refuses exits non-zero rather than writing a
    // table with a hole in it.
    programRefuses: () => {
        const [, result] = virtual(emptyState)(program(landed)(defaultNodeProgramOptions))
        assertEq(exitCode(result), 1)
    },
}
