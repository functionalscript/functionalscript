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
 * Text the table cannot show as written fails for the same reason: a `|`
 * in a reason starts a column, an HTML comment in one shows nothing at
 * all, and a table that reads differently from the data behind it reads
 * one way and means another exactly as prose does.
 *
 * A role whose sets have not landed is the one thing that does not fail:
 * a class cannot owe a vector to a set that does not exist. Its column
 * says so on *every* row — a reason written for it before its set exists
 * is refused too — and the refusal arrives with the set.
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

/** Where the matrix is written. @type {string} */
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
 * One cell: that the role's sets have not landed, the ids it has for the
 * class, the reason the corpus gives for having none, or the failure an
 * empty cell with no answer is.
 *
 * The sets come first because a role without them has nothing else to
 * say. A reason there would render `not applicable` in a column whose own
 * header reads `no set yet`, and a reader could not tell from the table
 * which of the two the corpus meant — so it is a defect, not a cell. It
 * is also a reason with nothing to be measured against: what a serializer
 * owes is not known until the serializer set is, which is the whole sense
 * of the refusal arriving with the set.
 *
 * @type {(corpus: Corpus, role: Role, c: string) => Result<string, string>}
 */
const cell = (corpus, role, c) => {
    const reason = reasonOf(corpus, role.role, c)
    if (role.sets.length === 0) {
        return reason === null
            ? ok('*awaiting the set*')
            : error(`${c} in ${role.role}: a reason for a role whose sets have not landed`)
    }
    const ids = idsOf(role, c)
    if (ids.length !== 0) {
        return reason === null
            ? ok(ids.map(code).join(', '))
            : error(`${c} in ${role.role}: a reason for a cell that has ${ids.length} vectors`)
    }
    return reason === null
        ? error(`${c} in ${role.role}: no vector and no reason`)
        : ok(`not applicable: ${reason}`)
}

/** @type {string} */
const lower = 'abcdefghijklmnopqrstuvwxyz'
/** @type {string} */
const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
/** @type {string} */
const digits = '0123456789'

/**
 * What a cell may carry, as the characters it may be made of rather than
 * the ones it may not.
 *
 * Naming the forbidden ones does not end: a `|` starts a column and a
 * line break ends a row, but `<!-- x -->` shows nothing at all, `&amp;`
 * shows one character where the corpus wrote five, `*x*` drops its
 * asterisks, and `[x](y)` shows half of itself. Each is the same defect —
 * a table reading differently from the data behind it — and a list of
 * them is only ever as long as the last person's imagination.
 *
 * So prose is letters, digits and the punctuation of a sentence, and a
 * name is what an id, a class, a role or a set is spelled from. Anything
 * else is refused and named, which costs a writer one rephrasing.
 *
 * A colon is not in the list, and it is the one exclusion that is about a
 * *pattern* rather than a character: `:warning:` is letters and colons,
 * every one of them otherwise allowed, and renders as an icon with the
 * words gone. The colon is what makes a shortcode a shortcode, so the
 * shape has no spelling once the colon has none, and a semicolon does the
 * sentence's work. Names keep theirs — a code span renders a shortcode
 * literally, which is the whole reason names sit in one.
 *
 * @type {string}
 */
const proseChars = `${lower}${upper}${digits} .,;'"()/+-?!`

/** @type {string} */
const nameChars = `${lower}${upper}${digits}/+-._:`

/** @type {(allowed: string) => (s: string) => boolean} */
const onlyFrom = allowed => s => [...s].every(c => allowed.includes(c))

/** @type {(s: string) => boolean} */
const proseCharsOnly = onlyFrom(proseChars)

/**
 * Prose the cell shows as written, which for the space means *as spaced*.
 * A table cell trims its edges and the rendering collapses a run, so
 * `reader  only` reaches a reader as `reader only` — the words intact and
 * the spacing not, which is still the table saying something the corpus
 * did not. The space is the last allowed character whose *repetition*
 * renders differently, so single-spacing closes whitespace entirely.
 *
 * @type {(s: string) => boolean}
 */
const isProse = s => proseCharsOnly(s) && s.trim() === s && !s.includes('  ')

/** @type {(s: string) => boolean} */
const isName = onlyFrom(nameChars)

/**
 * A string the table can show, and that shows something. Blank is the one
 * failure the allowed characters cannot catch, since a space is one of
 * them: a reason of spaces renders a cell reading `not applicable:` with
 * nothing after it, which is an unanswered cell wearing the look of an
 * answered one — the very trade this file refuses.
 *
 * @type {(ok: (s: string) => boolean, kind: string, what: string, s: string) => readonly string[]}
 */
const check = (ok, kind, what, s) =>
    s.trim() === ''
        ? [`${what}: ${JSON.stringify(s)} shows nothing at all`]
        : ok(s) ? [] : [`${what}: ${JSON.stringify(s)} is not ${kind} the table can show as written`]

