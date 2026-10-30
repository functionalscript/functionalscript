import { assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { error } from '../../types/result/module.f.js'
import { maxEdges } from '../../media/mermaid/module.f.js'
import { flowchartGraph, flowchartSvg } from './module.f.mjs'

/** @type {(from: number, to: number, label?: string) => import('../../media/mermaid/types.ts').FlowEdge} */
const arrow = (from, to, label = '') => ({ from, to, label, both: false })

/** @type {(count: number) => readonly import('../../media/mermaid/types.ts').FlowNode[]} */
const nodes = count => Array.from({ length: count }, (_, i) => ({ id: `n${i}`, label: `N${i}` }))

/** The edges of a chart's graph, as `from>to` with `!` for a back edge. @type {(chart: import('../../media/mermaid/types.ts').Flowchart) => string} */
const shape = chart => {
    const g = flowchartGraph(chart)
    return g[0] === 'error' ? g[1] : g[1].edges.map(e => `${e.from}>${String(e.to)}${e.back === true ? '!' : ''}`).join(' ')
}

export const proof = /** @type {const} */ ({
    nodes: () => {
        const g = flowchartGraph({ direction: 'TD', nodes: nodes(2), edges: [arrow(0, 1, 'x')] })
        assertStructurallySame(g[0] === 'ok' ? g[1].nodes : null, [
            { id: 0, kind: 'flowchart', label: 'N0', rank: 0 },
            { id: 1, kind: 'flowchart', label: 'N1', rank: 1 },
        ])
    },
    // An arrow that closes a cycle is a back edge; the rest rank around it.
    cycle: () => assertEq(shape({ direction: 'LR', nodes: nodes(3), edges: [arrow(0, 1), arrow(1, 2), arrow(2, 0)] }), '0>1 1>2 2>0!'),
    selfLoop: () => assertEq(shape({ direction: 'LR', nodes: nodes(1), edges: [arrow(0, 0)] }), '0>0!'),
    // `<-->` is an arrow each way, the second closing the cycle they make.
    both: () => assertEq(shape({ direction: 'LR', nodes: nodes(2), edges: [{ from: 0, to: 1, label: '', both: true }] }), '0>1 1>0!'),
    // A node already reached is no cycle; a second start is searched too.
    shared: () => assertEq(shape({ direction: 'LR', nodes: nodes(4), edges: [arrow(0, 2), arrow(1, 2), arrow(2, 3), arrow(1, 3)] }), '0>2 1>2 2>3 1>3'),
    secondStart: () => assertEq(shape({ direction: 'LR', nodes: nodes(3), edges: [arrow(1, 2), arrow(2, 1)] }), '1>2 2>1!'),
    // The longest path the reader admits, `maxEdges` arrows, and a cycle
    // closing it, are searched without running out of stack.
    longest: () => {
        const edges = Array.from({ length: maxEdges }, (_, i) => arrow(i, i + 1 === maxEdges ? 0 : i + 1))
        assertEq(shape({ direction: 'LR', nodes: nodes(maxEdges), edges }).endsWith(`${maxEdges - 1}>0!`), true)
    },
    // An arrow with no label beside labelled ones is a row naming its
    // target; an arrow label of several lines is no row the renderer draws.
    partlyLabelled: () => assertEq(shape({ direction: 'LR', nodes: nodes(3), edges: [arrow(0, 1, 'x'), arrow(0, 2)] }), '0>1 0>2'),
    brokenArrowLabel: () => assertEq(shape({ direction: 'LR', nodes: nodes(2), edges: [arrow(0, 1, 'x\ny')] }),
        'an arrow label of several lines, which a row does not draw: n0'),
    svg: {
        drawn: () => {
            const d = flowchartSvg('flowchart LR\n    a["A"] -->|x| b["B"]\n')
            assertEq(d[0], 'ok')
            assertStructurallySame(d[0] === 'ok' ? d[1].slice(0, 2) : null, ['div', { 'data-graph': '' }])
        },
        notAFlowchart: () => assertStructurallySame(flowchartSvg('pie\n'), error('a diagram other than a flowchart with a direction')),
        notDrawable: () => assertStructurallySame(flowchartSvg('flowchart LR\na -->|x<br/>y| b\n'),
            error('an arrow label of several lines, which a row does not draw: a')),
    },
})
