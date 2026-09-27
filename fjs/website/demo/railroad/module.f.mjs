/**
 * A syntax diagram — a railroad — laid out and drawn as SVG: the shared half
 * of any demo that shows a grammar. A demo turns its grammar into a
 * {@link Diagram}; this module measures it and draws it.
 *
 * **Every piece is laid out around its own track.** A piece is measured as
 * its width along the track and how far it reaches above and below it, and
 * drawn with the track entering at its left end and leaving at its right, on
 * one horizontal line. A sequence joins its pieces end to end, so the track
 * is one straight line through them however tall any one of them is.
 *
 * **A choice keeps its first piece on the track**, and stacks the others
 * below it, each on a branch that curves down from the track before it and
 * back up after it. So an optional piece — a choice whose first piece is
 * `skip` — reads as the track running straight past what it may skip.
 *
 * **A loop returns underneath**, right to left, through its separator, with
 * an arrow on the way back up: the only piece of track a reader follows
 * against the diagram's direction, so the only one that says which way it
 * runs. What the return passes through is laid out mirrored, so a reader
 * following it meets a separator's pieces in their order — `,` before
 * `ws` in `, ws` — and a loop inside it turns back the other way again.
 *
 * **A box for another diagram is a link to it.** `anchor` is the id of the
 * element holding that diagram, and `railroadSection` is that element, so a
 * page and this module spell the id once.
 *
 * The geometry is the layout of json.org's diagrams, and of the railroad
 * diagrams a reader has met in any language specification.
 *
 * @module
 *
 * @import { Diagram } from './types.ts'
 * @import { Demo, DemoEvent } from '../types.ts'
 * @import { Element } from '../../../media/html/types.ts'
 * @import { _Size } from './private.ts'
 */

import { pureOk } from '../../../effects/module.f.mjs'

const boxHalf = 11
const arc = 10
const rowGap = 10
const itemGap = 12
const charWidth = 8
const margin = 10
const stub = 8

/** @type {(values: readonly number[]) => number} */
const sum = values => values.reduce((s, v) => s + v, 0)

/** @type {(values: readonly number[]) => number} */
const max = values => values.reduce((m, v) => Math.max(m, v), 0)

/** @type {(label: string) => number} */
const labelWidth = label => Math.max(28, label.length * charWidth + 16)

/**
 * The id of the element that holds the diagram named `name`: what a
 * `nonTerminal` box links to.
 *
 * @type {(name: string) => string}
 */
export const anchor = name => `railroad-${name}`

/** @type {(d: string) => Element} */
const path = d => ['path', { d, 'data-railroad-line': '' }]

/** @type {(x0: number, x1: number, y: number) => Element} */
const line = (x0, x1, y) => path(`M${x0} ${y}L${x1} ${y}`)

/**
 * How far below one row of a choice or a loop the next row's track runs:
 * clear of both rows' boxes, and never so close that its branch has no room
 * for the two curves it turns through.
 *
 * @type {(above: _Size, below: _Size) => number}
 */
const drop = (above, below) => Math.max(2 * arc, above.down + rowGap + below.up)

/**
 * Where each row of a choice runs, below the first row's track.
 *
 * @type {(sizes: readonly _Size[]) => readonly number[]}
 */
const rowOffsets = sizes => {
    /** @type {readonly number[]} */
    const first = [0]
    return sizes.slice(1).reduce((offsets, size, k) => [...offsets, offsets[k] + drop(sizes[k], size)], first)
}

/** @type {(d: Diagram) => _Size} */
const measure = d => {
    switch (d[0]) {
        case 'terminal':
        case 'nonTerminal':
            return { width: labelWidth(d[1]), up: boxHalf, down: boxHalf }
        case 'skip':
            return { width: 0, up: 0, down: 0 }
        case 'sequence': {
            const sizes = d[1].map(measure)
            return {
                width: sum(sizes.map(s => s.width)) + itemGap * Math.max(0, sizes.length - 1),
                up: max(sizes.map(s => s.up)),
                down: max(sizes.map(s => s.down)),
            }
        }
        case 'choice': {
            const sizes = d[1].map(measure)
            const last = sizes.length - 1
            return {
                width: max(sizes.map(s => s.width)) + 4 * arc,
                up: sizes[0].up,
                down: rowOffsets(sizes)[last] + sizes[last].down,
            }
        }
        case 'loop': {
            const [, item, separator] = d
            const i = measure(item)
            const s = measure(separator)
            return { width: Math.max(i.width, s.width) + 4 * arc, up: i.up, down: drop(i, s) + s.down }
        }
    }
}

/**
 * A terminal's pill or a non-terminal's box, and its label.
 *
 * @type {(kind: 'terminal' | 'nonTerminal', rx: number) => (label: string) => (x: number, y: number) => readonly Element[]}
 */
const box = (kind, rx) => label => (x, y) => {
    const width = labelWidth(label)
    return [
        ['rect', {
            x: String(x), y: String(y - boxHalf), width: String(width), height: String(2 * boxHalf), rx: String(rx),
            'data-railroad-box': kind,
        }],
        ['text', { x: String(x + width / 2), y: String(y), 'text-anchor': 'middle', 'data-railroad-label': kind }, label],
    ]
}

const terminalBox = box('terminal', boxHalf)

const nonTerminalBox = box('nonTerminal', 3)

/**
 * `d` centred in a row `inner` wide, with track either side of it out to the
 * row's ends.
 *
 * @type {(inner: number, backward: boolean) => (d: Diagram) => (x: number, y: number) => readonly Element[]}
 */
