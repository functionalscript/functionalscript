/**
 * @import { DemoEvent } from '../../demo/types.ts'
 * @import { RandomInt } from '../../../effects/common/types.ts'
 * @import { RunInstance } from '../../../effects/mock/types.ts'
 * @import { Game, Par, Search } from './types.ts'
 */

import { demo, depthOf, goalNodes, keyCount, move, nodeCount, parSearch, searchStep, searchTurn, start, statusLine } from './module.f.mjs'
import { structure, tensUpTo } from '../../../types/btree/demo.f.mjs'
import { values } from '../../../types/btree/module.f.mjs'
import { toArray } from '../../../types/list/module.f.mjs'
import { commandsOf } from '../../../effects/module.f.mjs'
import { partialRun, run as mockRun } from '../../../effects/mock/module.f.mjs'
import { ok } from '../../../types/result/module.f.js'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { assert, assertEq, assertNotNullish } from '../../../asserts/module.f.mjs'

/**
 * A host whose `randomInt` answers 0, 1, 2, … in turn.
 *
 * @type {RunInstance<RandomInt, number>}
 */
const counter = mockRun(/** @type {Parameters<typeof mockRun<RandomInt, number>>[0]} */ ({
    randomInt: () => (/** @type {number} */ n) => [n + 1, ok(n)],
}))

/** @type {(event: DemoEvent) => (game: Game) => Game} */
const update = event => game => {
    const [, r] = counter(0)(demo.update(game)(event))
    assert(r[0] === 'ok', '')
    return r[1]
}

/** @type {(game: Game) => string} */
const html = game => htmlToString(demo.view(game))

// The 8 keys inserted in order: 7 nodes, 3 deep, where a perfect tree of
// 8 keys is 4 nodes, 2 deep. Moving 40, 10 and 50 makes it perfect.
const inOrder = tensUpTo(8).reduce((t, k) => structure.insert(k)(t), structure.empty)

/** @type {Game} */
const level2 = { depth: 2, versions: { before: inOrder, after: inOrder }, moves: 0, par: null, last: null, error: null }

/** A search, asserted to be one. @type {(par: Par) => Search} */
const searchOf = par => {
    assert(typeof par === 'object' && par !== null, par)
    return par
}

/**
 * A search run to its end, `budget` trees a turn.
 *
 * @type {(keys: readonly number[]) => (budget: number) => (par: Par) => Par}
 */
const finish = keys => budget => par => par === null || typeof par === 'number' ? par : finish(keys)(budget)(searchStep(keys)(budget)(par))

/** @type {(game: Game) => readonly number[]} */
const keysOf = game => toArray(values(assertNotNullish(game.versions).after))

