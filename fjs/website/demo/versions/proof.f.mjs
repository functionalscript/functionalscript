/**
 * @import { DemoEvent } from '../types.ts'
 * @import { Keys, Layout, State, Structure } from './types.ts'
 * @import { _Cell, _List } from './private.ts'
 */

import { census, decimal, graphOf, stepLine, versionsDemo } from './module.f.mjs'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { runPure } from '../../../effects/module.f.mjs'
import { unwrap } from '../../../types/result/module.f.mjs'
import { assert, assertEq, assertNotNullish } from '../../../asserts/module.f.mjs'

// The smallest persistent structure that shares: a sorted list whose
// insert and remove copy the cells before the change and share the rest. A
// step that finds nothing to do answers the same list.

/** @type {(key: number) => (list: _List) => _List} */
const insert = key => list =>
    list === null || key < list.key ? { key, next: list }
    : key === list.key ? list
    : { key: list.key, next: insert(key)(list.next) }

/** @type {(key: number) => (list: _List) => _List} */
const remove = key => list => {
    if (list === null || key < list.key) { return list }
    if (key === list.key) { return list.next }
    const next = remove(key)(list.next)
    return next === list.next ? list : { key: list.key, next }
}

/** @type {(layout: Layout) => Structure<_List, _Cell>} */
const chain = layout => ({
    empty: null,
    insert,
    remove,
    root: list => list,
    shape: () => ({
        rows: cell => [{ label: '', inline: String(cell.key) }, ...(cell.next === null ? [] : [{ label: 'next', to: cell.next }])],
        title: cell => cell.key === 1 ? 'first' : '',
        order: cell => cell.key,
        layout,
    }),
})

/** @type {_List} */
const nil = null

/** @type {(list: _List, key: number) => _List} */
const insertInto = (list, key) => insert(key)(list)

/** @type {(keys: readonly number[]) => _List} */
const listOf = keys => keys.reduce(insertInto, nil)

const ofThree = listOf([1, 2, 3])

/**
 * Keys typed in binary, up to four digits, and shown in four: a format of
 * the demo's own, as the Patricia trie's is.
 *
 * @type {Keys}
 */
const nibble = {
    parse: text => text.length >= 1 && text.length <= 4 && [...text].every(c => c === '0' || c === '1') ? parseInt(text, 2) : null,
    show: key => key.toString(2).padStart(4, '0'),
    label: 'Bits',
    accepts: 'up to four binary digits',
}

const { demo, load, press } = versionsDemo({
    structure: chain('depth'),
    name: 'chain',
    noun: 'list',
    intro: 'A list.',
    keys: nibble,
    presets: [
        ['Three', [1, 2, 3], 4, 'Press Insert to add 0100.'],
        ['Empty', [], 5, 'Press Insert to add 0101.'],
    ],
})

/** @type {(state: State<_List>) => string} */
const html = state => htmlToString(demo.view(state))

/** @type {(event: DemoEvent) => (state: State<_List>) => State<_List>} */
const update = event => state => unwrap(assertNotNullish(runPure(demo.update(state)(event))[0]))

/** @type {(s: string) => (part: string) => number} */
const count = s => part => s.split(part).length - 1

