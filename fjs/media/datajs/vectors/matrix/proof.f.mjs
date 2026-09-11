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

/** A corpus of one role, one set and one vector. @type {(role: string, name: string, vector: { id: string, class: string }) => Corpus} */
const one = (role, name, vector) => ({ roles: [{ role, sets: [[name, [vector]]] }], notApplicable: [] })

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
        // the header carries the role names in code spans, as every other
        // name in the table does, so a role a `_` makes italic cannot make
        // the header say something the corpus did not
        assert(t.includes('| class | `reader` | `serializer` |'), t)
        // the summary counts the three answers apart
        assert(t.includes('| `reader` | `accept` | 2 | 0 | 0 |'), t)
        assert(t.includes('| `serializer` | no set yet | 0 | 0 | 2 |'), t)
        assert(t.includes('2 classes.'), t)
    },
    // A role whose sets have landed owes every class an answer, and the
    // generator names the ones it does not get.
    unanswered: () => {
        assertEq(failure(landed), [
            'the class-by-role matrix has 1 defects:',
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
                'the class-by-role matrix has 1 defects:',
                '  x in reader: a reason for a cell that has 2 vectors',
                'a class a role owes no vector needs a record in spec/datajs/vectors/not-applicable saying why.',
            ].join('\n'))
        assert(failure({ ...two, notApplicable: [{ class: 'z', role: 'reader', because: 'no' }] })
            .includes('z in reader: no vector carries that class'))
        assert(failure({ ...two, notApplicable: [{ class: 'x', role: 'writer', because: 'no' }] })
            .includes('x in writer: no such role'))
        // A reason written before its role's sets exist has nothing to be
        // measured against, and would render `not applicable` under a column
        // whose header reads `no set yet`.
        assert(failure({ ...two, notApplicable: [{ class: 'x', role: 'serializer', because: 'no' }] })
            .includes('x in serializer: a reason for a role whose sets have not landed'))
    },
    // A cell may carry only what the table shows as written, and that is
    // decided by the characters allowed rather than the ones forbidden: a
    // `|` starts a column and a line break ends a row, but an HTML comment
    // shows nothing at all and an entity shows one character for five.
    unrenderable: () => {
        /** @type {(c: Corpus, ...expected: readonly string[]) => void} */
        const refuses = (c, ...expected) => {
            const r = failure(c)
            for (const e of expected) { assert(r.includes(e), `${e}\nnot in\n${r}`) }
        }
        /** @type {(because: string) => Corpus} */
        const reason = because => ({ ...landed, notApplicable: [{ class: 'y', role: 'serializer', because }] })
        const prose = 'is not prose the table can show as written'
        const name = 'is not a name the table can show as written'
        // the structure of the table
        refuses(reason('reader | writer only'), `the reason for y in serializer: "reader | writer only" ${prose}`)
        refuses(one('reader', 'accept', v('a', 'x\ny')), `the class of a: "x\\ny" ${name}`)
        refuses(one('reader', 'accept', v('a\rb', 'x')), `an id in accept: "a\\rb" ${name}`)
        // what renders as something other than itself
        refuses(reason('<!-- not meaningful -->'), `the reason for y in serializer: "<!-- not meaningful -->" ${prose}`)
        refuses(reason('a &amp; b'), `the reason for y in serializer: "a &amp; b" ${prose}`)
        refuses(reason('see *the note*'), `the reason for y in serializer: "see *the note*" ${prose}`)
        refuses(one('reader', 'accept', v('a', '<b>x</b>')), `the class of a: "<b>x</b>" ${name}`)
        // a role name a code span renders literally is not refused, and the
        // header is where it would otherwise have shown as italic
        assert(text(one('_reader_', 'accept', v('a', 'x'))).includes('| class | `_reader_` |'))
        refuses(one('rea`der', 'acc`ept', v('a', 'x')),
            `the role rea\`der: "rea\`der" ${name}`,
            `the set acc\`ept of rea\`der: "acc\`ept" ${name}`)
        // a cell that shows nothing is an unanswered cell wearing the look of
        // an answered one, and a space is an allowed character, so the
        // characters alone cannot catch it
        refuses(reason('   '), 'the reason for y in serializer: "   " shows nothing at all')
        refuses(reason(''), 'the reason for y in serializer: "" shows nothing at all')
        refuses(one('reader', 'accept', v('a', '')), 'the class of a: "" shows nothing at all')
        // and the punctuation of an ordinary sentence is not refused
        const fine = { ...landed, notApplicable: [{ class: 'y', role: 'serializer', because: "a serializer's output (see 3.1) never emits it; why would it?" }] }
        assert(text(fine).includes("not applicable: a serializer's output (see 3.1) never emits it; why would it?"))
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
