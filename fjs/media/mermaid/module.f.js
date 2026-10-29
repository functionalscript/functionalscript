/**
 * A Mermaid flowchart, read from a code fence's text: the subset the
 * repository's READMEs write, refused whole where the text leaves it.
 *
 * GitHub draws a `mermaid` fence as a diagram; the site draws the flowcharts
 * it can read the same way ([mermaid-diagrams](../../website/todo/mermaid-diagrams.md)),
 * and keeps any other fence as its source. So this reads what it is sure
 * of and refuses the rest rather than drawing a guess: a refusal costs the
 * reader a picture, a guess could cost them the right one.
 *
 * **The subset**, one statement a line:
 *
 * - a header, `flowchart` and a direction, `LR`, `RL`, `TB`, `TD` or `BT`;
 * - a node, as its name, letters, digits and `_`, or its name and a label
 *   in quotes and brackets, `a["A label"]`;
 * - a chain of nodes joined by arrows, `a --> b --> c`, each arrow `-->`,
 *   or `<-->` with a head at each end, and optionally labelled, `-->|label|`.
 *
 * Blank lines are skipped. Anything else — another kind of diagram, a
 * comment, a node shape other than a box, a `;` or `&`, a dotted or thick
 * arrow — is refused, with the line it is on. So is a flowchart of more
 * than {@link maxEdges} arrows, which Mermaid refuses to draw.
 *
 * **A label is plain text.** Mermaid reads `<br/>`, `#quot;`, `&amp;`, a
 * backtick's Markdown and a quote's delimiting inside a label, so a label
 * holding `<`, `>`, `&`, `#`, `\`, a backtick or `"` is refused rather than
 * drawn as its spelling. A
 * node labelled twice is refused unless both labels agree. Mermaid's statement
 * keywords `end`, `classDef`, `class`, `style` and `subgraph` are no names.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { Direction, FlowEdge, Flowchart } from './types.ts'
 * @import { _Named } from './private.ts'
 */

import { charIs, isDigit, isLatinLetter } from '../../text/ascii/module.f.js'
import { error, ok } from '../../types/result/module.f.js'

/** The directions a header may name. @type {readonly Direction[]} */
export const directions = ['LR', 'RL', 'TB', 'TD', 'BT']

/**
 * The most arrows Mermaid draws: its `maxEdges` setting's default. Over it,
 * GitHub shows an error in place of the diagram.
 * @type {number}
 */
export const maxEdges = 500

/** @type {(c: string) => boolean} */
const isNameChar = c => charIs(isLatinLetter)(c) || charIs(isDigit)(c) || c === '_'

/** Mermaid statement keywords, which cannot name nodes. @type {readonly string[]} */
const keywords = ['end', 'classDef', 'class', 'style', 'subgraph']

/**
 * What Mermaid reads inside a label rather than showing — markup, and a
 * quote, which delimits a label, `-->|"text"|` included — and a plain label
 * therefore never holds.
 * @type {string}
 */
const markup = '<>&#\\`"'

/** @type {(line: string, at: number) => number} */
const skipSpaces = (line, at) => {
    let i = at
    while (line[Number(i)] === ' ' || line[Number(i)] === '\t') { i = i + 1 }
    return i
}

/**
 * A label from `at` to its closing `close`, and the index after it.
 *
 * @type {(line: string, at: number, close: string) => Result<readonly [string, number], string>}
 */
const labelAt = (line, at, close) => {
    const end = line.indexOf(close, at)
    if (end === -1) { return error(`a label not closed by ${close}`) }
    const label = line.slice(at, end)
    if (label === '') { return error('an empty label') }
    const c = [...label].find(c => markup.includes(c))
    if (c !== undefined) { return error(`a label holding ${c}, which Mermaid does not show as written`) }
    return ok([label, end + close.length])
}

/**
 * A node at `at`: its name, then a label in `["…"]` if one follows at once.
 *
 * @type {(line: string, at: number) => Result<readonly [_Named, number], string>}
 */
const nodeAt = (line, at) => {
    let end = at
    while (end < line.length && isNameChar(line[Number(end)])) { end = end + 1 }
    const id = line.slice(at, end)
    if (id === '') { return error(`a node expected at ${at}`) }
    if (keywords.includes(id)) { return error(`a node named ${id}, which Mermaid reads as a keyword`) }
    if (!line.startsWith('["', end)) { return ok([[id, null], end]) }
    const label = labelAt(line, end + 2, '"]')
    if (label[0] === 'error') { return label }
    return ok([[id, label[1][0]], label[1][1]])
}

