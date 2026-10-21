/**
 * @import { DemoEvent } from '../../demo/types.ts'
 * @import { RandomInt } from '../../../effects/common/types.ts'
 * @import { RunInstance } from '../../../effects/mock/types.ts'
 * @import { Game, Par, Search } from './types.ts'
 */

import { demo, depthOf, frameTime, goalNodes, keyCount, land, marked, move, nodeCount, orderGap, ordered, parSearch, searchStep, searchTurn, start, statusLine, step } from './module.f.mjs'
import { structure, tensUpTo } from '../../../types/btree/demo.f.mjs'
import { graphOf } from '../../demo/versions/module.f.mjs'
import { values } from '../../../types/btree/module.f.mjs'
import { toArray } from '../../../types/list/module.f.mjs'
import { commandsOf } from '../../../effects/module.f.mjs'
import { partialRun, run as mockRun } from '../../../effects/mock/module.f.mjs'
import { ok } from '../../../types/result/module.f.js'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { assert, assertEq, assertNotNullish } from '../../../asserts/module.f.js'

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
const level2 = { depth: 2, animate: true, versions: { before: inOrder, after: inOrder }, mode: 'enter', note: null, base: null, pending: [], shown: 0, moves: 0, par: null, last: null, error: null }

/** A move made and landed. @type {(key: number) => (game: Game) => Game} */
const played = key => game => land(move(key)(game))

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
        // versions, drawn still, with no moves made.
        builds: () => {
            const [asked, r] = counter(0)(start(3)(level2))
            assertEq(asked, 26)
            assert(r[0] === 'ok', '')
            const game = r[1]
            assertEq(JSON.stringify([game.depth, game.mode, game.moves, game.last, game.error]), '[3,"still",0,null,null]')
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
        // A key that comes back in another place, in four frames, counted
        // once: the nodes the remove replaces leave, its new ones enter,
        // the nodes the insert replaces leave, and its new ones enter.
        // Each frame draws its tree against the next one, or the one
        // before, and the board says what the move is doing.
        changes: () => {
            const first = move(40)(level2)
            assertEq(JSON.stringify([first.moves, first.last, first.mode, first.note, first.pending.length]),
                '[1,{"key":40,"changed":true},"leave","40 comes out of the tree.",3]')
            const out = assertNotNullish(first.versions)
            assertEq(out.after, inOrder)
            assertEq(JSON.stringify(toArray(values(out.before))), JSON.stringify(tensUpTo(8).filter(k => k !== 40)))
            const second = step(first)
            const removed = out.before
            assertEq(JSON.stringify([second.mode, second.note, second.pending.length]), '["enter","40 is out of the tree.",2]')
            assertEq(JSON.stringify(second.versions), JSON.stringify({ before: inOrder, after: removed }))
            const third = step(second)
            assertEq(JSON.stringify([third.mode, third.note, third.pending.length]), '["leave","40 goes back in.",1]')
            const moved = assertNotNullish(third.versions).before
            assertEq(JSON.stringify(third.versions), JSON.stringify({ before: moved, after: removed }))
            const fourth = step(third)
            assertEq(JSON.stringify([fourth.mode, fourth.note, fourth.pending.length, fourth.moves]), '["enter",null,0,1]')
            assertEq(JSON.stringify(fourth.versions), JSON.stringify({ before: removed, after: moved }))
            assertEq(JSON.stringify(keysOf(fourth)), JSON.stringify(tensUpTo(8)))
            // With no frame to come, a step and a landing change nothing;
            // a landing is the last frame at once, not counted as shown.
            assertEq(step(fourth), fourth)
            assertEq(land(fourth), fourth)
            assertEq(JSON.stringify(land(first)), JSON.stringify({ ...fourth, shown: first.shown }))
            assertEq(land(demo.init), demo.init)
        },
        // A move made while another is showing lands that one first: 40 is
        // back in the tree before 10 comes out.
        landsFirst: () => {
            const game = move(10)(move(40)(level2))
            assertEq(JSON.stringify(assertNotNullish(game.versions).after), JSON.stringify(assertNotNullish(played(40)(level2).versions).after))
            assertEq(JSON.stringify([game.moves, game.last, game.note]), '[2,{"key":10,"changed":true},"10 comes out of the tree."]')
        },
        // A key that goes back where it was: counted too, shown out and in
        // again like any other, and said once it lands.
        goesBack: () => {
            const game = move(10)(level2)
            assertEq(JSON.stringify([game.moves, game.last, game.pending.length, game.note]), '[1,{"key":10,"changed":false},3,"10 comes out of the tree."]')
            const landed = land(game)
            assertEq(JSON.stringify(assertNotNullish(landed.versions).after), JSON.stringify(inOrder))
            assertEq(statusLine(landed)(inOrder), '1 move. Depth 3, goal 2. 7 nodes, goal 4. 10 went back where it was.')
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
            const game = played(40)(level2)
            assertEq(statusLine(game)(assertNotNullish(game.versions).after), '1 move. Depth 3, goal 2. 7 nodes, goal 4.')
        },
        // While a move shows, its trees are not counted: the board says
        // what the move is doing.
        halfway: () => {
            const game = move(40)(level2)
            assertEq(statusLine(game)(assertNotNullish(game.versions).after), '1 move. 40 comes out of the tree.')
            const out = step(game)
            assertEq(statusLine(out)(assertNotNullish(out.versions).after), '1 move. 40 is out of the tree.')
        },
        // Three moves make it perfect, and the game says so.
        won: () => {
            const game = played(50)(played(10)(played(40)(level2)))
            const tree = assertNotNullish(game.versions).after
            assertEq(JSON.stringify([depthOf(tree), nodeCount(tree)]), '[2,4]')
            assertEq(statusLine(game)(tree), 'Perfect, in 3 moves!')
        },
        // A tree that starts perfect is said to, not counted as a win.
        startedPerfect: () => {
            const perfect = assertNotNullish(played(50)(played(10)(played(40)(level2))).versions).after
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
            const perfect = assertNotNullish(played(50)(played(10)(played(40)(level2))).versions).after
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
            const won = played(50)(played(10)(played(40)({ ...level2, par: 3 })))
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
        // A move showing asks for its next frame, after the frame's time;
        // its frames come before a search's next turn, which follows the
        // last at once.
        frames: () => {
            const first = move(40)({ ...level2, par: parSearch(tensUpTo(8))(inOrder) })
            const { nextEvent, nextDelay } = demo
            assertEq(JSON.stringify(assertNotNullish(nextEvent)(first)), '{"kind":"click","name":"step"}')
            assertEq(assertNotNullish(nextDelay)(first), frameTime(first))
            const second = update({ kind: 'click', name: 'step' })(first)
            assertEq(JSON.stringify(second), JSON.stringify(step(first)))
            const last = land(first)
            assertEq(JSON.stringify(assertNotNullish(nextEvent)(last)), '{"kind":"click","name":"par"}')
            assertEq(assertNotNullish(nextDelay)(last), 0)
        },
        // A frame is held 150 ms for each order of its moving nodes, and one
        // with none moving, or no tree, is not held at all.
        frameTime: () => {
            assertEq(frameTime(demo.init), 0)
            assertEq(frameTime(level2), 0)
            const time = frameTime(move(40)(level2))
            assert(time > 0 && time % orderGap === 0, time)
        },
        // Leaving, the nodes the next tree does not share turn red (order 0)
        // and fade out from the leaves up from order 1; entering, after the
        // slide (order 0), the new ones fade in from the root down from order
        // 1. A rank fades as one, and a shared node not at all. Every node is
        // keyed by its keys.
        ordered: () => {
            /** @type {(kind: string, id: number, rank: number) => { readonly id: number, readonly kind: string, readonly label: string, readonly rank: number }} */
            const node = (kind, id, rank) => ({ id, kind, label: '', rank })
            const g = {
                nodes: [node('new', 0, 0), node('shared', 1, 1), node('new', 2, 2), node('new', 3, 2)],
                edges: [{ from: 1, to: { inline: '30' }, label: '' }, { from: 1, to: { inline: '40' }, label: '' }, { from: 0, to: 1, label: '' }],
            }
            const leave = ordered('leave')(g)
            assertEq(JSON.stringify(leave.nodes.map(n => [n.kind, n.order ?? null, n.key])),
                '[["leaving",2,""],["shared",null,"30,40"],["leaving",1,""],["leaving",1,""]]')
            const enter = ordered('enter')(g)
            assertEq(JSON.stringify(enter.nodes.map(n => [n.kind, n.order ?? null])),
                '[["new",1],["shared",null],["new",2],["new",2]]')
            // A tree just built is drawn as it is, unkeyed, so nothing slides
            // from the tree it replaced.
            assertEq(ordered('still')(g), g)
        },
        // The drawing's container alternates from frame to frame, so the
        // fades run again; a leaving frame marks its nodes leaving.
        replay: () => {
            const first = move(40)(level2)
            const h = html(first)
            assert(h.includes('data-graph-replay="b"'), h)
            assert(h.includes('data-graph-in-kind="leaving" data-graph-order="1"'), h)
            assert(html(step(first)).includes('data-graph-replay="a"'), '')
            // A click during the first or third frame lands that move and
            // shows the next one's first frame, and the flag still flips.
            /** @type {(game: Game) => string} */
            const flag = game => html(game).split('data-graph-replay="')[1].slice(0, 1)
            const third = step(step(first))
            assert(flag(move(10)(first)) !== flag(first), '')
            assert(flag(move(10)(third)) !== flag(third), '')
        },
        // No node is blue until the key is back: the remove's nodes fade
        // in plain, and the last frame draws blue every node the move
        // built, against the tree it started from.
        coloured: () => {
            /** @type {(game: Game) => readonly string[]} */
            const kinds = game => html(game).split('data-graph-kind="').slice(1).map(t => t.slice(0, t.indexOf('"'))).filter(k => k !== 'shared')
            const first = move(40)(level2)
            const second = step(first)
            assertEq(JSON.stringify(kinds(first).filter(k => k !== 'leaving')), '[]')
            assert(kinds(second).length > 0 && kinds(second).every(k => k === 'entering'), JSON.stringify(kinds(second)))
            const last = land(first)
            assert(kinds(last).length > 0 && kinds(last).every(k => k === 'new'), JSON.stringify(kinds(last)))
            const after = assertNotNullish(last.versions).after
            const built = graphOf(structure)({ before: inOrder, after }).nodes.filter(n => n.kind === 'new').length
            assertEq(kinds(last).length, built)
        },
        // The key moved is red where it comes out and green where it goes
        // back in, and nothing else is marked; a tree just built marks
        // nothing.
        marked: () => {
            /** @type {(game: Game) => readonly string[]} */
            const kinds = game => html(game).split('data-graph-value-kind="').slice(1).map(t => t.slice(0, t.indexOf('"')))
            const first = move(40)(level2)
            assertEq(JSON.stringify(kinds(first)), '["removed","removed"]')
            assertEq(JSON.stringify(kinds(step(first))), '[]')
            assertEq(JSON.stringify(kinds(land(first))), '["added","added"]')
            const g = { nodes: [], edges: [{ from: 0, to: { inline: '40' }, label: '' }], entries: [] }
            assertEq(marked('still')({ key: 40, changed: true })(g), g)
            assertEq(marked('enter')(null)(g), g)
        },
    },
    demo: {
        // The checkbox starts checked. Unchecked, a move lands at once,
        // drawn still against the tree it started from, and a move in
        // progress lands; a new tree keeps the choice.
        animate: () => {
            assert(html(level2).includes('<input type="checkbox" name="animate" checked="">'), html(level2))
            const showing = move(40)(level2)
            const off = update({ kind: 'input', name: 'animate', value: '' })(showing)
            assertEq(JSON.stringify([off.animate, off.pending.length, off.versions]), JSON.stringify([false, 0, land(showing).versions]))
            assert(html(off).includes('<input type="checkbox" name="animate">'), html(off))
            const moved = move(40)(off)
            const after = assertNotNullish(land(showing).versions).after
            const next = assertNotNullish(moved.versions)
            assertEq(JSON.stringify([moved.mode, moved.pending.length, moved.moves, moved.note]), '["still",0,2,null]')
            assertEq(JSON.stringify(next.before), JSON.stringify(after))
            assert(html(moved).includes('data-graph-kind="new"') && !html(moved).includes('entering'), html(moved))
            assertEq(update({ kind: 'input', name: 'animate', value: 'on' })(off).animate, true)
            assertEq(update({ kind: 'click', name: 'new' })(off).animate, false)
        },
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
