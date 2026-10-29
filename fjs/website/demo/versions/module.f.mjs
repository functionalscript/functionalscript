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
 * **A click on a key moves it**: removes it and inserts it again, a step
 * that keeps the keys and may change the shape. A move whose version is
 * drawn as the one before it changed nothing, however many nodes it built
 * on the way, and answers the version it was given.
 *
 * **A preset loads a version and a key, and takes no step.** Its version is
 * both versions, so nothing is coloured, and its hint names the button to
 * press: the reader makes the change and sees it happen.
 *
 * **Generate builds a random version, and takes no step either**, for a
 * demo that says how ({@link Random}): it inserts the keys a count stands
 * for in an order the host picks, asking `randomInt` once per key. The
 * order is the host's, so it is not the same on the next press or the next
 * visit, and the line under the controls spells it out.
 *
 * @module
 *
 * @import { RequiredMap } from '../../../types/object/types.ts'
 * @import { Sharing } from '../sharing/types.ts'
 * @import { Census, Keys, Layout, Options, Preset, Random, Row, Shape, State, Step, Structure, Versions, VersionsDemo } from './types.ts'
 * @import { Effect, NotImplemented } from '../../../effects/types.ts'
 * @import { RandomInt } from '../../../effects/common/types.ts'
 * @import { Click, Edge, Graph } from '../graph/types.ts'
 * @import { Element } from '../../../media/html/types.ts'
 */

import { button, refusal } from '../module.f.mjs'
import { graphSvg } from '../graph/module.f.mjs'
import { examplePicker, name as exampleName } from '../examples/module.f.js'
import { errorMessage, mapStep, pureOk, resultStep, step } from '../../../effects/module.f.mjs'
import { randomInt } from '../../../effects/common/module.f.mjs'
import { assert, assertNotNullish } from '../../../asserts/module.f.js'
import { max } from '../../../types/number/max/module.f.js'
import { digitsValue, one } from '../../../text/ascii/module.f.js'
import { hasEntry } from '../../../types/object/entry/module.f.js'

const readBinary = digitsValue(2n)

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
 * Keys typed in binary, up to `width` digits, and shown in all `width`: the
 * reading and the drawing of a demo's {@link Keys}, which names them itself.
 * A key reads through `text/ascii`'s `digitsValue`, so an empty text and a
 * character other than `0` or `1` are refused.
 *
 * @throws If `width` is not `1` to `53`: a key is a `number`, and a wider
 * one would read two spellings as one key. A caller's mistake no text can
 * cause.
 *
 * @type {(width: number) => Pick<Keys, 'parse' | 'show'>}
 */
export const binaryKeys = width => {
    assert(Number.isInteger(width) && 1 <= width && width <= 53, ['binary key width out of range', width])
    return {
        parse: text => {
            const key = text.length <= width ? readBinary([...text].map(one)) : null
            return key === null ? null : Number(key)
        },
        show: key => key.toString(2).padStart(width, '0'),
    }
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
    const nodesOf = node => node === null ? [] : [node, ...rows(node).flatMap(row => hasEntry(row, 'to') ? nodesOf(row.to) : [])]
    return [[...new Set(nodesOf(root(versions.before)))], [...new Set(nodesOf(root(versions.after)))]]
}

/**
 * Whether two versions are drawn the same: the same titles and rows, node
 * by node, a value's parts included, whether or not the nodes are the same
 * objects.
 *
 * @type {<V, N>(structure: Structure<V, N>) => (versions: Versions<V>) => boolean}
 */
export const sameShape = ({ root, shape }) => versions => {
    const { rows, title } = shape(versions)
    /** @typedef {Parameters<typeof rows>[0]} N */
    /** @type {(a: N | null) => (b: N | null) => boolean} */
    const same = a => b => {
        if (a === b) { return true }
        if (a === null || b === null) { return false }
        const [ra, rb] = [rows(a), rows(b)]
        return title(a) === title(b) && ra.length === rb.length && ra.every((x, i) => {
            const y = rb[i]
            return hasEntry(x, 'to')
                ? hasEntry(y, 'to') && x.corner === y.corner && same(x.to)(y.to)
                : !hasEntry(y, 'to') && x.label === y.label && x.inline === y.inline
                    && JSON.stringify(x.parts) === JSON.stringify(y.parts)
        })
    }
    return same(root(versions.before))(root(versions.after))
}

/**
 * What a click on a key row does: moves the key, and says so.
 *
 * @type {(row: { readonly inline: string, readonly key?: number }) => Click | undefined}
 */
