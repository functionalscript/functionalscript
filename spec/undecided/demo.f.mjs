/**
 * The constructs whose refusal is undecided, of [`README.md`](./README.md):
 * every **open** row of the
 * [refused constructs](../todo/refused-constructs.md) register, with a
 * module that writes it and what `fjs compile` answers for that module.
 *
 * **The rows are the register's, read in the page.** The page fetches the
 * register and keeps the rows whose **Why** is `open`, so a row decided in a
 * pull request leaves this page in the same one, with nothing here to edit.
 *
 * **The verdicts are this build's compiler's**, as on a refused construct's
 * page ([`in`](../operators/in/README.md)): each sample is compiled in the
 * page. A sample the compiler accepts, an open row with no sample, and a
 * sample whose row is no longer open are each shown as such, since each
 * means this page and the register disagree.
 *
 * @module
 *
 * @import { FetchText } from '../../fjs/effects/browser/types.ts'
 * @import { Effect } from '../../fjs/effects/types.ts'
 * @import { Element, Node } from '../../fjs/media/html/types.ts'
 * @import { Entry, Inline } from '../../fjs/media/markdown/types.ts'
 * @import { Result } from '../../fjs/types/result/types.ts'
 * @import { Marked } from '../../fjs/text/marked/types.ts'
 * @import { OutputRefusal } from '../../fjs/compiler/types.ts'
 * @import { StringMap } from '../../fjs/types/object/types.ts'
 * @import { Demo, DemoEvent } from '../../fjs/website/demo/types.ts'
 * @import { OpenRow, State } from './types.ts'
 */

import { mapStep, pureOk } from '../../fjs/effects/module.f.mjs'
import { tryParseBlocks } from '../../fjs/media/markdown/module.f.mjs'
import { basename, parent } from '../../fjs/path/module.f.mjs'
import { error, ok } from '../../fjs/types/result/module.f.js'
import { compileAs, fetchFile, reportText } from '../../fjs/compiler/refused_demo/module.f.mjs'
import { loadedView } from '../../fjs/nanvm/demos/page/module.f.mjs'
import { caption } from '../../fjs/website/demo/module.f.mjs'
import { isTodoDir } from '../../fjs/website/module.f.mjs'
import { readmeNodes, resolveHref } from '../../fjs/website/readme/module.f.mjs'
import { codeMarker, registerRowMarker, resultMarker, undecidedMarker } from '../../fjs/website/style/module.f.js'
import { samples } from './samples.f.mjs'

/** The register, from the repository's root. */
export const registerPath = 'spec/todo/refused-constructs.md'

/** @type {State} */
export const init = { register: ['loading'] }

/**
 * The words of `cell`, as plain text: a row's ID is its cell's code span.
 *
 * @type {(cell: Entry) => string}
 */
const words = cell => cell.map(span => span[0] === 'text' || span[0] === 'code'
    ? span[1]
    : span[1].map(label => label[1]).join('')).join('')

/**
 * Whether a **Why** cell's text says `open`: the word, alone or before what
 * the row says of it.
 *
 * @type {(text: string) => boolean}
 */
const isOpen = text => text === 'open' || text.startsWith('open ')

/**
 * What a **Why** cell says beside its leading `open`: `open (related: x)` is
 * `related: x`, and a bare `open` is nothing.
 *
 * @type {(cell: Entry) => Entry}
 */
export const related = cell => {
    const [first, ...rest] = cell
    if (first === undefined || first[0] !== 'text' || !isOpen(first[1])) { return cell }
    const head = first[1].slice('open'.length).trimStart()
    if (!head.startsWith('(')) { return head === '' ? rest : [['text', head], ...rest] }
    /** @type {Entry} */
    const inner = [['text', head.slice(1)], ...rest]
    const last = inner[inner.length - 1]
    if (last[0] !== 'text' || !last[1].endsWith(')')) { return inner }
    /** @type {Inline} */
    const end = ['text', last[1].slice(0, -1)]
    return [...inner.slice(0, -1), end].filter(span => span[0] !== 'text' || span[1] !== '')
}

/**
 * The register's **open** rows, in the register's order: every table row
 * whose third cell, **Why**, opens with the word `open`.
 *
 * @type {(text: string) => Result<readonly OpenRow[], string>}
 */
export const openRows = text => {
    const blocks = tryParseBlocks(text)
    if (blocks[0] === 'error') { return error(`${registerPath} is not read here: ${blocks[1]}`) }
    /** @type {readonly OpenRow[]} */
    let rows = []
    for (const block of blocks[1]) {
        if (block[0] !== 'table') { continue }
        for (const [id, construct, why] of block[3]) {
            // a table of fewer than three columns is no register's
            if (why === undefined) { continue }
            if (!isOpen(words(why))) { continue }
            rows = [...rows, { id: words(id), construct, related: related(why) }]
        }
    }
    return ok(rows)
}

/**
 * What `fjs compile` answers for a sample as the file `name`, with the
 * module an import sample imports beside it, as on a refused construct's
 * page.
 *
 * @type {(name: string) => (text: string) => Result<Marked, OutputRefusal>}
 */
const compileSample = compileAs

/**
 * What `fjs compile` answers for a row's sample, the file named after the
 * row: refused, with the line it prints; accepted; or no sample to ask.
 *
 * @type {(id: string, sample: string | undefined) => readonly ['refused', string] | readonly ['accepted'] | readonly ['missing']}
 */