export const proof = {
    // The default keys: any safe integer, spelled as `String` spells it.
    decimal: () => {
        assertEq(decimal.parse('-12'), -12)
        assertEq(decimal.parse('07'), null)
        assertEq(decimal.parse('1e3'), null)
        assertEq(decimal.parse('NaN'), null)
        assertEq(decimal.show(12), '12')
    },
    graphOf: {
        // Inserting 0 in front builds one cell and shares the three after
        // it, which are drawn once. Both roots have an arrow, the old one
        // marked replaced — and so is nothing else, since the old root is
        // still the new root's next.
        sharesTheTail: () => {
            const after = insert(0)(ofThree)
            const g = graphOf(chain('depth'))({ before: ofThree, after })
            assertEq(JSON.stringify(g.nodes.map(n => [n.kind, n.label, n.rank])),
                '[["new","",0],["shared","first",1],["shared","",2],["shared","",3]]')
            assertEq(JSON.stringify(g.entries), '[{"to":1,"kind":"replaced"},{"to":0}]')
            assertEq(JSON.stringify(census(chain('depth'))({ before: ofThree, after })), '{"built":1,"shared":3,"replaced":0}')
        },
        // Inserting 4 at the end copies every cell: the old ones are
        // replaced, their edges marked so, and a replaced cell sorts above
        // the new one with its key.
        copiesThePath: () => {
            const after = insert(4)(ofThree)
            const g = graphOf(chain('depth'))({ before: ofThree, after })
            assertEq(JSON.stringify(g.nodes.map(n => n.kind)), '["replaced","new","replaced","new","replaced","new","new"]')
            assertEq(g.edges.filter(e => e.kind === 'replaced').length, 2)
            assertEq(g.edges.filter(e => typeof e.to !== 'number').length, 7)
        },
        // `leaves` puts every leaf in the last column: the old list is one
        // cell shorter, so its root starts a column further right.
        leaves: () => {
            const after = insert(4)(ofThree)
            const g = graphOf(chain('leaves'))({ before: ofThree, after })
            const ranks = g.nodes.map(n => n.rank)
            assertEq(JSON.stringify(ranks), '[1,0,2,1,3,2,3]')
        },
        // One root for both versions has one arrow; an empty version has
        // none.
        roots: () => {
            assertEq(JSON.stringify(graphOf(chain('depth'))({ before: ofThree, after: ofThree }).entries), '[{"to":0}]')
            assertEq(JSON.stringify(graphOf(chain('depth'))({ before: null, after: ofThree }).entries), '[{"to":0}]')
            assertEq(JSON.stringify(graphOf(chain('depth'))({ before: ofThree, after: null }).entries), '[{"to":0,"kind":"replaced"}]')
        },
    },
    stepLine: {
        counts: () => assertEq(stepLine('list')(String)({ op: 'insert', key: 4 })({ built: 1, shared: 3, replaced: 0 }),
            'Last step, insert 4: 1 new (blue), 3 shared with the list before, 0 replaced (amber).'),
        // A step that built nothing and left nothing behind says why.
        alreadyThere: () => assertEq(stepLine('list')(String)({ op: 'insert', key: 2 })({ built: 0, shared: 3, replaced: 0 }),
            'Last step, insert 2: nothing changed, the key is already in the list.'),
        notThere: () => assertEq(stepLine('list')(String)({ op: 'remove', key: 7 })({ built: 0, shared: 3, replaced: 0 }),
            'Last step, remove 7: nothing changed, the key is not in the list.'),
    },
    demo: {
        // The first preset, loaded: its keys as both versions, the key in
        // the field, its hint, and nothing coloured.
        opening: () => {
            assertEq(demo.init.key, '0100')
            assertEq(demo.init.versions.before, demo.init.versions.after)
            const h = html(demo.init)
            assert(h.includes('<p>A list.</p>'), h)
            assert(h.includes('<label for="chain-key">Bits </label>'), h)
            // The field holds the key as the demo's own format spells it.
            assert(h.includes('id="chain-key" name="key" value="0100"'), h)
            assert(h.includes('Press Insert to add 0100.'), h)
            assert(h.includes('<option value="Three" selected="">'), h)
            assertEq(count(h)('<svg'), 1)
            assertEq(count(h)('data-graph-kind="new"'), 0)
            assert(!h.includes('Error'), h)
        },
        // A press makes the new version the old one, and the drop-down
        // leaves the preset behind.
        press: () => {
            const s = press('insert')(demo.init)
            assertEq(s.versions.before, demo.init.versions.after)
            assertEq(JSON.stringify(s.status), '{"step":{"op":"insert","key":4}}')
            const h = html(s)
            // The step line spells the key the same way.
            assert(h.includes('Last step, insert 0100:'), h)
            assert(h.includes('Custom'), h)
        },
        // A field the format cannot read changes nothing, and says what it
        // takes.
        refused: () => {
            const s = press('insert')({ ...demo.init, key: '2' })
            assertEq(s.versions, demo.init.versions)
            assertEq(s.status, demo.init.status)
            assert(html(s).includes('Error: &quot;2&quot; is not a key: type up to four binary digits.'), '')
            // The next good press clears it.
            assertEq(press('insert')({ ...s, key: '101' }).error, null)
        },
        // An empty version has no node: it is said instead, and two of them
        // draw no graph at all.
        empty: () => {
            const loaded = html(load('Empty'))
            assertEq(count(loaded)('<svg'), 0)
            assert(loaded.includes('Before is the empty list.'), loaded)
            assert(loaded.includes('After is the empty list.'), loaded)
            const one = press('insert')(load('Empty'))
            const h = html(one)
            assertEq(count(h)('<svg'), 1)
            assert(h.includes('Before is the empty list.'), h)
            assert(!h.includes('After is the empty list.'), h)
            const gone = html(press('remove')(one))
            assert(gone.includes('After is the empty list.'), gone)
            assert(!gone.includes('Before is the empty list.'), gone)
        },
        // Typing changes the field only; a button applies it; picking a
        // preset loads it; anything else is ignored.
        update: () => {
            const typed = update({ kind: 'input', name: 'key', value: '110' })(demo.init)
            assertEq(typed.key, '110')
            assertEq(typed.versions, demo.init.versions)
            assertEq(JSON.stringify(update({ kind: 'click', name: 'insert' })(typed).status), '{"step":{"op":"insert","key":6}}')
            assertEq(JSON.stringify(update({ kind: 'click', name: 'remove' })(typed).status), '{"step":{"op":"remove","key":6}}')
            assertEq(update({ kind: 'input', name: 'example', value: 'Empty' })(typed).key, '0101')
            assertEq(update({ kind: 'click', name: 'other' })(typed), typed)
            assertEq(update({ kind: 'input', name: 'other', value: '1' })(typed), typed)
            assertEq(update({ kind: 'start' })(typed), typed)
        },
        // Without a format of its own, a demo takes decimal keys.
        open: () => {
            const open = versionsDemo({ structure: chain('leaves'), name: 'open', noun: 'list', intro: '', presets: [['One', [1], 2, '']] })
            assert(htmlToString(open.demo.view(open.demo.init)).includes('<label for="open-key">Key </label>'), '')
            assert(htmlToString(open.demo.view(open.press('insert')({ ...open.demo.init, key: 'x' }))).includes('type an integer.'), '')
            assertEq(open.graphOf(open.demo.init.versions).nodes.length, 1)
        },
        // A name no preset has is a bug in whatever sent it.
        throw: () => load('no such preset'),
    },
}
