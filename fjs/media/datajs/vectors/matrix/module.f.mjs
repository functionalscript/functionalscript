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
 * reads beside the vectors.
 *
 * A record answers a **scope** rather than always a cell, because a role's
 * column must answer every class in the corpus and a serializer owes nothing
 * to the several hundred that are document facts. One reason names a class, a
 * subtree of them by path prefix, or every class no set but one carries, and
 * the most specific reason wins. What buys that width is a rule a cell could
 * not enforce, since a cell only ever sees itself: a reason is refused the
 * moment it answers a class that **has** vectors for its role, so it cannot
 * quietly stop being true of something beneath it. One answering no class at
 * all, one naming a role or a set the corpus does not have, one tagged with
 * none of the three, and two of equal specificity answering one cell are
 * refused the same way. A stale reason is how a table stops meaning anything.
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
 * @import { Corpus, NotApplicable, Role, Scope } from './types.ts'
 */

import { assertNotNullish } from '../../../../asserts/module.f.mjs'
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

/**
 * The names of the sets that carry a class, across every role. A `set`
 * scope is measured against this: a class no set but one carries is a class
 * no other role has a vector for.
 *
 * @type {(roles: readonly Role[], c: string) => readonly string[]}
 */
const setsCarrying = (roles, c) =>
    roles.flatMap(({ sets }) => sets.flatMap(([name, vectors]) => vectors.some(x => x.class === c) ? [name] : []))

/**
 * Whether a scope answers a class: the class itself, a class under the
 * subtree, or a class no set but the named one carries.
 *
 * @type {(roles: readonly Role[], scope: Scope, c: string) => boolean}
 */
const reaches = (roles, [tag, name], c) => {
    if (tag === 'class') { return c === name }
    if (tag === 'subtree') { return c === name || c.startsWith(`${name}/`) }
    // `every` is vacuous on an empty list, and here it cannot be one: a
    // class exists because a vector carries it, so at least one set does
    return setsCarrying(roles, c).every(n => n === name)
}

/**
 * How specific a scope is, as the one number a reason is chosen by: a class
 * names a single cell and wins outright, a longer subtree beats a shorter
 * one, and a set is the last resort. So a family's reason can be overridden
 * for one class beneath it without either being removed.
 *
 * @type {(scope: Scope) => number}
 */
const specificity = ([tag, name]) =>
    tag === 'class' ? Infinity : tag === 'subtree' ? name.length : -1

/** A scope as a failure names it. @type {(scope: Scope) => string} */
const showScope = ([tag, name]) => `${tag} ${name}`

/**
 * The reason the corpus gives for an empty cell, or `null` — the most
 * specific of those that reach it, since a wider one is what a narrower one
 * is an exception to.
 *
 * @type {(corpus: Corpus, role: string, c: string) => string | null}
 */