/**
 * Every string the corpus puts in a cell, checked before any of them is
 * written. Refusing rather than escaping is the same answer the rest of
 * this file gives: a reason that cannot be rendered is a defect in the
 * corpus, named where it is, not something a generator quietly rewrites
 * into text nobody chose.
 *
 * @type {(corpus: Corpus) => readonly string[]}
 */
const unrenderable = ({ roles, notApplicable }) => [
    ...roles.flatMap(({ role, sets }) => [
        ...check(isName, 'a name', `the role ${role}`, role),
        ...sets.flatMap(([name, vectors]) => [
            ...check(isName, 'a name', `the set ${name} of ${role}`, name),
            ...vectors.flatMap(({ id, class: c }) => [
                ...check(isName, 'a name', `an id in ${name}`, id),
                ...check(isName, 'a name', `the class of ${id}`, c),
            ]),
        ]),
    ]),
    ...notApplicable.flatMap(({ class: c, role, because }) =>
        check(isProse, 'prose', `the reason for ${c} in ${role}`, because)),
]

/**
 * The names a list uses more than once, said once each however many times
 * the name repeats: reported at the last occurrence, which is the only
 * index that is neither the first nor followed by another.
 *
 * @type {(names: readonly string[], say: (n: string) => string) => readonly string[]}
 */
const twiceNamed = (names, say) =>
    names.flatMap((n, i) => i === names.indexOf(n) || i !== names.lastIndexOf(n) ? [] : [say(n)])

/**
 * A corpus with no roles at all. The table is rows of classes against
 * columns of roles, and with no columns there is nothing for a row to say
 * — the header would carry an empty cell over a delimiter of one, which is
 * not a table at all, returned as though it were one.
 *
 * `Corpus` admits the empty list and `matrix` is exported, so the refusal
 * belongs here rather than in the type.
 *
 * @type {(corpus: Corpus) => readonly string[]}
 */
const roleless = ({ roles }) =>
    roles.length === 0 ? ['the corpus has no roles, so the table has no columns'] : []

/**
 * A name the corpus uses for two different things.
 *
 * The table addresses a cell by its column's role and its row's class, and
 * a reason addresses one by those same two names. So a name that means two
 * things leaves the table unable to say which it meant — two `reader`
 * columns that are not the same reader, a reason reaching both, an id in a
 * cell that names either of two vectors — while still printing something
 * that looks authoritative. That is the trade this file refuses, arriving
 * through the names rather than through the text.
 *
 * @type {(corpus: Corpus) => readonly string[]}
 */
const ambiguous = ({ roles }) => [
    ...twiceNamed(roles.map(r => r.role), n => `the role ${n}: named twice, so its two columns cannot be told apart`),
    ...roles.flatMap(({ role, sets }) =>
        twiceNamed(sets.map(([name]) => name), n => `the set ${n} of ${role}: named twice`)),
    ...twiceNamed(
        roles.flatMap(({ sets }) => sets.flatMap(([, vectors]) => vectors.map(v => v.id))),
        n => `the vector id ${n}: used twice, so a cell naming it names either`),
]

/**
 * A second reason for a cell that already has one. `reasonOf` takes the
 * first and would drop the rest without a word, so the matrix would read
 * as though the corpus had said one thing where it said two.
 *
 * The not-applicable set's own proof checks this, but that proof is not
 * what `gen` runs and `matrix` is exported: a caller handing it a corpus
 * gets the same answer the file does, or none.
 *
 * @type {(corpus: Corpus) => readonly string[]}
 */
const duplicated = ({ notApplicable }) =>
    notApplicable.flatMap(({ class: c, role }, i) =>
        notApplicable.findIndex(n => n.role === role && n.class === c) === i
            ? []
            : [`${c} in ${role}: a second reason for a cell that already has one`])

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
    /** @type {readonly string[]} */
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
    /** @type {readonly string[]} */
    const failures = [
        ...roleless(corpus),
        ...unrenderable(corpus),
        ...ambiguous(corpus),
        ...duplicated(corpus),
        ...stale(corpus),
        ...rows.flatMap(r => r[0] === 'error' ? r[1] : []),
    ]
    if (failures.length !== 0) {
        return error([
            `the class-by-role matrix has ${failures.length} defects:`,
            ...failures.map(f => `  ${f}`),
            'a class a role owes no vector needs a record in spec/datajs/vectors/not-applicable saying why.',
        ].join('\n'))
    }
    // in code spans, as every other name in the table is: a role named
    // `_reader_` is a name `isName` admits, and raw in a header it would
    // render as an italic `reader` — the table saying one thing and the
    // corpus another, which is the whole failure this file refuses
    const header = corpus.roles.map(r => code(r.role))
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
 * It takes the options every `NodeProgram` is given and reads none of
 * them: the corpus is an argument of `program`, not of the run, so there
 * is nothing on the command line to vary.
 *
 * @type {(corpus: Corpus) => NodeProgram}
 */
export const program = corpus => _options => {
    const text = matrix(corpus)
    return text[0] === 'error' ? errorExit(text[1]) : exitStep(write(text[1]))
}

/** @type {NodeProgram} */
export const main = program(corpus)
