/**
 * Type-level API for `fjs/website/demo/versions/module.f.mjs`: a demo of a
 * persistent structure keyed by integers, drawn as its version before a step
 * and its version after it, in one graph.
 *
 * @module
 */

import type { Demo, DemoEvent } from '../types.ts'
import type { Corner, Graph, Inline } from '../graph/types.ts'

/**
 * One part of a node: an edge to a child node, or a value drawn in a row
 * of its own.
 *
 * - A child with a `label` leaves from a row of its own, named — a
 *   B-tree's `Left`, `Middle`, `Right`.
 * - A child with a `corner` takes no row and leaves from that point of the
 *   node's right side — the top for its first child, the bottom for its
 *   last.
 * - A value with an empty `label` is drawn alone, filling its row, and
 *   `parts` draws it in pieces, as an {@link Inline}'s do.
 */
export type Row<N> =
    | { readonly label: string, readonly to: N }
    | { readonly to: N, readonly corner: Corner }
    | { readonly label: string, readonly inline: string, readonly parts?: Inline['parts'] }

/**
 * How a reader types a key and reads one back: `parse` answers `null` for a
 * text that is no key, `show` spells a key as the field and the step line
 * do, `label` names the field, and `accepts` finishes the sentence "type …"
 * when a key is refused.
 */
export type Keys = {
    readonly parse: (text: string) => number | null
    readonly show: (key: number) => string
    readonly label: string
    readonly accepts: string
}

/**
 * Which column a node is drawn in.
 *
 * - `leaves` — every leaf in the last column, a node as far left as its
 *   height above the leaves: right for a balanced structure, whose leaves
 *   are all equally deep.
 * - `depth` — a node one column right of its deepest parent: right for an
 *   unbalanced one, whose shallow leaves would otherwise be stretched to the
 *   last column.
 */
export type Layout = 'leaves' | 'depth'

/**
 * How the drawing reads a structure's nodes. Two nodes are the same node
 * when they are `===`: an object for a structure that shares by reference,
 * a hash for one that shares by content.
 *
 * `order` is a node's place in its column, top to bottom — its keys'
 * average, or its smallest key.
 */
export type Shape<N> = {
    readonly rows: (node: N) => readonly Row<N>[]
    readonly title: (node: N) => string
    readonly order: (node: N) => number
    readonly layout: Layout
}

/** A structure's version before the last step, and after it. */
export type Versions<V> = {
    readonly before: V
    readonly after: V
}

/**
 * What the demo needs to know about a persistent structure: its empty
 * version, how a key goes in and comes out, a version's root, and how to
 * read the nodes of two versions.
 *
 * `insert` and `remove` answer the version they were given when they change
 * nothing — that is not required, since a step is judged by what it built
 * rather than by identity, but it is cheaper.
 *
 * `shape` takes both versions because a structure that shares by content
 * may need both to look a node up.
 */
export type Structure<V, N> = {
    readonly empty: V
    readonly insert: (key: number) => (version: V) => V
    readonly remove: (key: number) => (version: V) => V
    readonly root: (version: V) => N | null
    readonly shape: (versions: Versions<V>) => Shape<N>
}

/** The step behind the drawing. */
export type Step = {
    readonly op: 'insert' | 'remove'
    readonly key: number
}

/**
 * What the drawing shows: a preset as it was loaded — its name, and the
 * hint saying which button to press — or the step that turned the old
 * version into the new one.
 */
export type Status =
    | { readonly preset: string, readonly hint: string }
    | { readonly step: Step }

/**
 * The demo's state: the key field as typed, the two versions, what they
 * show, and why the last press did nothing, if it did nothing.
 */
export type State<V> = {
    readonly key: string
    readonly versions: Versions<V>
    readonly status: Status
    readonly error: string | null
}

/**
 * A preset: its name, the keys whose inserts build its starting version,
 * the key it puts in the field, and the hint naming the button to press.
 */
export type Preset = readonly [name: string, keys: readonly number[], key: number, hint: string]

/**
 * How many nodes a step built, how many both versions hold, and how many
 * only the old one holds.
 */
export type Census = {
    readonly built: number
    readonly shared: number
    readonly replaced: number
}

/**
 * Everything a demo of one structure says about itself.
 *
 * - `name` — the key field's `name` prefix and `id`, unique on its page;
 * - `noun` — what one version is called: `tree`, `trie`;
 * - `intro` — the paragraph above the controls;
 * - `keys` — how keys are typed and read back; any safe integer, in
 *   decimal, when it is absent.
 */
export type Options<V, N> = {
    readonly structure: Structure<V, N>
    readonly name: string
    readonly noun: string
    readonly intro: string
    readonly keys?: Keys | undefined
    readonly presets: readonly Preset[]
}

/**
 * A versions demo, and the parts of it its proofs reach for: loading a
 * preset by name, pressing a button, the graph of two versions, and what a
 * step built.
 */
export type VersionsDemo<V> = {
    readonly demo: Demo<State<V>, DemoEvent>
    readonly load: (name: string) => State<V>
    readonly press: (op: Step['op']) => (state: State<V>) => State<V>
    readonly graphOf: (versions: Versions<V>) => Graph
    readonly census: (versions: Versions<V>) => Census
}
