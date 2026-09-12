import { assert } from '../../asserts/module.f.mjs'
import { latin1 } from '../testlib.f.mjs'
import { isName } from './module.f.mjs'

export const proof = {
    // A name below a prefix: every rule `git check-ref-format` applies to
    // `<prefix>/<name>`, each accepted name and each refused one taken from
    // that command on Git 2.43.0.
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
    // The components are the bytes between the slashes, and each must be
    // one: not empty, not beginning with `.`, not ending in `.lock`. The
    // splitting shows in which names are refused — an empty component is
    // what refuses `/a`, `a/` and `a//b`, and a name with no slash at all is
    // one component, so `lock` passes where `a.lock` does not.
    components: () => {
        for (const n of ['a', 'a/b', 'a/b/c', 'lock', 'a.locky']) {
            assert(isName(latin1(n)), n)
        }
        for (const n of ['/a', 'a/', 'a//b', '/', 'a/.b', 'a/b.lock']) {
            assert(!isName(latin1(n)), n)
        }
    },
    // The two rules a reader would place wrongly, so they are pinned apart.
    // A trailing `.` is refused at the end of the whole name only, and
    // `.lock` at the end of any component: `git check-ref-format` takes
    // `refs/heads/a./b` and refuses `refs/heads/a/b.` and `refs/a.lock/b`.
    whereTheRulesApply: () => {
        assert(isName(latin1('a./b')))
        assert(!isName(latin1('a/b.')))
        assert(!isName(latin1('a.lock/b')))
        assert(!isName(latin1('a/b.lock')))
    },
    // A name is as long as its author made it, and is checked once over
    // rather than once per byte: twenty thousand bytes, and the same in
    // slashes, which a rule applied per component per byte would not finish.
    long: () => {
        assert(isName(latin1('n'.repeat(20000))))
        assert(isName(latin1(`${'n/'.repeat(10000)}n`)))
        // The same name with an empty last component is refused, so the
        // length is not what decides it.
        assert(!isName(latin1('n/'.repeat(10000))))
    },
    throw: {
        // A value that is no byte is a caller's bug, not a name that is not
        // one, and `byteArray` is where this repository refuses it. Both of
        // these would otherwise be answered `true`: no rule has an upper
        // bound, and `every` steps over a hole without looking at it.
        aboveAByte: () => isName([256]),
        holeInASparseArray: () => isName(new Array(1)),
    },
}
