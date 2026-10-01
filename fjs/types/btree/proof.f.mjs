/**
 * @import { Unknown } from '../../media/json/types.ts'
 * @import { TNode, Tree } from './types/types.ts'
 * @import { List, Result } from '../list/types.ts'
 * @import { DemoEvent } from '../../website/demo/types.ts'
 * @import { _State } from './types.ts'
 */

import { values } from './module.f.mjs'
import { stringify as jsonStringify } from '../../media/json/module.f.mjs'
import { sort } from '../object/module.f.mjs'
import { cmp } from '../string/module.f.mjs'
import { next, toArray } from '../list/module.f.mjs'
import { set as setSet } from './set/module.f.mjs'
import { value, find as findFind } from './find/module.f.mjs'
import { assert, assertEq, assertNotNullish } from '../../asserts/module.f.mjs'
import { _census, _load, _press, demo, presets } from './demo.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'
import { runPure } from '../../effects/module.f.mjs'
import { unwrap } from '../result/module.f.mjs'

const jsonStr = jsonStringify(sort)

/** @type {(sequence: List<Unknown>) => string} */
const stringify = sequence => jsonStr(toArray(sequence))

/** @type {(node: TNode<string>) => (value: string) => TNode<string>} */
const set = node => value => setSet(cmp(value))(() => value)(node)

const valueTest1 =() => {
    /** @type {TNode<string>} */
    let _map = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    _map = set(_map)('d')
    _map = set(_map)('e')
    _map = set(_map)('f')
    const result = stringify(values(_map))
    assertEq(result, '["a","b","c","d","e","f"]')
}

const valuesTest2 = () => {
    /** @type {TNode<string>} */
    let _map = ['1']
    for(let i = 2; i <= 10; i++)
        _map = set(_map)((i*i).toString())
    const result = stringify(values(_map))
    assertEq(result, '["1","100","16","25","36","4","49","64","81","9"]')
}

const findTrue = () => {
    /** @type {TNode<string>} */
    let _map = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    const result = value(findFind(cmp('b'))(_map).first)
    assertEq(result, 'b')
}

const find = () => {
    /** @type {TNode<string>} */
    let _map = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    const result = value(findFind(cmp('e'))(_map).first)
    assertEq(result, null)
}

const test = () => {
    /** @type {TNode<string>} */
    let _map = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    _map = set(_map)('d')
    _map = set(_map)('e')
    _map = set(_map)('f')
    //
    {
        /** @type {Result<string>} */
        let _item = next(values(_map))
        while (_item !== null) {
            _item = next(_item.tail)
        }
    }
}

/** @type {(state: _State) => string} */
const html = state => htmlToString(demo.view(state))

/** @type {(s: string) => (part: string) => number} */
const count = s => part => s.split(part).length - 1

/** @type {(state: _State) => string} */
const censusOf = state => JSON.stringify(_census(state.versions))

/** The state after typing `key` into the field and pressing `op`'s button. @type {(op: 'insert' | 'remove') => (key: string) => (state: _State) => _State} */
const press = op => key => state => _press(op)({ ...state, key })

/** @type {(event: DemoEvent) => (state: _State) => _State} */
const update = event => state => unwrap(assertNotNullish(runPure(demo.update(state)(event))[0]))

/**
 * A preset loaded and its hint followed: the button the hint names, pressed
 * with the key the preset put in the field.
 *
 * @type {(name: string) => _State}
 */
const follow = name => {
    const loaded = _load(name)
    const { status } = loaded
    assert('preset' in status, '')
    return press(status.hint.startsWith('Press Insert') ? 'insert' : 'remove')(loaded.key)(loaded)
}

/** @type {(tree: Tree<number>) => number} */
const depth = tree => tree === null ? 0 : tree.length === 1 || tree.length === 2 ? 1 : 1 + depth(tree[0])

/** @type {(name: string) => readonly [number, number]} */
const depths = name => {
    const { versions } = follow(name)
    return [depth(versions.before), depth(versions.after)]
}