export const proof = {
    // A perfect tree of depth d: 3^d - 1 keys in half as many nodes.
    levels: () => {
        assertEq(JSON.stringify([2, 3, 4].map(d => [keyCount(d), goalNodes(d)])), '[[8,4],[26,13],[80,40]]')
    },
    // The depth is the length of any path down; the empty tree has none.
    measures: () => {
        assertEq(JSON.stringify([depthOf(null), nodeCount(null)]), '[0,0]')
        assertEq(JSON.stringify([depthOf(inOrder), nodeCount(inOrder)]), '[3,7]')
        const five = structure.insert(10)(structure.insert(20)(structure.insert(30)(structure.insert(40)(structure.insert(50)(null)))))
        assertEq(JSON.stringify([depthOf(five), nodeCount(five)]), '[2,4]')
    },
    start: {
        // One `randomInt` per key, and a tree of the level's keys, as both
        // versions, with no moves made.
        builds: () => {
            const [asked, r] = counter(0)(start(3)(level2))
            assertEq(asked, 26)
            assert(r[0] === 'ok', '')
            const game = r[1]
            assertEq(JSON.stringify([game.depth, game.moves, game.last, game.error]), '[3,0,null,null]')
            const versions = assertNotNullish(game.versions)
            assertEq(versions.before, versions.after)
            assertEq(JSON.stringify(keysOf(game)), JSON.stringify(tensUpTo(26)))
        },
        // A host without random numbers builds nothing, and says so. The
        // game stays as it was, its level included: a depth-2 search still
        // running goes on with depth 2's keys, and finds the in-order
        // tree's par, 3.
        refused: () => {
            /** @type {RunInstance<RandomInt, null>} */
            const none = partialRun(commandsOf({ randomInt: null }))({})
            const searching = { ...level2, par: parSearch(tensUpTo(8))(inOrder) }
            const [, r] = none(null)(start(3)(searching))
            assert(r[0] === 'ok', '')
            const game = r[1]
            assertEq(JSON.stringify({ ...game, error: null }), JSON.stringify(searching))
            assertEq(game.error, 'No random tree: operation not implemented: randomInt.')
            const h = html(game)
            assert(h.includes('No random tree: operation not implemented: randomInt.'), h)
            assert(h.includes('<option value="2" selected="">'), h)
            assertEq(finish(tensUpTo(8))(50)(searchTurn(game).par), 3)
        },
    },
    move: {
        // A key that comes back in another place: counted, and drawn
        // against the tree before it.
        changes: () => {
            const game = move(40)(level2)
            assertEq(JSON.stringify([game.moves, game.last]), '[1,{"key":40,"changed":true}]')
            const versions = assertNotNullish(game.versions)
            assertEq(versions.before, inOrder)
            assert(versions.after !== inOrder, '')
            assertEq(JSON.stringify(keysOf(game)), JSON.stringify(tensUpTo(8)))
        },
        // A key that goes back where it was: counted too, the tree it was
        // given kept, and said.
        goesBack: () => {
            const game = move(10)(level2)
            assertEq(JSON.stringify([game.moves, game.last]), '[1,{"key":10,"changed":false}]')
            assertEq(assertNotNullish(game.versions).after, inOrder)
            assertEq(statusLine(game)(inOrder), '1 move. Depth 3, goal 2. 7 nodes, goal 4. 10 went back where it was.')
        },
        // Before the first tree there is nothing to move.
        noTree: () => {
            assertEq(move(40)(demo.init), demo.init)
        },
    },
    status: {
        // The depth and the nodes against the level's, while not perfect.
        playing: () => {
            assertEq(statusLine(level2)(inOrder), '0 moves. Depth 3, goal 2. 7 nodes, goal 4.')
            const game = move(40)(level2)
            assertEq(statusLine(game)(assertNotNullish(game.versions).after), '1 move. Depth 3, goal 2. 7 nodes, goal 4.')
        },
        // Three moves make it perfect, and the game says so.
        won: () => {
            const game = move(50)(move(10)(move(40)(level2)))
            const tree = assertNotNullish(game.versions).after
            assertEq(JSON.stringify([depthOf(tree), nodeCount(tree)]), '[2,4]')
            assertEq(statusLine(game)(tree), 'Perfect, in 3 moves!')
        },
        // A tree that starts perfect is said to, not counted as a win.
        startedPerfect: () => {
            const perfect = assertNotNullish(move(50)(move(10)(move(40)(level2))).versions).after
            assertEq(statusLine({ ...level2, versions: { before: perfect, after: perfect } })(perfect), 'This tree started perfect. Press New tree for another.')
        },
    },
    par: {
        // The in-order tree's par is 3, the winning moves 40, 10 and 50:
        // the search tries every tree one move away, then two, then finds
        // a perfect one at three.
        inOrder: () => {
            const keys = tensUpTo(8)
            const begun = searchOf(parSearch(keys)(inOrder))
            assertEq(JSON.stringify([begun.distance, begun.frontier.length, begun.next.length]), '[0,1,0]')
            assertEq(finish(keys)(50)(begun), 3)
            // One tree a turn: the search keeps its place in a frontier
            // between turns, and finds the same par.
            const one = searchOf(searchStep(keys)(1)(begun))
            assertEq(one.distance, 1)
            const two = searchOf(searchStep(keys)(1)(one))
            assertEq(JSON.stringify([two.distance, two.frontier.length === one.frontier.length - 1]), '[1,true]')
            assertEq(finish(keys)(1)(two), 3)
        },
        // A perfect start has par 0, and nothing to search.
        perfect: () => {
            const perfect = assertNotNullish(move(50)(move(10)(move(40)(level2))).versions).after
            assertEq(parSearch(tensUpTo(8))(perfect), 0)
        },
        // Seven keys cannot fill every node, so the search meets every tree
        // there is and ends with no par.
        none: () => {
            const keys = tensUpTo(7)
            const tree = keys.reduce((t, k) => structure.insert(k)(t), structure.empty)
            assertEq(finish(keys)(50)(parSearch(keys)(tree)), null)
        },
        // A level starts its search at depths 2 and 3, and has none at 4.
        levels: () => {
            const [, r3] = counter(0)(start(3)(level2))
            assert(r3[0] === 'ok', '')
            assertEq(searchOf(r3[1].par).distance, 0)
            const [, r4] = counter(0)(start(4)(level2))
            assert(r4[0] === 'ok', '')
            assertEq(r4[1].par, null)
        },
        // The board says the par once known, and that it is being worked
        // out until then; a level without one says nothing of it.
        status: () => {
            const searching = { ...level2, par: parSearch(tensUpTo(8))(inOrder) }
            assertEq(statusLine(searching)(inOrder), '0 moves. Depth 3, goal 2. 7 nodes, goal 4. Par: working it out…')
            assertEq(statusLine({ ...level2, par: 3 })(inOrder), '0 moves. Depth 3, goal 2. 7 nodes, goal 4. Par: 3 moves.')
            const won = move(50)(move(10)(move(40)({ ...level2, par: 3 })))
            assertEq(statusLine(won)(assertNotNullish(won.versions).after), 'Perfect, in 3 moves! Par: 3 moves.')
            assertEq(statusLine({ ...level2, par: 1 })(inOrder), '0 moves. Depth 3, goal 2. 7 nodes, goal 4. Par: 1 move.')
        },
        // A running search asks for another turn, and a turn moves it on;
        // with none running, there is no turn to ask for, and one changes
        // nothing.
        turns: () => {
            const searching = { ...level2, par: parSearch(tensUpTo(8))(inOrder) }
            assertEq(JSON.stringify(assertNotNullish(demo.nextEvent)(searching)), '{"kind":"click","name":"par"}')
            assertEq(searchOf(update({ kind: 'click', name: 'par' })(searching).par).distance, 1)
            assertEq(assertNotNullish(demo.nextEvent)(level2), null)
            assertEq(assertNotNullish(demo.nextEvent)({ ...level2, par: 3 }), null)
            assertEq(searchTurn(level2), level2)
            const known = { ...level2, par: 3 }
            assertEq(searchTurn(known), known)
        },
    },
    demo: {
        // The page opens building its first tree, and the start event
        // builds it at the first level.
        opening: () => {
            const h = html(demo.init)
            assert(h.includes('Building a random tree…'), h)
            assert(h.includes('<select id="level" name="level"><option value="2" selected="">Depth 2: 8 keys</option><option value="3">Depth 3: 26 keys</option><option value="4">Depth 4: 80 keys</option></select>'), h)
            assert(h.includes('<button type="button" name="new">New tree</button>'), h)
            const game = update({ kind: 'start' })(demo.init)
            assertEq(JSON.stringify(keysOf(game)), JSON.stringify(tensUpTo(8)))
            const g = html(game)
            assert(g.includes('0 moves. Depth '), g)
            // Every key is a control that moves it.
            assertEq(g.split('data-demo-click="move:').length - 1, 8)
        },
        // New tree starts the level again; picking a level starts that one.
        levels: () => {
            const moved = move(40)(level2)
            assertEq(update({ kind: 'click', name: 'new' })(moved).moves, 0)
            const three = update({ kind: 'input', name: 'level', value: '3' })(moved)
            assertEq(JSON.stringify([three.depth, keysOf(three).length]), '[3,26]')
            assert(html(three).includes('<option value="3" selected="">'), '')
        },
        // A click on a key moves it; anything else changes nothing.
        update: () => {
            assertEq(JSON.stringify(update({ kind: 'click', name: 'move:40' })(level2).last), '{"key":40,"changed":true}')
            assertEq(update({ kind: 'click', name: 'move:x' })(level2), level2)
            assertEq(update({ kind: 'click', name: 'other' })(level2), level2)
            assertEq(update({ kind: 'input', name: 'level', value: '9' })(level2), level2)
            assertEq(update({ kind: 'input', name: 'other', value: '3' })(level2), level2)
        },
    },
}