const padded = (inner, backward) => d => (x, y) => {
    const { width } = measure(d)
    const left = x + (inner - width) / 2
    return [line(x, left, y), ...draw(backward)(d)(left, y), line(left + width, x + inner, y)]
}

/**
 * `d` with its track's left end at `(x, y)`, read left to right, or right
 * to left when `backward`: a loop's return track runs back under it, so
 * what that track passes through is laid out mirrored — a sequence's first
 * piece at its right end, where a reader following the track meets it
 * first. The pieces themselves are not mirrored: a label reads left to
 * right whichever way its track runs.
 *
 * @type {(backward: boolean) => (d: Diagram) => (x: number, y: number) => readonly Element[]}
 */
const draw = backward => d => (x, y) => {
    switch (d[0]) {
        case 'terminal':
            return terminalBox(d[1])(x, y)
        case 'nonTerminal':
            return [['a', { href: `#${anchor(d[1])}` }, ...nonTerminalBox(d[1])(x, y)]]
        case 'skip':
            return []
        case 'sequence': {
            const items = backward ? d[1].toReversed() : d[1]
            /** @type {readonly number[]} */
            const first = [x]
            const xs = items.slice(0, -1).reduce((acc, item, k) => [...acc, acc[k] + measure(item).width + itemGap], first)
            return [
                ...xs.slice(1).map(right => line(right - itemGap, right, y)),
                ...items.flatMap((item, k) => draw(backward)(item)(xs[k], y)),
            ]
        }
        case 'choice': {
            const [first, ...rest] = d[1]
            const sizes = d[1].map(measure)
            const offsets = rowOffsets(sizes)
            const inner = max(sizes.map(s => s.width))
            const row = padded(inner, backward)
            const left = x + 2 * arc
            const right = left + inner
            const end = right + 2 * arc
            return [
                line(x, left, y), ...row(first)(left, y), line(right, end, y),
                ...rest.flatMap((item, k) => {
                    const yk = y + offsets[k + 1]
                    return [
                        path(`M${x} ${y}Q${x + arc} ${y} ${x + arc} ${y + arc}L${x + arc} ${yk - arc}Q${x + arc} ${yk} ${left} ${yk}`),
                        ...row(item)(left, yk),
                        path(`M${right} ${yk}Q${end - arc} ${yk} ${end - arc} ${yk - arc}L${end - arc} ${y + arc}Q${end - arc} ${y} ${end} ${y}`),
                    ]
                }),
            ]
        }
        case 'loop': {
            const [, item, separator] = d
            const i = measure(item)
            const s = measure(separator)
            const inner = Math.max(i.width, s.width)
            const left = x + 2 * arc
            const right = left + inner
            const end = right + 2 * arc
            const back = y + drop(i, s)
            const middle = (y + back) / 2
            // The arrow on the left side points the way the return runs
            // there: up to the start of the item, or, on a backward
            // track, down from its end.
            const up = backward ? -1 : 1
            return [
                line(x, left, y), ...padded(inner, backward)(item)(left, y), line(right, end, y),
                path(`M${right} ${y}Q${end - arc} ${y} ${end - arc} ${y + arc}L${end - arc} ${back - arc}Q${end - arc} ${back} ${right} ${back}`),
                ...padded(inner, !backward)(separator)(left, back),
                path(`M${left} ${back}Q${x + arc} ${back} ${x + arc} ${back - arc}L${x + arc} ${y + arc}Q${x + arc} ${y} ${left} ${y}`),
                path(`M${x + arc - 4} ${middle + 4 * up}L${x + arc} ${middle - 3 * up}L${x + arc + 4} ${middle + 4 * up}`),
            ]
        }
    }
}

/**
 * `d` drawn as one SVG, between a bar where the diagram starts and a bar
 * where it ends, in a container of its own: a diagram is as wide as its
 * longest sequence, often wider than the page, and the container is what
 * scrolls sideways rather than the whole page.
 *
 * @type {(d: Diagram) => Element}
 */
export const railroadSvg = d => {
    const { width, up, down } = measure(d)
    const x = margin + stub
    const y = margin + Math.max(up, stub)
    const end = x + width
    const svgWidth = end + stub + margin
    const svgHeight = y + Math.max(down, stub) + margin
    return ['div', { 'data-railroad': '' }, ['svg', {
        viewBox: `0 0 ${svgWidth} ${svgHeight}`, width: String(svgWidth), height: String(svgHeight),
    },
        path(`M${margin} ${y - stub}L${margin} ${y + stub}M${margin} ${y}L${x} ${y}`),
        ...draw(false)(d)(x, y),
        path(`M${end} ${y}L${end + stub} ${y}M${end + stub} ${y - stub}L${end + stub} ${y + stub}`),
    ]]
}

/**
 * A titled diagram as a section of a page: its title, and the diagram, in
 * the element whose id is the one every box for it links to.
 *
 * @type {(titled: readonly [string, Diagram]) => Element}
 */
export const railroadSection = ([title, d]) => ['section', { id: anchor(title) }, ['h3', title], railroadSvg(d)]

/**
 * A demo that is its diagrams: `intro`, then a section per titled diagram.
 * A grammar's page shows what the grammar is, and nothing a reader does
 * changes that, so the demo has no state and needs no operations: `update`
 * returns the state it was given through `pureOk`.
 *
 * @type {(intro: string) => (diagrams: readonly (readonly [string, Diagram])[]) => Demo<null, DemoEvent>}
 */
export const railroadDemo = intro => diagrams => {
    /** @type {Element} */
    const view = ['div', ['p', intro], ...diagrams.map(railroadSection)]
    return { init: null, update: state => () => pureOk(state), view: () => view }
}
