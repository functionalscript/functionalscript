import { assert } from '../../asserts/module.f.mjs'
import { latin1 } from '../testlib.f.mjs'
import { hasRefComponents, isName, sameBytes } from './module.f.mjs'

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
    // The component half on its own, which a walk of `refs/` needs: it is what
    // Git's own walk skips without a word, and it is the only half safe to ask
    // about a *prefix*, since a component keeps its shape however a name is
    // extended.
    //
    // Measured on Git 2.43.0 by writing a valid id into each name under
    // `refs/heads/`: `.hidden` and `x.lock` are skipped by `show-ref` at exit 0,
    // while `bad.`, `a..b`, `a@{b`, `has space`, `tilde~x` and `caret^x` each
    // exit 128 with `bad ref`. The first two are the names this refuses.
    refComponents: () => {
        // every rule that is not a component's: a name this takes may still be
        // no ref name, and `bad.` is the one that matters to a walk — with
        // `refs/heads/bad.` a link to `refs/tags`, Git lists
        // `refs/heads/bad./v1`, which `check-ref-format` accepts.
        for (const n of ['a', 'a/b', 'bad.', 'a..b', 'a@{b', 'has space', 'tilde~x', 'caret^x', 'lock', 'a.locky', '@']) {
            assert(hasRefComponents(latin1(n)), n)
        }
        // and the two conventions, at any depth, plus the empty component a
        // path never produces
        for (const n of ['.hidden', 'x.lock', 'a/.hidden', 'a/x.lock', '.hidden/b', 'x.lock/b', '', 'a//b', '/a', 'a/']) {
            assert(!hasRefComponents(latin1(n)), n)
        }
        // The whole-name rule is the stricter one, and the difference is
        // exactly the names in the first list that `isName` refuses.
        for (const n of ['bad.', 'a..b', 'has space']) {
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
    // Byte for byte and nothing more: a prefix, a longer name and a name
    // differing only in case are each another name. A lazy list is one list
    // of the same bytes as the array it spells.
    sameBytes: () => {
        assert(sameBytes(latin1('main'))(latin1('main')))
        assert(sameBytes([])([]))
        assert(sameBytes(() => [0x61, 0x62])([0x61, 0x62]))
        assert(!sameBytes(latin1('main'))(latin1('mai')))
        assert(!sameBytes(latin1('mai'))(latin1('main')))
        assert(!sameBytes(latin1('main'))(latin1('Main')))
        assert(!sameBytes([])(latin1('a')))
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