const clickOf = ({ inline, key }) =>
    key === undefined ? undefined : { name: `move:${key}`, label: `Remove ${inline} and insert it again` }

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
    const childrenOf = node => rows(node).flatMap(row => hasEntry(row, 'to') ? [row.to] : [])
    const newRoot = structure.root(versions.after)
    const [old, current] = nodesOfBoth(structure)(versions)
    /** @type {(node: N) => string} */
    const kindOf = node => old.includes(node) ? 'shared' : 'new'
    const all = current.toSorted((a, b) => order(a) - order(b))
    /** @type {(node: N) => number} */
    const heightOf = node => childrenOf(node).reduce((m, child) => max(m, heightOf(child) + 1), 0)
    /** @type {(node: N) => number} */
    const depthOf = node => all.filter(p => childrenOf(p).includes(node)).reduce((m, p) => max(m, depthOf(p) + 1), 0)
    const top = newRoot === null ? 0 : heightOf(newRoot)
    /** @type {Record<Layout, (node: N) => number>} */
    const rankOf = { leaves: node => top - heightOf(node), depth: depthOf }
    return {
        nodes: all.map((node, id) => ({ id, kind: kindOf(node), label: title(node), rank: rankOf[layout](node) })),
        entries: newRoot === null ? [] : [{ to: all.indexOf(newRoot) }],
        edges: all.flatMap((node, from) => rows(node).map(/** @type {(row: Row<N>) => Edge} */ (row => hasEntry(row, 'to')
            ? { from, to: all.indexOf(row.to), label: '', corner: row.corner }
            : { from, to: { inline: row.inline, parts: row.parts, click: clickOf(row) }, label: row.label }))),
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
 * Why a step that built nothing and left nothing behind changed nothing,
 * by what it tried.
 *
 * @type {(noun: string) => Record<Step['op'], string>}
 */
const unchanged = noun => ({
    insert: `the key is already in the ${noun}`,
    remove: `the key is not in the ${noun}`,
    move: 'the key went back where it was',
})

/**
 * What the last step did, or, if it built nothing and left nothing behind,
 * why: the key was already there, or was not, or went back where it was.
 *
 * @type {(noun: string) => (show: Keys['show']) => (step: Step) => (c: Census) => string}
 */
export const stepLine = noun => show => ({ op, key }) => ({ built, shared, replaced }) => built === 0 && replaced === 0
    ? `Last step, ${op} ${show(key)}: nothing changed, ${unchanged(noun)[op]}.`
    : `Last step, ${op} ${show(key)}: ${built} new (blue), ${shared} shared with the ${noun} before, ${replaced} only in the ${noun} before.`

/**
 * `keys` in an order the host picks: one `randomInt` per key, each choosing
 * one of the keys still left. A remainder is a fair enough choice among a
 * hundred keys from 2^32 numbers.
 *
 * @type {(keys: readonly number[]) => Effect<RandomInt, readonly number[], NotImplemented>}
 */
export const shuffled = keys => keys.length === 0 ? pureOk([]) : step(randomInt(), r => {
    const i = r % keys.length
    return mapStep(shuffled([...keys.slice(0, i), ...keys.slice(i + 1)]), rest => [keys[i], ...rest])
})

/**
 * A demo of `options.structure`.
 *
 * @type {<V, N>(options: Options<V, N>) => VersionsDemo<V>}
 */
export const versionsDemo = ({ structure, name, noun, intro, keys = decimal, presets, random }) => {
    const { parse, show, label, accepts } = keys
    const picker = examplePicker(presets.map(([n, , , , id]) => [n, n, id]))
    const graph = graphOf(structure)
    const count = census(structure)
    const line = stepLine(noun)(show)
    const same = sameShape(structure)
    /** @typedef {Parameters<typeof structure.root>[0]} V */
    /** @type {(name: string) => State<V>} */
    const load = presetName => {
        // `pick` refuses a name no preset has, which only a bug can send.
        const source = picker.pick(presetName)
        const [, keys, key, hint] = assertNotNullish(presets.find(([n]) => n === source))
        const version = keys.reduce((v, k) => structure.insert(k)(v), structure.empty)
        return { key: show(key), count: random === undefined ? '' : String(random.count), versions: { before: version, after: version }, status: { preset: presetName, hint }, error: null }
    }
    /** @type {(order: readonly number[]) => (state: State<V>) => State<V>} */
    const built = order => state => {
        const version = order.reduce((v, k) => structure.insert(k)(v), structure.empty)
        return { ...state, versions: { before: version, after: version }, status: { random: order }, error: null }
    }
    /** @type {(r: Random) => (state: State<V>) => Effect<RandomInt, State<V>, never>} */
    const generate = ({ max: most, keys: keysOf }) => state => {
        const n = decimal.parse(state.count.trim())
        if (n === null || n < 1 || n > most) {
            return pureOk({ ...state, error: `"${state.count}" is not a number of keys: type a whole number from 1 to ${most}.` })
        }
        return resultStep(shuffled(keysOf(n)), r => pureOk(r[0] === 'ok' ? built(r[1])(state)
            : { ...state, error: `No random tree: ${errorMessage(r[1])}.` }))
    }
    /** @type {(op: 'insert' | 'remove') => (state: State<V>) => State<V>} */
    const press = op => state => {
        const key = parse(state.key.trim())
        if (key === null) { return { ...state, error: `"${state.key}" is not a key: type ${accepts}.` } }
        const { after } = state.versions
        return { ...state, versions: { before: after, after: structure[op](key)(after) }, status: { step: { op, key } }, error: null }
    }
    /** @type {(key: number) => (state: State<V>) => State<V>} */
    const move = key => state => {
        const before = state.versions.after
        const moved = structure.insert(key)(structure.remove(key)(before))
        const after = same({ before, after: moved }) ? before : moved
        return { ...state, key: show(key), versions: { before, after }, status: { step: { op: 'move', key } }, error: null }
    }
    /** @type {(name: string) => number | null} */
    const movedKey = eventName => eventName.startsWith('move:') ? decimal.parse(eventName.slice(5)) : null
    /** @type {(versions: Versions<V>) => Element} */
    const drawing = versions => structure.root(versions.after) === null
        ? ['p', `The ${noun} is empty.`]
        : graphSvg(graph(versions))
    /** @type {(key: number | null) => (state: State<V>) => State<V>} */
    const clicked = key => state => key === null ? state : move(key)(state)
    const keyId = `${name}-key`
    const countId = `${name}-count`
    /** @type {(status: State<V>['status']) => (versions: Versions<V>) => string} */
    const statusLine = status => versions =>
        hasEntry(status, 'preset') ? status.hint
        : hasEntry(status, 'random') ? `${status.random.length} keys inserted in random order: ${status.random.map(show).join(', ')}.`
        : line(status.step)(count(versions))
    const initial = load(presets[0][0])
    /** @type {Sharing<State<V>>} */
    const sharing = {
        fields: {
            example: { default: presets[0][4], choices: ['', ...presets.map(p => p[4])] },
            key: { default: initial.key }, count: { default: initial.count },
        },
        examples: presets.map(([name, , , , id]) => ({ id, inputs: { example: id, key: load(name).key, count: initial.count } })),
        read: ({ status, key, count }) => ({ example: hasEntry(status, 'preset') ? assertNotNullish(presets.find(p => p[0] === status.preset))[4] : '', key, count }),
        restore: inputs => {
            // The restore boundary receives these finite, validated fields.
            const values = /** @type {RequiredMap<'example' | 'key' | 'count', string>} */ (inputs)
            const base = values.example === ''
                ? { ...initial, versions: { before: structure.empty, after: structure.empty }, status: { random: [] } }
                : load(assertNotNullish(presets.find(p => p[4] === values.example))[0])
            return { ...base, key: values.key, count: values.count }
        },
    }
    return {
        load,
        press,
        move,
        generate: random === undefined ? pureOk : generate(random),
        graphOf: graph,
        census: count,
        demo: {
            sharing,
            init: initial,
            update: state => event => random !== undefined && event.kind === 'click' && event.name === 'generate'
                ? generate(random)(state)
                : pureOk(
                    event.kind === 'input' && event.name === 'key' ? { ...state, key: event.value }
                    : event.kind === 'input' && event.name === 'count' ? { ...state, count: event.value }
                    : event.kind === 'input' && event.name === exampleName ? { ...load(event.value), count: state.count }
                    : event.kind === 'click' && (event.name === 'insert' || event.name === 'remove') ? press(event.name)(state)
                    : event.kind === 'click' ? clicked(movedKey(event.name))(state)
                    : state),
            view: ({ key, count: keyCount, versions, status, error }) => ['div',
                ['p', intro],
                picker.view(hasEntry(status, 'preset') ? status.preset : ''),
                ['p',
                    ['label', { for: keyId }, `${label} `],
                    ['input', { type: 'text', id: keyId, name: 'key', value: key, size: '10' }],
                    ' ',
                    button('insert', 'Insert'),
                    ' ',
                    button('remove', 'Remove'),
                ],
                ...(random === undefined ? [] : [/** @type {Element} */ (['p',
                    ['label', { for: countId }, 'Random keys '],
                    ['input', { type: 'text', id: countId, name: 'count', value: keyCount, size: '4' }],
                    ' ',
                    button('generate', 'Generate'),
                ])]),
                ...(error === null ? [] : [refusal(error)]),
                ['p', statusLine(status)(versions)],
                drawing(versions),
            ],
        },
    }
}
