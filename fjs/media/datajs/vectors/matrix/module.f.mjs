/**
 * The class-by-role matrix: which class of the specification each role of
 * an implementation has a vector for, generated from the corpus rather
 * than written.
 *
 * ```text
 * the sets -> matrix -> spec/datajs/vectors/matrix.md
 * ```
 *
 * Prose could not do this job. A paragraph that mentions a class in two
 * roles reads exactly like one that mentions it in three, which is how the
 * corpus lost the same class from a role five times over — the rounds
 * `spec/datajs/todo/conformance-vectors.md` records. A table with a cell
 * per class and role cannot read one way and mean another: the cell is
 * empty or it is not.
 *
 * So an empty cell is a failure, and the only thing that answers it is a
 * `NotApplicable` record in the corpus, which says why in words a reviewer
 * reads beside the vectors. A reason for a cell that has vectors, or for a
 * class no vector carries, is a failure too, since a stale reason is how a
 * table stops meaning anything.
 *
 * A role whose sets have not landed is the one thing that does not fail:
 * a class cannot owe a vector to a set that does not exist. Its column
 * says so on every row, and the refusal arrives with the set.
 *
 * @module
 *
 * @import { Result } from '../../../../types/result/types.ts'
 * @import { IoChannel, Mkdir, NodeProgram, WriteFile } from '../../../../effects/node/types.ts'
 * @import { Effect } from '../../../../effects/types.ts'
 * @import { Base } from '../types.ts'
 * @import { Corpus, NotApplicable, Role } from './types.ts'
 */

import { step } from '../../../../effects/module.f.mjs'
import { errorExit, exitStep, mkdir, writeUtf8File } from '../../../../effects/node/module.f.mjs'
import { cmp as strCmp } from '../../../../types/string/module.f.mjs'
import { error, ok } from '../../../../types/result/module.f.mjs'
import accept from '../../../../../spec/datajs/vectors/accept/data.f.mjs'
import reject from '../../../../../spec/datajs/vectors/reject/data.f.mjs'
import notApplicableData from '../../../../../spec/datajs/vectors/not-applicable/data.f.mjs'

/** Where the matrix is written. */
export const directory = 'spec/datajs/vectors'

/** @type {string} */
export const path = `${directory}/matrix.md`

/**
 * The corpus as the matrix reads it: the three roles a conforming
 * implementation may have, and the sets each one's vectors live in.
 * Conformance is per role — a serializer-only implementation never runs a
 * reader or a normalize vector — which is why the columns are roles and
 * not sets.
 *
 * @type {Corpus}
 */
export const corpus = {
    roles: [
        {
            role: 'reader',
            sets: [
                ['accept', /** @type {readonly Base[]} */ (accept)],
                ['reject', /** @type {readonly Base[]} */ (reject)],
            ],
        },
        { role: 'serializer', sets: [] },
        { role: 'normalize', sets: [] },
    ],
    notApplicable: /** @type {readonly NotApplicable[]} */ (notApplicableData),
}

/** @type {(a: string) => string} */
const code = s => `\`${s}\``

/** Every class any vector of any role carries, once each, in order. @type {(roles: readonly Role[]) => readonly string[]} */
const classesOf = roles => [...new Set(
    roles.flatMap(({ sets }) => sets.flatMap(([, vectors]) => vectors.map(v => v.class))),
)].toSorted((a, b) => strCmp(a)(b))

/** The ids a role has for a class, in the order its sets carry them. @type {(role: Role, c: string) => readonly string[]} */
const idsOf = ({ sets }, c) =>
    sets.flatMap(([, vectors]) => vectors.filter(v => v.class === c).map(v => v.id))

/** The reason the corpus gives for an empty cell, or `null`. @type {(corpus: Corpus, role: string, c: string) => string | null} */
const reasonOf = ({ notApplicable }, role, c) => {
    const found = notApplicable.find(n => n.role === role && n.class === c)
    return found === undefined ? null : found.because
}

/**
 * One cell: the ids the role has for the class, the reason the corpus
 * gives for having none, that the role's sets have not landed, or the
 * failure an empty cell with no answer is.
 *
 * @type {(corpus: Corpus, role: Role, c: string) => Result<string, string>}
 */
const cell = (corpus, role, c) => {
    const ids = idsOf(role, c)
    const reason = reasonOf(corpus, role.role, c)
    if (ids.length !== 0) {
        return reason === null
            ? ok(ids.map(code).join(', '))
            : error(`${c} in ${role.role}: a reason for a cell that has ${ids.length} vectors`)
    }
    if (reason !== null) { return ok(`not applicable: ${reason}`) }
    return role.sets.length === 0
        ? ok('*awaiting the set*')
        : error(`${c} in ${role.role}: no vector and no reason`)
}

