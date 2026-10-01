/**
 * @import { Unknown } from '../../media/json/types.ts'
 * @import { TNode } from './types/types.ts'
 * @import { List, Result } from '../list/types.ts'
 */

import { values } from './module.f.mjs'
import { stringify as jsonStringify } from '../../media/json/module.f.mjs'
import { sort } from '../object/module.f.mjs'
import { cmp } from '../string/module.f.mjs'
import { next, toArray } from '../list/module.f.mjs'
import { set as setSet } from './set/module.f.mjs'
import { value, find as findFind } from './find/module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'
import { _census, _versions, demo, examples } from './demo.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'

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

/** @type {(text: string) => string} */
const html = text => htmlToString(demo.view(text))

/** @type {(s: string) => (part: string) => number} */
const count = s => part => s.split(part).length - 1

/** @type {(text: string) => { readonly built: number, readonly shared: number, readonly replaced: number }} */
const censusOf = text => {
    const v = _versions(text)
    if (typeof v === 'string') { throw v }
    return _census(v)
}

const demoProof = {
    // The opening example: inserting 8 builds the path to it again — the
    // root, `6` and the leaf `7 8` — and shares the rest, so the whole left
    // half is drawn once, reached from both roots.
    insertIntoALeaf: () => {
        assertEq(JSON.stringify(censusOf(examples[0][1])), '{"built":3,"shared":4,"replaced":3}')
        const h = html(demo.init)
        assertEq(count(h)('data-graph-kind="new"'), 3)
        assertEq(count(h)('data-graph-kind="shared"'), 4)
        assertEq(count(h)('data-graph-kind="replaced"'), 3)
        assertEq(count(h)('data-graph-kind="versions"'), 1)
        assert(h.includes('>7 8<'), h)
        assert(h.includes('3 new (green), 4 shared with the version before, 3 replaced (red).'), h)
    },
    // A full leaf splits, and its middle key moves up into a branch of five.
    split: () => {
        assertEq(JSON.stringify(censusOf(examples[1][1])), '{"built":4,"shared":4,"replaced":3}')
        const h = html(examples[1][1])
        assert(h.includes('>6 8<'), h)
        assert(h.includes('>6…8<'), h)
    },
    // Splitting up to the root grows the tree a level and still shares
    // every leaf it did not touch.
    growALevel: () => assertEq(JSON.stringify(censusOf(examples[2][1])), '{"built":7,"shared":8,"replaced":3}'),
    remove: () => {
        assertEq(JSON.stringify(censusOf(examples[3][1])), '{"built":2,"shared":2,"replaced":5}')
        assert(html(examples[3][1]).includes('Last step, remove 7:'), '')
    },
    // A missing key changes nothing: both edges reach one tree.
    removeMissing: () => assertEq(JSON.stringify(censusOf(examples[4][1])), '{"built":0,"shared":7,"replaced":0}'),
    // The empty tree is no node of its own, but a value in its port.
    firstKey: () => {
        const h = html(examples[5][1])
        assert(h.includes('>empty<'), h)
        assert(h.includes('Last step, insert 1:'), h)
    },
    // Words may sit on several lines.
    lines: () => assertEq(JSON.stringify(censusOf('1\n2 3')), '{"built":3,"shared":0,"replaced":1}'),
    noSteps: () => assert(html('').includes('Type keys to insert'), ''),
    refused: {
        word: () => assert(html(examples[6][1]).includes('Error: &quot;two&quot; is not a step'), ''),
        // The first refusal is the one reported, not the last.
        first: () => assertEq(_versions('x 1 y'), '"x" is not a step: write an integer to insert it, or "-" and an integer to remove it.'),
        // A spelling `String` would not write back.
        spelling: () => assertEq(typeof _versions('07'), 'string'),
        // `NaN` has no order for the tree to keep.
        nan: () => assertEq(typeof _versions('NaN'), 'string'),
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
