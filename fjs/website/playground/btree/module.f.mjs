/**
 * The B-tree compaction game: make a random B-tree perfect — every node
 * full, two keys each — with one move only. Click a key, and it is removed
 * and inserted again.
 *
 * **The keys never change, only the shape does.** A remove that empties a
 * leaf merges or borrows, and the insert that follows can split somewhere
 * else, so the key can come back in another place. A key in a leaf with
 * room goes back where it was, and the game says so rather than count it as
 * nothing at all: it is a move, and it is spent.
 *
 * **A level is a depth**, and its key count is the one a perfect tree of
 * that depth holds: `3^d - 1` keys in `(3^d - 1) / 2` full nodes. With that
 * many keys, a tree of that many nodes has every node full, so counting the
 * nodes is the whole test for a win.
 *
 * **A level starts from its keys inserted in random order**, one
 * `randomInt` per key, as the B-tree demo's Generate does; the first tree is
 * built when the page starts. The tree is drawn by the B-tree demo's
 * {@link structure}, so each move shows the nodes it built in blue.
 *
 * **Par is the fewest moves from the start to a perfect tree**, found by a
 * breadth-first search over the move: every tree one move from the start,
 * then two, until one is perfect. At depth 3 that meets thousands of trees,
 * so the search tries a few dozen of them a turn, through `nextEvent`, and
 * the board says it is working until it is done. Depth 4's trees are too
 * many to search, and that level has no par ([todo](./todo/par.md)).
 *
 * @module
 *
 * @import { Tree } from '../../../types/btree/types/types.ts'
 * @import { Result as ListResult } from '../../../types/list/types.ts'
 * @import { Demo, DemoEvent } from '../../demo/types.ts'
 * @import { RandomInt } from '../../../effects/common/types.ts'
 * @import { Effect } from '../../../effects/types.ts'
 * @import { Element } from '../../../media/html/types.ts'
 * @import { Game, Par, Search } from './types.ts'
 */

import { structure, tensUpTo } from '../../../types/btree/demo.f.mjs'
import { decimal, graphOf, sameShape, shuffled } from '../../demo/versions/module.f.mjs'
import { graphSvg } from '../../demo/graph/module.f.mjs'
import { refusal } from '../../demo/module.f.mjs'
import { errorMessage, pureOk, resultStep } from '../../../effects/module.f.mjs'
import { contains, empty as emptySet, set as setAdd } from '../../../types/string_set/module.f.mjs'
import { toArray } from '../../../types/list/module.f.mjs'

/** The levels, by depth. */
export const depths = [2, 3, 4]

/** How many keys a perfect tree of `depth` holds. @type {(depth: number) => number} */
export const keyCount = depth => 3 ** depth - 1

/** How many nodes a perfect tree of `depth` has, every one full. @type {(depth: number) => number} */
export const goalNodes = depth => keyCount(depth) / 2

/**
 * A tree's depth: every leaf of a B-tree is equally deep, so the first
 * path down is as long as any.
 *
 * @type {(tree: Tree<number>) => number}
 */
export const depthOf = tree => {
    if (tree === null) { return 0 }
    switch (tree.length) {
        case 1: case 2: { return 1 }
        case 3: case 5: { return 1 + depthOf(tree[0]) }
    }
}

/** @type {(tree: Tree<number>) => number} */
export const nodeCount = tree => {
    if (tree === null) { return 0 }
    switch (tree.length) {
        case 1: case 2: { return 1 }
        case 3: { return 1 + nodeCount(tree[0]) + nodeCount(tree[2]) }
        case 5: { return 1 + nodeCount(tree[0]) + nodeCount(tree[2]) + nodeCount(tree[4]) }
    }
}

/** The levels a par is searched for: depth 4's trees are too many. */
export const parDepths = [2, 3]

/** How many trees one turn of the search tries. */
export const turnBudget = 50

/** A key removed from `tree` and inserted again. @type {(key: number) => (tree: Tree<number>) => Tree<number>} */
const moveTree = key => tree => structure.insert(key)(structure.remove(key)(tree))

/** A tree's spelling, by which the search knows a tree it has met. @type {(tree: Tree<number>) => string} */
const spelling = tree => JSON.stringify(tree)

/**
 * The start of a search for the par of `tree`, a tree of `keys`: zero if
 * it is perfect already, or a search with the start as its only tree.
 *
 * @type {(keys: readonly number[]) => (tree: Tree<number>) => Par}
 */
export const parSearch = keys => tree => nodeCount(tree) * 2 === keys.length
    ? 0
    : { distance: 0, frontier: [tree], next: [], seen: setAdd(spelling(tree))(emptySet) }

/**
 * One turn of a search: up to `budget` of its frontier's trees, each moved by
 * every key. A tree met before is skipped, so each is tried once; the first
 * perfect one ends the search, `distance + 1` moves from the start, which is
 * the fewest since every tree fewer moves away was tried before it. A
 * frontier spent moves the search a move further, and an empty one ends it
 * with no par.
 *
 * The trees a turn adds are gathered in a list, newest first, and joined to
 * `next` once: an array grown a tree at a time would be copied whole for
 * every tree, and a turn adds thousands. The order within a distance does
 * not change the par.
 *
 * @type {(keys: readonly number[]) => (budget: number) => (search: Search) => Par}
 */
