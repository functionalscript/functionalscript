import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { latin1 } from '../testlib.f.mjs'
import { components, isComponent, isName } from './module.f.mjs'

/**
 * The components of a name, as strings, so a case reads as the name does.
 *
 * @type {(s: string) => readonly string[]}
 */
const split = s => components(latin1(s)).map(c => String.fromCharCode(...c))

export const proof = {
    // The components are the bytes between the slashes, so a name with
    // none is one component and an empty stretch is an empty component.
    // Measured against `git check-ref-format`, which refuses every name
    // below that has one: `refs/heads/a/`, `/a`, `a//b`.
    components: () => {
        assertStructurallySame(split('a'), ['a'])
        assertStructurallySame(split('a/b'), ['a', 'b'])
        assertStructurallySame(split('a/b/c'), ['a', 'b', 'c'])
        assertStructurallySame(split('a//b'), ['a', '', 'b'])
        assertStructurallySame(split('/a'), ['', 'a'])
        assertStructurallySame(split('a/'), ['a', ''])
        assertStructurallySame(split(''), [''])
        assertStructurallySame(split('/'), ['', ''])
    },
    // One component: not empty, not beginning with `.`, not ending in
    // `.lock`. A name merely holding `.lock` is not one ending in it.
    component: () => {
        for (const c of ['a', 'lock', 'x.locky', 'a.lockb', 'a.b', 'a.', '@']) {
            assert(isComponent(latin1(c)), c)
        }
        for (const c of ['', '.a', '.', 'a.lock', '.lock']) {
            assert(!isComponent(latin1(c)), c)
        }
    },
    // A name below a prefix: every rule `git check-ref-format` applies to
    // `<prefix>/<name>`, each accepted name and each refused one taken
    // from that command on Git 2.43.0.
    name: () => {
        for (const n of ['v1.0', 'release/1.0', 'a@b', 'a.b.c', 'lock', 'x.locky', 'a{b', 'a/b/c', '\xE9', '@', 'a./b']) {
            assert(isName(latin1(n)), n)
        }
        for (const n of [
            '', 'a b', 'a~b', 'a^b', 'a:b', 'a?b', 'a*b', 'a[b', 'a\\b', 'a\x01b', 'a\x7Fb',
            'a..b', 'a@{b', 'a.', '.a', 'a/.b', 'a.lock', 'a.lock/b', 'a/', '/a', 'a//b',
        ]) {
            assert(!isName(latin1(n)), n)
        }
    },
    // The two rules a reader would place wrongly, so they are pinned apart.
    // A trailing `.` is refused at the end of the whole name only, and
    // `.lock` at the end of any component: `git check-ref-format` takes
    // `refs/heads/a./b` and refuses `refs/heads/a/b.` and
    // `refs/a.lock/b`.
    whereTheRulesApply: () => {
        assert(isName(latin1('a./b')))
        assert(!isName(latin1('a/b.')))
        assert(!isName(latin1('a.lock/b')))
        assert(!isName(latin1('a/b.lock')))
    },
    // A name is as long as its author made it, and is checked once over
    // rather than once per byte: twenty thousand bytes, and the same in
    // slashes, which a rule applied per component per byte would not
    // finish.
    long: () => {
        assert(isName(latin1('n'.repeat(20000))))
        assert(isName(latin1(`${'n/'.repeat(10000)}n`)))
        // The same name with an empty last component is refused, so the
        // length is not what decides it.
        assert(!isName(latin1('n/'.repeat(10000))))
        assertEq(components(latin1('n/'.repeat(10000))).length, 10001)
    },
}
