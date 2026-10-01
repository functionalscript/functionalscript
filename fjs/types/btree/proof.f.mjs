/**
 * @import { Unknown } from '../../media/json/types.ts'
 * @import { TNode } from './types/types.ts'
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
import { _census, _press, demo } from './demo.f.mjs'
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

const demoProof = {
    // The page opens on 7 inserted into 1 to 6, drawn twice: before and after.
    opening: () => {
        const h = html(demo.init)
        assertEq(count(h)('<svg'), 2)
        assert(h.includes('<h3>Before</h3>'), h)
        assert(h.includes('<h3>After</h3>'), h)
        assert(h.includes('name="insert"'), h)
        assert(h.includes('name="remove"'), h)
        assert(h.includes('value="8"'), h)
        assert(h.includes('Last step, insert 7:'), h)
        assert(!h.includes('Error'), h)
    },
    // Inserting 8 builds the path to it again — the root, `6` and the leaf
    // `7 8` — and shares the rest. Each version is its own graph, so a
    // shared node is drawn once in each.
    insertIntoALeaf: () => {
        const s = press('insert')('8')(demo.init)
        assertEq(censusOf(s), '{"built":3,"shared":4,"replaced":3}')
        const h = html(s)
        assertEq(count(h)('data-graph-kind="new"'), 3)
        assertEq(count(h)('data-graph-kind="shared"'), 8)
        assertEq(count(h)('data-graph-kind="replaced"'), 3)
        // The new leaf holds 7 and 8, each in a row of its own.
        assert(h.includes('>Leaf2<'), h)
        assert(h.includes('>Value0<'), h)
        assert(h.includes('data-graph-value-label="">8<'), h)
        assert(h.includes('Last step, insert 8: 3 new (green), 4 shared with the version before, 3 replaced (red).'), h)
    },
    // A full leaf splits, and its middle key moves up into a branch of five.
    split: () => {
        const s = press('insert')('9')(press('insert')('8')(demo.init))
        assertEq(censusOf(s), '{"built":4,"shared":4,"replaced":3}')
        const h = html(s)
        // Left, Value0, Middle, Value1, Right, in the node's own order.
        const node5 = h.indexOf('>Node5<')
        assert(node5 !== -1, h)
        const rows = ['>Left<', '>Value0<', '>Middle<', '>Value1<', '>Right<'].map(row => h.indexOf(row, node5))
        assert(rows.every((at, i) => at !== -1 && (i === 0 || rows[i - 1] < at)), h)
    },
    // Splitting up to the root grows the tree a level and still shares
    // every leaf it did not touch.
    growALevel: () => {
        const s = ['8', '9', '10', '11', '12', '13', '14', '15'].reduce((state, key) => press('insert')(key)(state), demo.init)
        assertEq(censusOf(s), '{"built":7,"shared":8,"replaced":3}')
    },
    // Removing 7 empties its leaf, which merges with its sibling.
    remove: () => {
        const s = press('remove')('7')(demo.init)
        assertEq(censusOf(s), '{"built":2,"shared":2,"replaced":5}')
        assert(html(s).includes('Last step, remove 7:'), '')
    },
    // A missing key changes nothing: both versions are one tree.
    removeMissing: () => assertEq(censusOf(press('remove')('9')(demo.init)), '{"built":0,"shared":7,"replaced":0}'),
    // The empty tree is drawn as one node.
    firstKey: () => {
        /** @type {_State} */
        const empty = { key: '', versions: { before: null, after: null }, last: 'remove 1', error: null }
        const h = html(press('insert')('1')(empty))
        assert(h.includes('data-graph-kind="leaf"'), h)
        assert(h.includes('>empty<'), h)
        assert(h.includes('Last step, insert 1:'), h)
    },
    // Spaces around a key are not part of it, and a negative key is a key.
    keys: () => {
        assertEq(press('insert')(' 8 ')(demo.init).last, 'insert 8')
        assertEq(press('insert')('-3')(demo.init).last, 'insert -3')
    },
    // A field that holds no key changes no tree, and says why.
    refused: () => {
        const s = press('insert')('two')(demo.init)
        assertEq(s.versions, demo.init.versions)
        assertEq(s.last, 'insert 7')
        assert(html(s).includes('Error: &quot;two&quot; is not a key'), '')
        // A spelling `String` would not write back, and `NaN`, which has no
        // order for the tree to keep.
        assertEq(press('insert')('07')(demo.init).versions, demo.init.versions)
        assertEq(press('remove')('NaN')(demo.init).versions, demo.init.versions)
        // The next good press clears the error.
        assertEq(press('insert')('8')(s).error, null)
    },
    // Typing changes the field only; a button applies it; anything else is
    // ignored.
    update: () => {
        const typed = update({ kind: 'input', name: 'key', value: '9' })(demo.init)
        assertEq(typed.key, '9')
        assertEq(typed.versions, demo.init.versions)
        assertEq(update({ kind: 'click', name: 'insert' })(typed).last, 'insert 9')
        assertEq(update({ kind: 'click', name: 'remove' })(typed).last, 'remove 9')
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