export const searchStep = keys => budget => ({ distance, frontier, next, seen }) => {
    const perfect = keys.length / 2
    /** @type {{ readonly added: ListResult<Tree<number>>, readonly seen: Search['seen'], readonly found: boolean }} */
    const init = { added: null, seen, found: false }
    const tried = frontier.slice(0, budget).flatMap(tree => keys.map(key => moveTree(key)(tree))).reduce((acc, tree) => {
        const name = spelling(tree)
        return acc.found || contains(name)(acc.seen) ? acc
            : nodeCount(tree) === perfect ? { ...acc, found: true }
            : { added: { first: tree, tail: acc.added }, seen: setAdd(name)(acc.seen), found: false }
    }, init)
    const further = [...next, ...toArray(tried.added)]
    const rest = frontier.slice(budget)
    return tried.found ? distance + 1
        : rest.length > 0 ? { distance, frontier: rest, next: further, seen: tried.seen }
        : further.length > 0 ? { distance: distance + 1, frontier: further, next: [], seen: tried.seen }
        : null
}

const same = sameShape(structure)

const graph = graphOf(structure)

/**
 * A new random tree for the level of `depth`: the state the game starts a
 * level from, or the state it was in, saying why it could not.
 *
 * @type {(depth: number) => (game: Game) => Effect<RandomInt, Game, never>}
 */
export const start = depth => game => resultStep(shuffled(tensUpTo(keyCount(depth))), r => {
    if (r[0] === 'error') {
        /** @type {Game} */
        const refused = { ...game, depth, error: `No random tree: ${errorMessage(r[1])}.` }
        return pureOk(refused)
    }
    const tree = r[1].reduce((t, k) => structure.insert(k)(t), structure.empty)
    const par = parDepths.includes(depth) ? parSearch(tensUpTo(keyCount(depth)))(tree) : null
    /** @type {Game} */
    const started = { depth, versions: { before: tree, after: tree }, moves: 0, par, last: null, error: null }
    return pureOk(started)
})

/**
 * The move: `key` removed and inserted again, counted, and the tree drawn
 * against the one before it. One that comes back drawn as before answers
 * the tree it was given, so nothing is coloured.
 *
 * @type {(key: number) => (game: Game) => Game}
 */
export const move = key => game => {
    if (game.versions === null) { return game }
    const before = game.versions.after
    const moved = moveTree(key)(before)
    const changed = !same({ before, after: moved })
    return { ...game, versions: { before, after: changed ? moved : before }, moves: game.moves + 1, last: { key, changed }, error: null }
}

/** @type {(n: number) => string} */
const movesText = n => n === 1 ? '1 move' : `${n} moves`

/** What the board says of the par. @type {(par: Par) => string} */
const parText = par => par === null ? '' : typeof par === 'number' ? ` Par: ${movesText(par)}.` : ' Par: working it out…'

/**
 * Where the game stands: a win, or the depth and the node count against the
 * level's, and what the last move did if it changed nothing.
 *
 * @type {(game: Game) => (tree: Tree<number>) => string}
 */
export const statusLine = ({ depth, moves, par, last }) => tree => {
    const nodes = nodeCount(tree)
    if (nodes === goalNodes(depth)) {
        return moves === 0 ? 'This tree started perfect. Press New tree for another.' : `Perfect, in ${movesText(moves)}!${parText(par)}`
    }
    const back = last === null || last.changed ? '' : ` ${last.key} went back where it was.`
    return `${movesText(moves)}. Depth ${depthOf(tree)}, goal ${depth}. ${nodes} nodes, goal ${goalNodes(depth)}.${parText(par)}${back}`
}

/**
 * The game with its search a turn further, or as it was when no search is
 * running.
 *
 * @type {(game: Game) => Game}
 */
export const searchTurn = game => {
    const { par } = game
    return par === null || typeof par === 'number' ? game
        : { ...game, par: searchStep(tensUpTo(keyCount(game.depth)))(turnBudget)(par) }
}

/** @type {(name: string) => number | null} */
const movedKey = name => name.startsWith('move:') ? decimal.parse(name.slice(5)) : null

/** @type {(value: string) => number | undefined} */
const levelOf = value => depths.find(d => String(d) === value)

/** @type {(game: Game) => Element} */
const board = game => game.versions === null
    ? ['p', 'Building a random tree…']
    : ['div', ['p', statusLine(game)(game.versions.after)], graphSvg(graph(game.versions))]

/** @type {Demo<Game, DemoEvent, RandomInt>} */
export const demo = {
    init: { depth: depths[0], versions: null, moves: 0, par: null, last: null, error: null },
    nextEvent: ({ par }) => par === null || typeof par === 'number' ? null : { kind: 'click', name: 'par' },
    update: game => event => {
        if (event.kind === 'start' || (event.kind === 'click' && event.name === 'new')) { return start(game.depth)(game) }
        if (event.kind === 'click' && event.name === 'par') { return pureOk(searchTurn(game)) }
        const level = event.kind === 'input' && event.name === 'level' ? levelOf(event.value) : undefined
        if (level !== undefined) { return start(level)(game) }
        const key = event.kind === 'click' ? movedKey(event.name) : null
        return pureOk(key === null ? game : move(key)(game))
    },
    view: game => ['div',
        ['p', 'Make the tree perfect: every node full, two keys each. Your one move: click a key, and it is removed and inserted again. A new tree is its keys inserted in random order.'],
        ['p',
            ['label', { for: 'level' }, 'Level '],
            ['select', { id: 'level', name: 'level' }, ...depths.map(d => /** @type {Element} */ (['option',
                d === game.depth ? { value: String(d), selected: '' } : { value: String(d) },
                `Depth ${d}: ${keyCount(d)} keys`]))],
            ' ',
            ['button', { type: 'button', name: 'new' }, 'New tree'],
        ],
        ...(game.error === null ? [] : [refusal(game.error)]),
        board(game),
    ],
}