/**
 * An arrow at `at` — whether it has two heads, and its label — and the
 * index after it, or `null` where none starts there.
 *
 * @type {(line: string, at: number) => Result<readonly [readonly [boolean, string], number] | null, string>}
 */
const arrowAt = (line, at) => {
    const both = line.startsWith('<-->', at)
    if (!both && !line.startsWith('-->', at)) { return ok(null) }
    const after = at + (both ? 4 : 3)
    if (line[Number(after)] !== '|') { return ok([[both, ''], after]) }
    const label = labelAt(line, after + 1, '|')
    if (label[0] === 'error') { return label }
    return ok([[both, label[1][0]], label[1][1]])
}

/**
 * One statement's nodes, and the arrows between each and the next.
 *
 * @type {(line: string) => Result<readonly [readonly _Named[], readonly (readonly [boolean, string])[]], string>}
 */
const statementOf = line => {
    const first = nodeAt(line, skipSpaces(line, 0))
    if (first[0] === 'error') { return first }
    /** @type {readonly _Named[]} */
    let nodes = [first[1][0]]
    /** @type {readonly (readonly [boolean, string])[]} */
    let arrows = []
    let at = skipSpaces(line, first[1][1])
    while (at < line.length) {
        const arrow = arrowAt(line, at)
        if (arrow[0] === 'error') { return arrow }
        if (arrow[1] === null) { return error(`an arrow or the line's end expected at ${at}`) }
        const node = nodeAt(line, skipSpaces(line, arrow[1][1]))
        if (node[0] === 'error') { return node }
        nodes = [...nodes, node[1][0]]
        arrows = [...arrows, arrow[1][0]]
        at = skipSpaces(line, node[1][1])
    }
    return ok([nodes, arrows])
}

/**
 * The nodes with `named` among them, and its index: a new name is added at
 * the end, and a label given to a name already known is set on it, unless
 * it already has another.
 *
 * @type {(nodes: readonly _Named[], named: _Named) => Result<readonly [readonly _Named[], number], string>}
 */
const withNode = (nodes, named) => {
    const [id, label] = named
    const i = nodes.findIndex(([known]) => known === id)
    if (i === -1) { return ok([[...nodes, named], nodes.length]) }
    const [, was] = nodes[Number(i)]
    if (label === null || label === was) { return ok([nodes, i]) }
    if (was !== null) { return error(`a node labelled twice: ${id}`) }
    return ok([nodes.map((n, k) => k === i ? named : n), i])
}

/**
 * A flowchart from a `mermaid` fence's text, or why it is not one this
 * reads, with the line it is on.
 *
 * @type {(text: string) => Result<Flowchart, string>}
 */
export const tryFlowchart = text => {
    const lines = text.split('\n')
    const start = lines.findIndex(l => l.trim() !== '')
    const header = start === -1 ? [] : lines[Number(start)].trim().split(' ').filter(w => w !== '')
    const direction = directions.find(d => d === header[1])
    if (header.length !== 2 || header[0] !== 'flowchart' || direction === undefined) {
        return error('a diagram other than a flowchart with a direction')
    }
    /** @type {readonly _Named[]} */
    let nodes = []
    /** @type {readonly FlowEdge[]} */
    let edges = []
    let k = start
    while (k + 1 < lines.length) {
        k = k + 1
        const line = lines[Number(k)]
        if (line.trim() === '') { continue }
        const statement = statementOf(line)
        if (statement[0] === 'error') { return error(`line ${k + 1}: ${statement[1]}`) }
        const [named, arrows] = statement[1]
        /** @type {readonly number[]} */
        let indices = []
        while (indices.length < named.length) {
            const added = withNode(nodes, named[Number(indices.length)])
            if (added[0] === 'error') { return error(`line ${k + 1}: ${added[1]}`) }
            nodes = added[1][0]
            indices = [...indices, added[1][1]]
        }
        const ends = indices
        edges = [...edges, ...arrows.map(([both, label], i) => ({ from: ends[Number(i)], to: ends[Number(i + 1)], label, both }))]
    }
    if (edges.length > maxEdges) { return error(`more than ${maxEdges} arrows, which Mermaid does not draw`) }
    return ok({ direction, nodes: nodes.map(([id, label]) => ({ id, label: label ?? id })), edges })
}
