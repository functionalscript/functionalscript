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

/** Asserts that the matrix refuses `c`, naming each expected failure. @type {(c: Corpus, ...expected: readonly string[]) => void} */
const refuses = (c, ...expected) => {
    const r = failure(c)
    for (const e of expected) { assert(r.includes(e), `${e}\nnot in\n${r}`) }
}

/** The `landed` corpus with one reason for the class the serializer has no vector for. @type {(because: string) => Corpus} */
const reason = because => ({ ...landed, notApplicable: [{ class: 'y', role: 'serializer', because }] })

/** @type {string} */
const prose = 'is not prose the table can show as written'

/** @type {string} */
const name = 'is not a name the table can show as written'

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
        /** @type {Corpus} */
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
        // Two reasons for one cell leave the matrix to pick, and `reasonOf`
        // would pick the first without a word. The set's own proof checks
        // this too, but `gen` does not run it and `matrix` is exported.
        /** @type {Corpus} */
        const twice = { ...landed, notApplicable: [
            { class: 'y', role: 'serializer', because: 'a serializer never emits it' },
            { class: 'y', role: 'serializer', because: 'and here is a different account of why' },
        ] }
        assert(failure(twice).includes('y in serializer: a second reason for a cell that already has one'), failure(twice))
        // one reason each for two cells is not a duplicate
        /** @type {Corpus} */
        const distinct = { ...landed, notApplicable: [
            { class: 'y', role: 'serializer', because: 'a serializer never emits it' },
            { class: 'x', role: 'serializer', because: 'nor this one' },
        ] }
        assert(failure(distinct).includes('x in serializer: a reason for a cell that has 1 vectors'))
    },
    // A cell may carry only what the table shows as written, and that is
    // decided by the characters allowed rather than the ones forbidden: a
    // `|` starts a column and a line break ends a row, but an HTML comment
    // shows nothing at all and an entity shows one character for five.
    unrenderable: () => {
        // the structure of the table
        refuses(reason('reader | writer only'), `the reason for y in serializer: "reader | writer only" ${prose}`)
        refuses(one('reader', 'accept', v('a', 'x\ny')), `the class of a: "x\\ny" ${name}`)
        refuses(one('reader', 'accept', v('a\rb', 'x')), `an id in accept: "a\\rb" ${name}`)
        // what renders as something other than itself
        refuses(reason('<!-- not meaningful -->'), `the reason for y in serializer: "<!-- not meaningful -->" ${prose}`)
        refuses(reason('a &amp; b'), `the reason for y in serializer: "a &amp; b" ${prose}`)
        refuses(reason('see *the note*'), `the reason for y in serializer: "see *the note*" ${prose}`)
        // a shortcode is letters and colons, every character otherwise
        // allowed, and renders as an icon with the words gone — the one
        // exclusion that is about a pattern rather than a character
        refuses(reason(':warning: never emitted'), `the reason for y in serializer: ":warning: never emitted" ${prose}`)
        // names keep their colon: a code span renders a shortcode literally
        assert(text(one('reader', 'accept', v('a', 'ns:warning:x'))).includes('| `ns:warning:x` |'))
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
        /** @type {Corpus} */
        const fine = { ...landed, notApplicable: [{ class: 'y', role: 'serializer', because: "a serializer's output (see 3.1) never emits it; why would it?" }] }
        assert(text(fine).includes("not applicable: a serializer's output (see 3.1) never emits it; why would it?"))
    },
    // A name the corpus uses for two different things leaves the table
    // unable to say which it meant, while still printing something that
    // looks authoritative — the same trade, arriving through the names.
    ambiguous: () => {
        /** @type {Corpus} */
        const twoReaders = {
            roles: [
                { role: 'reader', sets: [['accept', [v('a', 'x')]]] },
                { role: 'reader', sets: [['accept', [v('b', 'x')]]] },
            ],
            notApplicable: [],
        }
        assert(failure(twoReaders).includes('the role reader: named twice, so its two columns cannot be told apart'))
        /** @type {Corpus} */
        const twoSets = {
            roles: [{ role: 'reader', sets: [['accept', [v('a', 'x')]], ['accept', [v('b', 'x')]]] }],
            notApplicable: [],
        }
        assert(failure(twoSets).includes('the set accept of reader: named twice'))
        /** @type {Corpus} */
        const twoIds = {
            roles: [{ role: 'reader', sets: [['accept', [v('a', 'x')]], ['reject', [v('a', 'y')]]] }],
            notApplicable: [],
        }
        assert(failure(twoIds).includes('the vector id a: used twice, so a cell naming it names either'))
        // a repeated name is said once however many times it repeats
        /** @type {Corpus} */
        const thrice = {
            roles: [{ role: 'reader', sets: [['a', [v('i', 'x')]], ['a', [v('j', 'x')]], ['a', [v('k', 'x')]]] }],
            notApplicable: [],
        }
        assertEq(failure(thrice).split('the set a of reader: named twice').length - 1, 1)
        // and the real corpus names nothing twice
        assert(matrix(corpus)[0] === 'ok')
    },
    // A corpus with no roles has no columns, so a row has nothing to say and
    // the header would carry an empty cell over a delimiter of one — not a
    // table at all, returned as though it were one.
    roleless: () => {
        refuses({ roles: [], notApplicable: [] }, 'the corpus has no roles, so the table has no columns')
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
