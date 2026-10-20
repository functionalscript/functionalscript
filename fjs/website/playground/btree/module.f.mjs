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
 * **A move is shown node by node, in four frames**: the nodes the remove
 * replaces fade out, from the leaf up; the nodes it built fade in, from the
 * root down — a leaf merged or borrowed from; then the same for the insert
 * — a leaf split. Each node takes {@link orderGap} after the one before
 * it, and a frame is held until its last node is done. A move that changes
 * nothing has nothing to show, and lands at once.
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
 * @import { Frame, Game, Mode, Par, Search } from './types.ts'
 * @import { Graph } from '../../demo/graph/types.ts'
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

/**
 * How long, in milliseconds, a node of a move takes to fade, and how long
 * after the node before it it starts: the site's stylesheet fades each
 * `data-graph-order` a second after the one before.
 */
export const orderGap = 1000

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
 * level from, or the game as it was — its level, its tree and its par search
 * — saying why it could not. A refusal changes nothing else: a search kept
 * under another level's depth would go on with that level's keys.
 *
 * @type {(depth: number) => (game: Game) => Effect<RandomInt, Game, never>}
 */
export const start = depth => game => resultStep(shuffled(tensUpTo(keyCount(depth))), r => {
    if (r[0] === 'error') {
        /** @type {Game} */
        const refused = { ...game, error: `No random tree: ${errorMessage(r[1])}.` }
        return pureOk(refused)
    }
    const tree = r[1].reduce((t, k) => structure.insert(k)(t), structure.empty)
    const par = parDepths.includes(depth) ? parSearch(tensUpTo(keyCount(depth)))(tree) : null
    /** @type {Game} */
    const started = { depth, versions: { before: tree, after: tree }, mode: 'enter', note: null, pending: [], moves: 0, par, last: null, error: null }
    return pureOk(started)
})

/**
 * The game showing `frame`, with `pending` still to come.
 *
 * @type {(frame: Frame) => (pending: readonly Frame[]) => (game: Game) => Game}
 */
const showing = ({ versions, mode, note }) => pending => game => ({ ...game, versions, mode, note, pending })

/**
 * The next frame of a move, or the game as it was when none is to come.
 *
 * @type {(game: Game) => Game}
 */
export const step = game => {
    const [next, ...rest] = game.pending
    return next === undefined ? game : showing(next)(rest)(game)
}

/**
 * A move's last frame at once: what a move made while another is still
 * showing starts from. With none showing, the game as it was.
 *
 * @type {(game: Game) => Game}
 */
export const land = game => {
    const last = game.pending.at(-1)
    return last === undefined ? game : showing(last)([])(game)
}

/**
 * The move: `key` removed and inserted again, and counted. A move that
 * comes back drawn as before shows the tree it was given, at once, so
 * nothing fades. Any other shows its four frames, the first now and the
 * rest through {@link step}: the remove's nodes leave and enter, then the
 * insert's. A move made while another is showing lands that one first.
 *
 * @type {(key: number) => (game: Game) => Game}
 */
export const move = key => game => {
    const landed = land(game)
    if (landed.versions === null) { return landed }
    const before = landed.versions.after
    const removed = structure.remove(key)(before)
    const moved = structure.insert(key)(removed)
    const changed = !same({ before, after: moved })
    const counted = { ...landed, moves: landed.moves + 1, last: { key, changed }, error: null }
    if (!changed) { return showing({ versions: { before, after: before }, mode: 'enter', note: null })([])(counted) }
    /** @type {readonly [Frame, ...Frame[]]} */
    const [first, ...rest] = [
        { versions: { before: removed, after: before }, mode: 'leave', note: `${key} comes out of the tree.` },
        { versions: { before, after: removed }, mode: 'enter', note: `${key} is out of the tree.` },
        { versions: { before: moved, after: removed }, mode: 'leave', note: `${key} goes back in.` },
        { versions: { before: removed, after: moved }, mode: 'enter', note: null },
    ]
    return showing(first)(rest)(counted)
}
/** @type {(n: number) => string} */
const movesText = n => n === 1 ? '1 move' : `${n} moves`

/** What the board says of the par. @type {(par: Par) => string} */
const parText = par => par === null ? '' : typeof par === 'number' ? ` Par: ${movesText(par)}.` : ' Par: working it out…'

/**
 * Where the game stands: what a move is doing while it shows, a win, or the
 * depth and the node count against the level's, and what the last move did
 * if it changed nothing. While a move shows, its trees are not counted: a
 * key short of 8, 7 keys can fill the 4 nodes a win at depth 2 needs.
 *
 * @type {(game: Game) => (tree: Tree<number>) => string}
 */
export const statusLine = ({ depth, note, moves, par, last }) => tree => {
    if (note !== null) { return `${movesText(moves)}. ${note}` }
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

/**
 * A frame's graph, its moving nodes in order. Entering, the nodes it built
 * are new, and fade in from the root down, one rank at a time; leaving,
 * the nodes the next tree does not share — new, against it — are
 * `leaving`, and fade out from the leaves up.
 *
 * @type {(mode: Mode) => (g: Graph) => Graph}
 */
export const ordered = mode => g => {
    const ranks = [...new Set(g.nodes.flatMap(n => n.kind === 'new' ? [n.rank] : []))].toSorted((a, b) => mode === 'enter' ? a - b : b - a)
    return {
        ...g,
        nodes: g.nodes.map(n => n.kind !== 'new' ? n : { ...n, kind: mode === 'enter' ? 'new' : 'leaving', order: ranks.indexOf(n.rank) }),
    }
}

/**
 * The frame on the board, as a graph, or none before the first tree. A
 * leaving frame draws the tree it shows against the next one, which is
 * what it marks.
 *
 * @type {(game: Game) => Graph | null}
 */
const drawn = ({ versions, mode }) => versions === null ? null : ordered(mode)(graph(versions))

/**
 * How long the frame on the board is held: a second for each order of its
 * moving nodes, so the last has faded before the next frame.
 *
 * @type {(game: Game) => number}
 */
export const frameTime = game => {
    const g = drawn(game)
    const orders = g === null ? [] : g.nodes.flatMap(n => n.order === undefined ? [] : [n.order])
    return (orders.reduce((m, o) => o > m ? o : m, -1) + 1) * orderGap
}

/**
 * The board: its status and the frame drawn. The drawing's container
 * alternates `data-graph-replay` from frame to frame, by how many frames
 * are still to come, which restarts its fades: the page updates its
 * elements in place, and an animation runs again only when its name does.
 *
 * @type {(game: Game) => Element}
 */
const board = game => {
    const g = drawn(game)
    return game.versions === null || g === null
        ? ['p', 'Building a random tree…']
        : ['div', ['p', statusLine(game)(game.versions.after)],
            ['div', { 'data-graph-replay': game.pending.length % 2 === 0 ? 'a' : 'b' }, graphSvg(g)]]
}

/** @type {Demo<Game, DemoEvent, RandomInt>} */
export const demo = {
    init: { depth: depths[0], versions: null, mode: 'enter', note: null, pending: [], moves: 0, par: null, last: null, error: null },
    nextEvent: ({ pending, par }) => pending.length > 0 ? { kind: 'click', name: 'step' }
        : par === null || typeof par === 'number' ? null
        : { kind: 'click', name: 'par' },
    nextDelay: game => game.pending.length > 0 ? frameTime(game) : 0,
    update: game => event => {
        if (event.kind === 'start' || (event.kind === 'click' && event.name === 'new')) { return start(game.depth)(game) }
        if (event.kind === 'click' && event.name === 'step') { return pureOk(step(game)) }
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
