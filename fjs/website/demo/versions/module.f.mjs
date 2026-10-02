/**
 * A demo of a persistent structure keyed by integers: type a key, press
 * **Insert** or **Remove**, and see the version before the step and the
 * version after it drawn as one graph. The shared half of the B-tree and
 * Patricia trie demos; each supplies only its {@link Structure}.
 *
 * **A node both versions hold is drawn once**, reached from both roots, so
 * the drawing itself shows what the step shared. A structure says what
 * "both hold" means by what `===` compares: the same object for one that
 * shares by reference, the same hash for one that shares by content.
 *
 * **A node's kind says which versions hold it**: `new` only the new one,
 * `replaced` only the old one, `shared` both. The site's stylesheet draws
 * the first blue, the second amber and faded, the third plain; an edge
 * leaving a replaced node, and the arrow into the old root, fade with it.
 * The old root has an arrow only when it is not the new root too.
 *
 * **A step is judged by what it built, not by identity.** One that built
 * nothing and left nothing behind changed nothing, and says so — whether
 * the structure answered the same version or an equal one.
 *
 * **A preset loads a version and a key, and takes no step.** Its version is
 * both versions, so nothing is coloured, and its hint names the button to
 * press: the reader makes the change and sees it happen.
 *
 * @module
 *
 * @import { Census, Keys, Layout, Options, Preset, Row, Shape, State, Step, Structure, Versions, VersionsDemo } from './types.ts'
 * @import { Edge, Graph } from '../graph/types.ts'
 * @import { Element } from '../../../media/html/types.ts'
 */

import { graphSvg } from '../graph/module.f.mjs'
import { examplePicker, name as exampleName } from '../examples/module.f.mjs'
import { pureOk } from '../../../effects/module.f.mjs'
import { assertNotNullish } from '../../../asserts/module.f.mjs'

/**
 * Keys as a reader types them unless a demo says otherwise: any safe
 * integer, in decimal, spelled the way `String` spells it. So `07`, `1e3`
 * and `NaN` are refused — `NaN` has no order for a structure to keep, and
 * the other two would be drawn under a spelling the reader did not type.
 *
 * @type {Keys}
 */
export const decimal = {
    parse: text => {
        const key = Number(text)
        return Number.isSafeInteger(key) && String(key) === text ? key : null
    },
    show: String,
    label: 'Key',
    accepts: 'an integer',
}

/** @type {(kind: string) => number} */
const kindOrder = kind => kind === 'replaced' ? 0 : kind === 'shared' ? 1 : 2

/**
 * Both versions as one graph: one node per distinct node, an arrow into
 * each root, and each column in the shape's `order`, a replaced node above
 * the one in its place.
 *
 * @type {<V, N>(structure: Structure<V, N>) => (versions: Versions<V>) => Graph}
 */
export const graphOf = ({ root, shape }) => versions => {
    const { rows, title, order, layout } = shape(versions)
    /** @typedef {Parameters<typeof rows>[0]} N */
    /** @type {(node: N) => readonly N[]} */
    const childrenOf = node => rows(node).flatMap(row => 'to' in row ? [row.to] : [])
    /** @type {(node: N | null) => readonly N[]} */
    const nodesOf = node => node === null ? [] : [node, ...childrenOf(node).flatMap(nodesOf)]
    const oldRoot = root(versions.before)
    const newRoot = root(versions.after)
    const old = nodesOf(oldRoot)
    const current = nodesOf(newRoot)
    /** @type {(node: N) => string} */
    const kindOf = node => !old.includes(node) ? 'new' : current.includes(node) ? 'shared' : 'replaced'
    const all = [...current, ...old.filter(node => !current.includes(node))]
        .toSorted((a, b) => order(a) - order(b) || kindOrder(kindOf(a)) - kindOrder(kindOf(b)))
    /** @type {(node: N) => number} */
    const heightOf = node => childrenOf(node).reduce((m, child) => Math.max(m, heightOf(child) + 1), 0)
    /** @type {(node: N) => number} */
    const depthOf = node => all.filter(p => childrenOf(p).includes(node)).reduce((m, p) => Math.max(m, depthOf(p) + 1), 0)
    const top = [oldRoot, newRoot].reduce((m, r) => r === null ? m : Math.max(m, heightOf(r)), 0)
    /** @type {Record<Layout, (node: N) => number>} */
    const rankOf = { leaves: node => top - heightOf(node), depth: depthOf }
    return {
        nodes: all.map((node, id) => ({ id, kind: kindOf(node), label: title(node), rank: rankOf[layout](node) })),
        entries: [
            ...(oldRoot === null || oldRoot === newRoot ? [] : [{ to: all.indexOf(oldRoot), kind: 'replaced' }]),
            ...(newRoot === null ? [] : [{ to: all.indexOf(newRoot) }]),
        ],
        edges: all.flatMap((node, from) => rows(node).map(/** @type {(row: Row<N>) => Edge} */ (row => 'to' in row
            ? { from, to: all.indexOf(row.to), ...('corner' in row ? { label: '', corner: row.corner } : { label: row.label }), kind: kindOf(node) === 'replaced' ? 'replaced' : undefined }
            : { from, to: { inline: row.inline, parts: row.parts }, label: row.label }))),
    }
}

