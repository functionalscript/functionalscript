import { assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { error, ok } from '../../types/result/module.f.js'
import { directions, tryFlowchart } from './module.f.js'

/** The refusal of `text`, or `null` where it is read. @type {(text: string) => string | null} */
const refusal = text => {
    const r = tryFlowchart(text)
    return r[0] === 'error' ? r[1] : null
}

export const proof = {
    directions: () => assertEq(directions.join(), 'LR,RL,TB,TD,BT'),
    // Every form the subset reads, at once.
    reads: () => assertStructurallySame(tryFlowchart([
        '',
        'flowchart TD',
        '    a["A label"] -->|on| b',
        '',
        '\tb <--> c-->|x y|d',
        '    a',
        '    b["B"]',
        '    b["B"] --> a  ',
    ].join('\n')), ok({
        direction: 'TD',
        nodes: [{ id: 'a', label: 'A label' }, { id: 'b', label: 'B' }, { id: 'c', label: 'c' }, { id: 'd', label: 'd' }],
        edges: [
            { from: 0, to: 1, label: 'on', both: false },
            { from: 1, to: 2, label: '', both: true },
            { from: 2, to: 3, label: 'x y', both: false },
            { from: 1, to: 0, label: '', both: false },
        ],
    })),
    header: () => assertStructurallySame(tryFlowchart('flowchart LR\n'), ok({ direction: 'LR', nodes: [], edges: [] })),
    quotedNodePunctuation: () => assertStructurallySame(tryFlowchart('flowchart LR\na["f(x)[y]{z}"]\n'),
        ok({ direction: 'LR', nodes: [{ id: 'a', label: 'f(x)[y]{z}' }], edges: [] })),
    refuses: {
        empty: () => assertEq(refusal(''), 'a diagram other than a flowchart with a direction'),
        sequence: () => assertEq(refusal('sequenceDiagram\n    a->>b: x\n'), 'a diagram other than a flowchart with a direction'),
        noDirection: () => assertEq(refusal('flowchart\n'), 'a diagram other than a flowchart with a direction'),
        otherDirection: () => assertEq(refusal('flowchart XY\n'), 'a diagram other than a flowchart with a direction'),
        // `graph` is Mermaid's older spelling, which no README uses.
        graph: () => assertEq(refusal('graph LR\n'), 'a diagram other than a flowchart with a direction'),
        comment: () => assertEq(refusal('flowchart LR\n%% note\n'), 'line 2: a node expected at 0'),
        noTarget: () => assertEq(refusal('flowchart LR\na -->\n'), 'line 2: a node expected at 5'),
        twoNodes: () => assertEq(refusal('flowchart LR\na b\n'), "line 2: an arrow or the line's end expected at 2"),
        dottedArrow: () => assertEq(refusal('flowchart LR\na -.-> b\n'), "line 2: an arrow or the line's end expected at 2"),
        roundNode: () => assertEq(refusal('flowchart LR\na(x)\n'), "line 2: an arrow or the line's end expected at 1"),
        end: () => assertEq(refusal('flowchart LR\na --> end\n'), 'line 2: a node named end, which Mermaid reads as a keyword'),
        keywords: () => {
            for (const name of ['classDef', 'class', 'style', 'subgraph']) {
                const expected = `line 2: a node named ${name}, which Mermaid reads as a keyword`
                assertEq(refusal(`flowchart LR\n${name} --> b\n`), expected)
                assertEq(refusal(`flowchart LR\na --> ${name}\n`), expected)
                assertEq(refusal(`flowchart LR\n${name}["A label"]\n`), expected)
                assertEq(refusal(`flowchart LR\n${name}\n`), expected)
                assertEq(refusal(`flowchart LR\n${name}_node --> b\n`), null)
            }
        },
        unclosedLabel: () => assertEq(refusal('flowchart LR\na["x\n'), 'line 2: a label not closed by "]'),
        emptyLabel: () => assertEq(refusal('flowchart LR\na[""]\n'), 'line 2: an empty label'),
        markup: () => assertEq(refusal('flowchart LR\na["x<br/>y"]\n'), 'line 2: a label holding <, which Mermaid does not show as written'),
        unclosedEdgeLabel: () => assertEq(refusal('flowchart LR\na -->|x b\n'), 'line 2: a label not closed by |'),
        // Mermaid reads a quote as the label's delimiter, not its text.
        quotedEdgeLabel: () => assertEq(refusal('flowchart LR\na -->|"copy"| b\n'), 'line 2: a label holding ", which Mermaid does not show as written'),
        quoteInLabel: () => assertEq(refusal('flowchart LR\na["x"y"]\n'), 'line 2: a label holding ", which Mermaid does not show as written'),
        edgeMarkup: () => assertEq(refusal('flowchart LR\na -->|a&b| b\n'), 'line 2: a label holding &, which Mermaid does not show as written'),
        edgeDelimiters: () => {
            for (const delimiter of '()[]{}') {
                for (const arrow of ['-->', '<-->']) {
                    assertEq(refusal(`flowchart LR\na ${arrow}|f${delimiter}x| b\n`),
                        `line 2: an unquoted edge label holding the syntax delimiter ${delimiter}`)
                }
            }
        },
        labelledTwice: () => assertEq(refusal('flowchart LR\na["x"]\na["y"]\n'), 'line 3: a node labelled twice: a'),
    },
    errorShape: () => assertStructurallySame(tryFlowchart('flowchart LR\n-->\n'), error('line 2: a node expected at 0')),
}