const reasonOf = ({ roles, notApplicable }, role, c) => {
    const matching = notApplicable.filter(n => n.role === role && reaches(roles, n.scope, c))
    return matching.length === 0
        ? null
        : matching.reduce((a, b) => specificity(b.scope) > specificity(a.scope) ? b : a).because
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
    if (role.sets.length === 0) {
        return reasonOf(corpus, role.role, c) === null
            ? ok('*awaiting the set*')
            : error(`${c} in ${role.role}: a reason for a role whose sets have not landed`)
    }
    const ids = idsOf(role, c)
    if (ids.length !== 0) { return ok(ids.map(code).join(', ')) }
    const reason = reasonOf(corpus, role.role, c)
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
    ...notApplicable.flatMap(({ scope, role, because }) => [
        ...check(isName, 'a name', `the scope of a reason in ${role}`, scope[1]),
        ...check(isProse, 'prose', `the reason for ${showScope(scope)} in ${role}`, because),
    ]),
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
 * A set name is measured across the whole corpus and not within a role,
 * because `setsCarrying` answers with names: two roles each holding a set
 * called `shared`, both carrying one class, would have that class named by
 * one set twice over and a `['set', 'shared']` reason for a third role would
 * read as true of it. The scope means "no set but that one carries this",
 * which only a name meaning one set can say.
 *
 * @type {(corpus: Corpus) => readonly string[]}
 */
const ambiguous = ({ roles }) => [
    ...twiceNamed(roles.map(r => r.role), n => `the role ${n}: named twice, so its two columns cannot be told apart`),
    ...twiceNamed(
        roles.flatMap(({ sets }) => sets.map(([name]) => name)),
        n => `the set ${n}: named twice, so a set scope cannot tell its two sets apart`),
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
    notApplicable.flatMap(({ scope, role }, i) =>
        notApplicable.findIndex(n => n.role === role && n.scope[0] === scope[0] && n.scope[1] === scope[1]) === i
            ? []
            : [`${showScope(scope)} in ${role}: a second reason for a scope that already has one`])

/**
 * A value as a failure can name it, whatever it turns out to be.
 *
 * `showScope` takes a scope apart, and the whole point of the check below is
 * that a reason may not carry one — so naming the offender cannot go through
 * it. It cannot go through `JSON.stringify` either, which throws on a bigint,
 * nor through `String` or a template on anything but a primitive: `{"toString":
 * 1}` is an ordinary DataJS object, and coercing it calls a hook that is not a
 * function and throws. So everything but a string and an array is named by its
 * `typeof` in angle brackets rather than by its value, which is what a writer
 * needs to find the record anyway.
 *
 * @type {(x: unknown) => string}
 */
const show = x =>
    x instanceof Array ? `[${x.map(show).join(', ')}]`
        : typeof x === 'string' ? JSON.stringify(x)
        : x === null ? 'null'
        : `<${typeof x}>`

/**
 * A scope that is not a tag and a name: not a pair of strings at all, or a
 * pair whose tag the union does not have.
 *
 * The reasons are a data module, which carries no annotations and is typed at
 * the import, so every such shape arrives here as data rather than as a `tsc`
 * error — the cast at the import asserts what the file says and checks
 * nothing. A tag is read by name and the remainder treated as `set`, which
 * would give `['sett', 'reject']` set semantics and print a plausible
 * `not applicable` cell for a record nobody wrote; a third element is read by
 * nothing at all, so `['class', 'y', 'whatever']` would answer as though the
 * extra were not there; and `null` or `['class', 1]` would reach a
 * destructuring or a template and throw where this function owes a
 * `Result`. Naming all of it here refuses the corpus before a row is built,
 * which is what every other check in this file does with a defect it finds.
 *
 * @type {(corpus: Corpus) => readonly string[]}
 */
const malformed = ({ notApplicable }) =>
    notApplicable.flatMap(({ scope, role }) => {
        /** @type {unknown} */
        const value = scope
        if (!(value instanceof Array)) { return [`a reason in ${role}: ${show(value)} is not a scope, which is a tag and a name`] }
        if (value.length !== 2) { return [`a reason in ${role}: ${show(value)} is not a tag and a name`] }
        if (!value.every(x => typeof x === 'string')) { return [`a reason in ${role}: ${show(value)} is not a tag and a name, both strings`] }
        return scope[0] === 'class' || scope[0] === 'subtree' || scope[0] === 'set'
            ? []
            : [`${showScope(scope)} in ${role}: no such scope, so it cannot be told from a set`]
    })

/**
 * A reason that is not true of what it answers: one naming a role, a set or
 * a class the corpus does not have, one reaching nothing at all, and — the
 * rule a wider scope is bought with — one reaching a class that *has*
 * vectors for its role.
 *
 * That last check used to sit in the cell, where it could only ever see one
 * class. A `subtree` or a `set` reason says something about a family, so it
 * is judged against the family: the moment one class beneath it is covered,
 * the reason has outlived its gap for that class and the corpus must say so
 * with a narrower scope instead. Without it a broad reason would go on
 * printing under cells it had stopped being true of, which is the one thing
 * this file exists to prevent.
 *
 * @type {(corpus: Corpus) => readonly string[]}
 */
const stale = corpus => {
    const { roles, notApplicable } = corpus
    const classes = classesOf(roles)
    const roleNames = new Set(roles.map(r => r.role))
    const setNames = new Set(roles.flatMap(r => r.sets.map(([name]) => name)))
    return notApplicable.flatMap(n => {
        const where = `${showScope(n.scope)} in ${n.role}`
        if (!roleNames.has(n.role)) { return [`${where}: no such role`] }
        if (n.scope[0] === 'set' && !setNames.has(n.scope[1])) { return [`${where}: no set of that name`] }
        const reached = classes.filter(c => reaches(roles, n.scope, c))
        if (reached.length === 0) { return [`${where}: answers no class`] }
        const role = assertNotNullish(roles.find(r => r.role === n.role))
        const covered = reached.filter(c => idsOf(role, c).length !== 0)
        return covered.length === 0
            ? []
            : [`${where}: answers ${covered.length} classes that have vectors, ${covered[0]} among them`]
    })
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
 * The defects a corpus has, as the failure a caller reads.
 *
 * @type {(failures: readonly string[]) => Result<string, string>}
 */
const refused = failures => error([
    `the class-by-role matrix has ${failures.length} defects:`,
    ...failures.map(f => `  ${f}`),
    'a class a role owes no vector needs a record in spec/datajs/vectors/not-applicable saying why.',
].join('\n'))

/**
 * The matrix as the file holds it, or the classes the corpus leaves
 * unanswered. Rows are the classes, columns the roles, and a cell is the
 * vector ids, the reason there are none, or a role whose sets have not
 * landed.
 *
 * @type {(corpus: Corpus) => Result<string, string>}
 */
export const matrix = corpus => {
    // A malformed scope is refused first and alone. Every other check reads a
    // scope as a tag and a name, so one that is neither cannot be read by them
    // at all — a one-element tuple has no name to render and no family to
    // measure. Reporting it beside failures derived from reading it would be
    // reporting the same defect twice over.
    const bad = malformed(corpus)
    if (bad.length !== 0) { return refused(bad) }
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
    if (failures.length !== 0) { return refused(failures) }
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