/** A reason naming a class or a role the corpus does not have. @type {(corpus: Corpus) => readonly string[]} */
const stale = ({ roles, notApplicable }) => {
    const classes = new Set(classesOf(roles))
    const names = new Set(roles.map(r => r.role))
    return notApplicable.flatMap(n =>
        !names.has(n.role) ? [`${n.class} in ${n.role}: no such role`] :
        !classes.has(n.class) ? [`${n.class} in ${n.role}: no vector carries that class`] :
        [])
}

/** @type {(corpus: Corpus, c: string) => Result<readonly string[], readonly string[]>} */
const row = (corpus, c) => {
    const cells = corpus.roles.map(role => cell(corpus, role, c))
    const failures = cells.flatMap(r => r[0] === 'error' ? [r[1]] : [])
    return failures.length === 0
        ? ok(cells.map(r => /** @type {string} */ (r[1])))
        : error(failures)
}

/** How many classes a role answers, and how. @type {(corpus: Corpus, role: Role) => string} */
const summary = (corpus, role) => {
    const classes = classesOf(corpus.roles)
    const withVectors = classes.filter(c => idsOf(role, c).length !== 0).length
    const notApplicable = classes.filter(c => idsOf(role, c).length === 0 && reasonOf(corpus, role.role, c) !== null).length
    const sets = role.sets.length === 0
        ? 'no set yet'
        : role.sets.map(([name]) => code(name)).join(', ')
    return `| ${code(role.role)} | ${sets} | ${withVectors} | ${notApplicable} | ${classes.length - withVectors - notApplicable} |`
}

/**
 * The matrix as the file holds it, or the classes the corpus leaves
 * unanswered. Rows are the classes, columns the roles, and a cell is the
 * vector ids, the reason there are none, or a role whose sets have not
 * landed.
 *
 * @type {(corpus: Corpus) => Result<string, string>}
 */
export const matrix = corpus => {
    const classes = classesOf(corpus.roles)
    const rows = classes.map(c => row(corpus, c))
    const failures = [...stale(corpus), ...rows.flatMap(r => r[0] === 'error' ? r[1] : [])]
    if (failures.length !== 0) {
        return error([
            `the class-by-role matrix has ${failures.length} unanswered cells:`,
            ...failures.map(f => `  ${f}`),
            'a class a role owes no vector needs a record in spec/datajs/vectors/not-applicable saying why.',
        ].join('\n'))
    }
    const header = corpus.roles.map(r => r.role)
    return ok([
        '# The class-by-role matrix',
        '',
        'Generated from the corpus by `npm run gen`. Edits here are overwritten;',
        'the vectors and the reasons are the source, and both are reviewed as data.',
        '',
        'A **class** is the branch of the specification a vector covers, as fine as',
        'the thing an implementation can get wrong on its own. A **role** is what an',
        'implementation does — conformance is per role, so a serializer-only one',
        'never runs a reader or a normalize vector. A cell is the vectors that role',
        'has for that class, the reason it owes none, or a role whose sets have not',
        'landed. An empty cell with no reason fails the generator, which is the whole',
        'point: prose that mentions a class in two roles reads exactly like prose that',
        'mentions it in three.',
        '',
        '| role | sets | classes covered | not applicable | awaiting |',
        '| - | - | -: | -: | -: |',
        ...corpus.roles.map(r => summary(corpus, r)),
        '',
        `${classes.length} classes.`,
        '',
        `| class | ${header.join(' | ')} |`,
        `| - |${header.map(() => ' - |').join('')}`,
        ...classes.map((c, i) => `| ${code(c)} | ${/** @type {readonly string[]} */ (rows[i][1]).join(' | ')} |`),
        '',
    ].join('\n'))
}

/**
 * Writes the matrix at `path`, one write over a directory the corpus
 * already has.
 *
 * @type {(text: string) => Effect<Mkdir | WriteFile, void, IoChannel>}
 */
export const write = text => step(mkdir(directory, { recursive: true }), () => writeUtf8File(path, text))

/**
 * `gen` regenerates the matrix on every pull request, so a set that lands
 * without its row, or a class that loses a role, is a red check rather
 * than a file someone remembers to update. An unanswered cell exits
 * non-zero with the classes named: it is a defect in the corpus, not in
 * the generator, and the message says which record would answer it.
 *
 * @type {(corpus: Corpus) => NodeProgram}
 */
export const program = corpus => () => {
    const text = matrix(corpus)
    return text[0] === 'error' ? errorExit(text[1]) : exitStep(write(text[1]))
}

/** @type {NodeProgram} */
export const main = program(corpus)
