/**
 * A demo of a persistent structure keyed by integers: type a key, press
 * **Insert** or **Remove**, and see the version the step made, each node
 * marked by whether the version before it holds it too. The shared half of
 * the B-tree and Patricia trie demos; each supplies only its
 * {@link Structure}.
 *
 * **Only the new version is drawn**, so the drawing is one tree. A node's
 * kind says whether the old version holds it: `shared` if it does, `new`
 * if the step built it. The site's stylesheet draws a new node blue and a
 * shared one plain. A structure says what "holds" means by what `===`
 * compares: the same object for one that shares by reference, the same
 * name for one that shares by content. What only the old version holds is
 * counted, in the step line, but not drawn.
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

import { refusal } from '../module.f.mjs'
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

/**
 * Every node of each version, once: a node two paths reach — two rows of
 * one parent, or two parents — is still one node.
 *
 * @type {<V, N>(structure: Structure<V, N>) => (versions: Versions<V>) => readonly [old: readonly N[], current: readonly N[]]}
 */
const nodesOfBoth = ({ root, shape }) => versions => {
    const { rows } = shape(versions)
    /** @typedef {Parameters<typeof rows>[0]} N */
    /** @type {(node: N | null) => readonly N[]} */
    const nodesOf = node => node === null ? [] : [node, ...rows(node).flatMap(row => 'to' in row ? nodesOf(row.to) : [])]
    return [[...new Set(nodesOf(root(versions.before)))], [...new Set(nodesOf(root(versions.after)))]]
}

/**
 * The new version as a graph: one node per distinct node, an arrow into
 * its root, and each column in the shape's `order`.
 *
 * @type {<V, N>(structure: Structure<V, N>) => (versions: Versions<V>) => Graph}
 */
export const graphOf = structure => versions => {
    const { rows, title, order, layout } = structure.shape(versions)
    /** @typedef {Parameters<typeof rows>[0]} N */
    /** @type {(node: N) => readonly N[]} */
    const childrenOf = node => rows(node).flatMap(row => 'to' in row ? [row.to] : [])
    const newRoot = structure.root(versions.after)
    const [old, current] = nodesOfBoth(structure)(versions)
    /** @type {(node: N) => string} */
    const kindOf = node => old.includes(node) ? 'shared' : 'new'
    const all = current.toSorted((a, b) => order(a) - order(b))
    /** @type {(node: N) => number} */
    const heightOf = node => childrenOf(node).reduce((m, child) => Math.max(m, heightOf(child) + 1), 0)
    /** @type {(node: N) => number} */
    const depthOf = node => all.filter(p => childrenOf(p).includes(node)).reduce((m, p) => Math.max(m, depthOf(p) + 1), 0)
    const top = newRoot === null ? 0 : heightOf(newRoot)
    /** @type {Record<Layout, (node: N) => number>} */
    const rankOf = { leaves: node => top - heightOf(node), depth: depthOf }
    return {
        nodes: all.map((node, id) => ({ id, kind: kindOf(node), label: title(node), rank: rankOf[layout](node) })),
        entries: newRoot === null ? [] : [{ to: all.indexOf(newRoot) }],
        edges: all.flatMap((node, from) => rows(node).map(/** @type {(row: Row<N>) => Edge} */ (row => 'to' in row
            ? { from, to: all.indexOf(row.to), label: '', corner: row.corner }
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
    const [old, current] = nodesOfBoth(structure)(versions)
    const shared = current.filter(node => old.includes(node)).length
    return { built: current.length - shared, shared, replaced: old.length - shared }
}

/**
 * What the last step did, or, if it built nothing and left nothing behind,
 * why: the key was already there, or was not.
 *
 * @type {(noun: string) => (show: Keys['show']) => (step: Step) => (c: Census) => string}
 */
export const stepLine = noun => show => ({ op, key }) => ({ built, shared, replaced }) => built === 0 && replaced === 0
    ? `Last step, ${op} ${show(key)}: nothing changed, the key is ${op === 'insert' ? 'already' : 'not'} in the ${noun}.`
    : `Last step, ${op} ${show(key)}: ${built} new (blue), ${shared} shared with the ${noun} before, ${replaced} only in the ${noun} before.`

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
    /** @type {(versions: Versions<V>) => Element} */
    const drawing = versions => structure.root(versions.after) === null
        ? ['p', `The ${noun} is empty.`]
        : graphSvg(graph(versions))
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
                ...(error === null ? [] : [refusal(error)]),
                ['p', 'preset' in status ? status.hint : line(status.step)(count(versions))],
                drawing(versions),
            ],
        },
    }
}