/**
 * What a step built, what both versions hold, and what only the old one
 * holds.
 *
 * @type {<V, N>(structure: Structure<V, N>) => (versions: Versions<V>) => Census}
 */
export const census = structure => versions => {
    const { nodes } = graphOf(structure)(versions)
    /** @type {(kind: string) => number} */
    const count = kind => nodes.filter(n => n.kind === kind).length
    return { built: count('new'), shared: count('shared'), replaced: count('replaced') }
}

/**
 * What the last step did, or, if it built nothing and left nothing behind,
 * why: the key was already there, or was not.
 *
 * @type {(noun: string) => (show: Keys['show']) => (step: Step) => (c: Census) => string}
 */
export const stepLine = noun => show => ({ op, key }) => ({ built, shared, replaced }) => built === 0 && replaced === 0
    ? `Last step, ${op} ${show(key)}: nothing changed, the key is ${op === 'insert' ? 'already' : 'not'} in the ${noun}.`
    : `Last step, ${op} ${show(key)}: ${built} new (blue), ${shared} shared with the ${noun} before, ${replaced} replaced (amber).`

/**
 * A demo of `options.structure`.
 *
 * @type {<V, N>(options: Options<V, N>) => VersionsDemo<V>}
 */
export const versionsDemo = ({ structure, name, noun, intro, keys = decimal, presets }) => {
    const { parse, show, label, accepts } = keys
    const picker = examplePicker(presets.map(([n]) => [n, n]))
    const graph = graphOf(structure)
    const count = census(structure)
    const line = stepLine(noun)(show)
    /** @typedef {Parameters<typeof structure.root>[0]} V */
    /** @type {(name: string) => State<V>} */
    const load = presetName => {
        // `pick` refuses a name no preset has, which only a bug can send.
        const source = picker.pick(presetName)
        const [, keys, key, hint] = assertNotNullish(presets.find(([n]) => n === source))
        const version = keys.reduce((v, k) => structure.insert(k)(v), structure.empty)
        return { key: show(key), versions: { before: version, after: version }, status: { preset: presetName, hint }, error: null }
    }
    /** @type {(op: Step['op']) => (state: State<V>) => State<V>} */
    const press = op => state => {
        const key = parse(state.key.trim())
        if (key === null) { return { ...state, error: `"${state.key}" is not a key: type ${accepts}.` } }
        const { after } = state.versions
        return { key: state.key, versions: { before: after, after: structure[op](key)(after) }, status: { step: { op, key } }, error: null }
    }
    /** @type {(versions: Versions<V>) => readonly Element[]} */
    const drawing = versions => {
        const before = structure.root(versions.before)
        const after = structure.root(versions.after)
        return [
            ...(before === null && after === null ? [] : [graphSvg(graph(versions))]),
            ...(before === null ? [/** @type {const} */ (['p', `Before is the empty ${noun}.`])] : []),
            ...(after === null ? [/** @type {const} */ (['p', `After is the empty ${noun}.`])] : []),
        ]
    }
    const keyId = `${name}-key`
    return {
        load,
        press,
        graphOf: graph,
        census: count,
        demo: {
            init: load(presets[0][0]),
            update: state => event => pureOk(
                event.kind === 'input' && event.name === 'key' ? { ...state, key: event.value }
                : event.kind === 'input' && event.name === exampleName ? load(event.value)
                : event.kind === 'click' && (event.name === 'insert' || event.name === 'remove') ? press(event.name)(state)
                : state),
            view: ({ key, versions, status, error }) => ['div',
                ['p', intro],
                picker.view('preset' in status ? status.preset : ''),
                ['p',
                    ['label', { for: keyId }, `${label} `],
                    ['input', { type: 'text', id: keyId, name: 'key', value: key, size: '10' }],
                    ' ',
                    ['button', { type: 'button', name: 'insert' }, 'Insert'],
                    ' ',
                    ['button', { type: 'button', name: 'remove' }, 'Remove'],
                ],
                ...(error === null ? [] : [/** @type {const} */ (['p', `Error: ${error}`])]),
                ['p', 'preset' in status ? status.hint : line(status.step)(count(versions))],
                ...drawing(versions),
            ],
        },
    }
}