const demoProof = {
    // The page opens on the first preset loaded: one tree under both
    // headings, every node shared, the key in the field and the hint saying
    // what to press. Nothing has changed, so nothing is coloured.
    opening: () => {
        const h = html(demo.init)
        assertEq(JSON.stringify(demo.init), JSON.stringify(_load(presets[0][0])))
        assertEq(demo.init.versions.before, demo.init.versions.after)
        assertEq(count(h)('<svg'), 2)
        assert(h.includes('<h3>Before</h3>'), h)
        assert(h.includes('<h3>After</h3>'), h)
        assert(h.includes('name="insert"'), h)
        assert(h.includes('name="remove"'), h)
        assert(h.includes('value="8"'), h)
        assert(h.includes('<option value="Insert into a leaf" selected="">'), h)
        assert(h.includes('Press Insert to add 8'), h)
        assertEq(count(h)('data-graph-kind="new"'), 0)
        assertEq(count(h)('data-graph-kind="replaced"'), 0)
        assert(!h.includes('Custom'), h)
        assert(!h.includes('Error'), h)
    },
    // Each preset's hint is what its press does.
    presets: {
        // Only the path to 8 is built again — the root, `6` and the leaf
        // `7 8` — and the rest is shared. Each version is its own graph, so
        // a shared node is drawn once in each.
        insertIntoALeaf: () => {
            const s = follow('Insert into a leaf')
            assertEq(censusOf(s), '{"built":3,"shared":4,"replaced":3}')
            const h = html(s)
            assertEq(count(h)('data-graph-kind="new"'), 3)
            assertEq(count(h)('data-graph-kind="shared"'), 8)
            assertEq(count(h)('data-graph-kind="replaced"'), 3)
            // The new leaf holds 7 and 8, each in a row of its own.
            assert(h.includes('>Value0<'), h)
            assert(h.includes('data-graph-value-label="">8<'), h)
            assert(h.includes('Last step, insert 8: 3 new (green), 4 shared with the version before, 3 replaced (red).'), h)
            // A press leaves the preset behind.
            assert(h.includes('Custom'), h)
            assert(!h.includes('Press Insert'), h)
        },
        // The empty tree is drawn as one node, and the first key is a leaf.
        emptyTree: () => {
            const loaded = html(_load('Empty tree'))
            assertEq(count(loaded)('>empty<'), 2)
            const s = follow('Empty tree')
            assertEq(censusOf(s), '{"built":1,"shared":0,"replaced":0}')
            assert(html(s).includes('Last step, insert 1:'), '')
        },
        // A full leaf splits, and its middle key moves up into a branch of
        // five: Left, Value0, Middle, Value1, Right, in the node's own
        // order, and no title above them — the rows say what the node is.
        splitALeaf: () => {
            const s = follow('Split a leaf')
            assertEq(censusOf(s), '{"built":4,"shared":4,"replaced":3}')
            const h = html(s)
            assert(!h.includes('data-graph-label'), h)
            const middle = h.indexOf('>Middle<')
            assert(middle !== -1, h)
            const node5 = h.lastIndexOf('>Left<', middle)
            const rows = ['>Left<', '>Value0<', '>Middle<', '>Value1<', '>Right<'].map(row => h.indexOf(row, node5))
            assert(rows.every((at, i) => at !== -1 && (i === 0 || rows[i - 1] < at)), h)
        },
        // The split reaches the root, and the tree grows a level.
        growALevel: () => {
            assertEq(censusOf(follow('Grow a level')), '{"built":7,"shared":8,"replaced":3}')
            assertEq(JSON.stringify(depths('Grow a level')), '[3,4]')
        },
        // An emptied leaf merges, and the tree shrinks a level.
        removeAndMerge: () => {
            assertEq(censusOf(follow('Remove and merge')), '{"built":2,"shared":2,"replaced":5}')
            assertEq(JSON.stringify(depths('Remove and merge')), '[3,2]')
        },
        // A missing key changes nothing: both versions are one tree.
        removeAMissingKey: () => assertEq(censusOf(follow('Remove a missing key')), '{"built":0,"shared":7,"replaced":0}'),
        // Five nodes built again, and 26 shared, without growing a level.
        bigTree: () => {
            assertEq(censusOf(follow('Big tree')), '{"built":5,"shared":26,"replaced":5}')
            assertEq(JSON.stringify(depths('Big tree')), '[5,5]')
        },
    },
    // A name no preset has is a bug in whatever sent it.
    throw: () => _load('no such preset'),
    // Spaces around a key are not part of it, and a negative key is a key.
    keys: () => {
        assertEq(JSON.stringify(press('insert')(' 8 ')(demo.init).status), '{"last":"insert 8"}')
        assertEq(JSON.stringify(press('insert')('-3')(demo.init).status), '{"last":"insert -3"}')
    },
    // A field that holds no key changes no tree, and says why; the hint
    // stays, since nothing it describes has happened yet.
    refused: () => {
        const s = press('insert')('two')(demo.init)
        assertEq(s.versions, demo.init.versions)
        assertEq(s.status, demo.init.status)
        const h = html(s)
        assert(h.includes('Error: &quot;two&quot; is not a key'), h)
        assert(h.includes('Press Insert to add 8'), h)
        // A spelling `String` would not write back, and `NaN`, which has no
        // order for the tree to keep.
        assertEq(press('insert')('07')(demo.init).versions, demo.init.versions)
        assertEq(press('remove')('NaN')(demo.init).versions, demo.init.versions)
        // The next good press clears the error.
        assertEq(press('insert')('8')(s).error, null)
    },
    // Typing changes the field only; a button applies it; picking a preset
    // loads it; anything else is ignored.
    update: () => {
        const typed = update({ kind: 'input', name: 'key', value: '9' })(demo.init)
        assertEq(typed.key, '9')
        assertEq(typed.versions, demo.init.versions)
        assertEq(JSON.stringify(update({ kind: 'click', name: 'insert' })(typed).status), '{"last":"insert 9"}')
        assertEq(JSON.stringify(update({ kind: 'click', name: 'remove' })(typed).status), '{"last":"remove 9"}')
        assertEq(update({ kind: 'input', name: 'example', value: 'Big tree' })(typed).key, '32')
        assertEq(update({ kind: 'click', name: 'other' })(typed), typed)
        assertEq(update({ kind: 'input', name: 'other', value: '1' })(typed), typed)
        assertEq(update({ kind: 'start' })(typed), typed)
    },
}

export const proof = {
    valueTest1,
    valuesTest2,
    findTrue,
    find,
    test,
    demo: demoProof,
}
