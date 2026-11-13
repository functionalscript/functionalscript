/**
 * Type-level API for `fjs/media/mermaid/module.f.js`: a Mermaid flowchart,
 * as the nodes and edges its text declares.
 *
 * @module
 */

/**
 * The direction a flowchart's header names: left to right, right to left,
 * top to bottom (`TB` or `TD`), or bottom to top.
 */
export type Direction = 'LR' | 'RL' | 'TB' | 'TD' | 'BT'

/**
 * A node: the name the text calls it by, and the label it shows, which is
 * its name where the text gives it none. A label's line breaks are `\n`.
 */
export type FlowNode = {
    readonly id: string
    readonly label: string
}

/**
 * An arrow between two nodes, by their indices in {@link Flowchart}'s
 * `nodes`, with its label, empty for none. `both` is an arrow with a head at
 * each end, `<-->`.
 */
export type FlowEdge = {
    readonly from: number
    readonly to: number
    readonly label: string
    readonly both: boolean
}

/**
 * A flowchart: its direction, its nodes in the order the text first names
 * them, and its arrows in the order the text writes them.
 */
export type Flowchart = {
    readonly direction: Direction
    readonly nodes: readonly FlowNode[]
    readonly edges: readonly FlowEdge[]
}