export const verdict = (id, sample) => {
    if (sample === undefined) { return ['missing'] }
    const r = compileSample(`${id}.mjs`)(sample)
    return r[0] === 'ok' ? ['accepted'] : ['refused', reportText(sample)(r[1])]
}

/**
 * Where a link in a register cell goes: as the register's README page would
 * send it, a directory to its page and a file to the file. TODO directories
 * have no generated page, so their README links keep pointing to the file.
 *
 * @type {(href: string) => Result<string, string>}
 */
const cellHref = resolveHref(null)(path => !isTodoDir(path) && !basename(path).includes('.'))(parent(registerPath))

/** A register cell, as its README would render it, or its words where it cannot. @type {(cell: Entry) => readonly Node[]} */
const cellNodes = cell => {
    const r = readmeNodes(cellHref)([['paragraph', /** @type {readonly Inline[]} */ (cell)]])
    return r[0] === 'ok' ? r[1] : [words(cell)]
}

/** @type {(id: string, sample: string | undefined) => readonly Node[]} */
const verdictNodes = (id, sample) => {
    const v = verdict(id, sample)
    return v[0] === 'refused' ? [['div', { [codeMarker]: '', [resultMarker]: 'error' }, ['pre', v[1]]]]
        : v[0] === 'accepted' ? [['p', { [resultMarker]: 'ok' }, 'Accepted now: the row is out of date.']]
        : [['p', {}, 'No sample yet.']]
}

/** A labelled register cell, as a line of its own. @type {(label: string, cell: Entry) => readonly Node[]} */
const cellLine = (label, cell) => cell.length === 0 ? [] : [
    ['div', {}, ['strong', {}, `${label}: `], ...cellNodes(cell)]]

/**
 * One open row as a card: its ID, what the register says of it, the sample,
 * and what `fjs compile` prints for the sample. A card rather than a table
 * row, since the sample and the compiler's line are code that a narrow
 * column would wrap.
 *
 * @type {(samples: StringMap<string>) => (row: OpenRow) => Element}
 */
const rowView = samples => ({ id, construct, related: rel }) => {
    const sample = samples[id]
    return ['section', { id, [registerRowMarker]: '' },
        ['h3', {}, ['code', id]],
        ...cellLine('Construct', construct),
        ...cellLine('Related', rel),
        ...(sample === undefined ? [] : [
            caption(`${id}.mjs:`),
            /** @type {Node} */ (['div', { [codeMarker]: '' }, ['pre', sample]]),
            caption('What fjs compile prints:')]),
        ...verdictNodes(id, sample)]
}

/** @type {(samples: StringMap<string>) => (rows: readonly OpenRow[]) => string} */
const summary = samples => rows => {
    const verdicts = rows.map(({ id }) => verdict(id, samples[id])[0])
    /** @type {(kind: string) => number} */
    const count = kind => verdicts.filter(v => v === kind).length
    return `${rows.length} open rows: ${count('refused')} refused today, ${count('accepted')} accepted, ${count('missing')} without a sample.`
}

/**
 * The samples named for no open row: a row decided, or renamed, while its
 * sample stayed here.
 *
 * @type {(samples: StringMap<string>) => (rows: readonly OpenRow[]) => readonly string[]}
 */
export const strays = samples => rows => Object.keys(samples).filter(id => !rows.some(row => row.id === id))

/** @type {(samples: StringMap<string>) => (rows: readonly OpenRow[]) => readonly Node[]} */
const strayView = samples => rows => {
    const ids = strays(samples)(rows)
    return ids.length === 0 ? [] : [
        ['p', { [resultMarker]: 'error' }, `Samples for rows that are no longer open: ${ids.join(', ')}.`]]
}

/** @type {readonly Node[]} */
const banner = [
    ['div', { [undecidedMarker]: '' },
        ['strong', {}, 'Not decided yet'],
        ['p', {}, 'Each construct below is valid JavaScript that fjs compile refuses today, while no record says whether it stays out of FunctionalScript or comes in.']],
]

/** @type {(samples: StringMap<string>) => (text: string) => readonly Node[]} */
const registerView = samples => text => {
    const rows = openRows(text)
    if (rows[0] === 'error') { return [['p', { [resultMarker]: 'error' }, rows[1]]] }
    return [
        ['p', {}, summary(samples)(rows[1])],
        ...strayView(samples)(rows[1]),
        ...rows[1].map(rowView(samples)),
    ]
}

/** @type {(samples: StringMap<string>) => (state: State) => Element} */
export const view = samples => ({ register }) => ['div', {}, ...banner, ...loadedView(register, registerView(samples))]

/**
 * Fetches the register on `start`; a register that does not arrive is the
 * reason the page shows no rows.
 *
 * @type {(state: State) => (event: DemoEvent) => Effect<FetchText, State, never>}
 */
export const update = state => event => event.kind === 'start'
    ? mapStep(fetchFile(parent(registerPath), basename(registerPath)), register => ({ register }))
    : pureOk(state)

/**
 * The page over `samples`, one module by open row ID: the page's own are
 * [`samples.f.mjs`](./samples.f.mjs), and a proof writes others.
 *
 * @type {(samples: StringMap<string>) => Demo<State, DemoEvent, FetchText>}
 */
export const undecidedDemo = samples => ({ init, update, view: view(samples) })

/** @type {Demo<State, DemoEvent, FetchText>} */
export const demo = undecidedDemo(samples)
