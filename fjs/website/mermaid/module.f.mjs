/**
 * A README's Mermaid flowchart, drawn at build time with the site's own
 * graph renderer ([`demo/graph`](../demo/graph/module.f.mjs)), as GitHub
 * draws it with Mermaid ([mermaid-diagrams](../todo/mermaid-diagrams.md)).
 *
 * **What it draws is what [`media/mermaid`](../../media/mermaid/module.f.js)
 * reads,** less what the renderer cannot draw as a flowchart means it; any
 * other fence is refused, and the README shows it as its source. The
 * renderer draws a node's labelled arrows as rows, each naming its label,
 * and a row for an arrow with none beside them names the node it leads to.
 * A row is one line, so an arrow label of several lines is refused; a
 * node's label may have several, and the renderer stacks them.
 *
 * **The picture keeps the content, not the layout.** Every diagram reads
 * left to right, whatever direction it names; `<-->` is an arrow each way;
 * and an arrow that closes a cycle is drawn as the renderer draws a return,
 * dotted, so the rest ranks left to right around it.
 *
 * @module
 *
 * @import { Element } from '../../media/html/types.ts'
 * @import { Flowchart } from '../../media/mermaid/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Graph } from '../demo/graph/types.ts'
 */

import { tryFlowchart } from '../../media/mermaid/module.f.js'
import { error, ok } from '../../types/result/module.f.js'
import { graphSvg, ranked } from '../demo/graph/module.f.mjs'

/**
 * The edges depth-first search finds closing a cycle, by index: from each
 * node not yet reached, in order, an edge to a node on the current path.
 * Marked `back`, they leave the rest of the graph without a cycle.
 *
 * @type {(count: number, edges: readonly { readonly from: number, readonly to: number }[]) => readonly number[]}
 */
const cycleEdges = (count, edges) => {
    /** @typedef {{ readonly seen: readonly number[], readonly back: readonly number[] }} Search */
    /** @type {(path: readonly number[], search: Search) => Search} */
    const visit = (path, search) => edges.reduce((s, { from, to }, i) => from !== path[path.length - 1] ? s
        : path.includes(to) ? { ...s, back: [...s.back, i] }
        : s.seen.includes(to) ? s
        : visit([...path, to], { ...s, seen: [...s.seen, to] }), search)
    /** @type {Search} */
    const start = { seen: [], back: [] }
    return Array.from({ length: count }, (_, n) => n)
        .reduce((s, n) => s.seen.includes(n) ? s : visit([n], { ...s, seen: [...s.seen, n] }), start)
        .back
}

/**
 * A flowchart as the renderer's graph: a node per node, an edge per arrow
 * and two per `<-->`, the edges closing a cycle marked `back`.
 *
 * @type {(chart: Flowchart) => Result<Graph, string>}
 */
export const flowchartGraph = ({ nodes, edges }) => {
    const arrows = edges.flatMap(({ from, to, label, both }) => both
        ? [{ from, to, label }, { from: to, to: from, label }]
        : [{ from, to, label }])
    const broken = arrows.find(({ label }) => label.includes('\n'))
    if (broken !== undefined) { return error(`an arrow label of several lines, which a row does not draw: ${nodes[broken.from].id}`) }
    const back = cycleEdges(nodes.length, arrows)
    const marked = arrows.map((e, i) => back.includes(i) ? { ...e, back: true } : e)
    return ok({
        nodes: ranked(nodes.map(({ label }, id) => ({ id, kind: 'flowchart', label })), marked),
        edges: marked,
        centerColumns: true,
    })
}

/**
 * A `mermaid` fence's text as its drawing, or why it is not drawn.
 *
 * @type {(text: string) => Result<Element, string>}
 */
export const flowchartSvg = text => {
    const chart = tryFlowchart(text)
    if (chart[0] === 'error') { return chart }
    const graph = flowchartGraph(chart[1])
    return graph[0] === 'error' ? graph : ok(graphSvg(graph[1]))
}
