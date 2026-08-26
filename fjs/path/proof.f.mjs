import { concat, escapes, isProperPrefix, join, normalize, parse, relativize, root, toPosix } from "./module.f.mjs"
import { assertEq } from '../asserts/module.f.mjs'

const normalizeTest = [
    () => {
        const norm = normalize("dir/file.json")
        assertEq(norm, "dir/file.json")
    },
    () => {
        const norm = normalize("dir//file.json")
        assertEq(norm, "dir/file.json")
    },
    () => {
        const norm = normalize("../../dir/file.json")
        assertEq(norm, "../../dir/file.json")
    },
    () => {
        const norm = normalize("../../dir/../file.json")
        assertEq(norm, "../../file.json")
    },
    // A root survives normalization: it is not a segment, so it is not one of
    // the empty ones the fold drops.
    () => {
        const norm = normalize("/a/b")
        assertEq(norm, "/a/b")
    },
    () => {
        const norm = normalize("//srv/share")
        assertEq(norm, "//srv/share")
    },
    () => {
        const norm = normalize("/")
        assertEq(norm, "/")
    },
    // `..` has no parent of the root to name, so it is dropped — while the
    // same input without a root keeps it.
    () => {
        const norm = normalize("/a/../..")
        assertEq(norm, "/")
    },
    () => {
        const norm = normalize("a/../..")
        assertEq(norm, "..")
    },
    // A drive letter is an ordinary segment and needs no case of its own.
    () => {
        const norm = normalize("C:/a/b")
        assertEq(norm, "C:/a/b")
    },
    () => {
        const norm = normalize("C:\\a\\b")
        assertEq(norm, "C:/a/b")
    },
    // An *interior* empty segment is still noise: only the leading one is a root.
    () => {
        const norm = normalize("a//b")
        assertEq(norm, "a/b")
    },
    () => {
        const norm = normalize("")
        assertEq(norm, "")
    },
]

const escapesTest = [
    // A `..` that cancels a real segment does not escape; one with nothing
    // left to cancel does. `parse` cannot answer this — it folds with the root
    // in place, which is exactly what removes the escaping `..`.
    () => {
        assertEq(escapes("/a/../b"), false)
    },
    () => {
        assertEq(escapes("/../b"), true)
    },
    () => {
        assertEq(escapes("a/../../b"), true)
    },
    () => {
        assertEq(escapes("a/b/../c"), false)
    },
    // Taking the root off is not the same as dropping one leading `/`: these
    // remainders read as rooted again, and a second fold would clamp the very
    // `..` being looked for.
    () => {
        assertEq(escapes("///../secret"), true)
    },
    () => {
        assertEq(escapes("/C:/../../secret"), true)
    },
    () => {
        assertEq(escapes("//../secret"), true)
    },
    () => {
        assertEq(escapes("C:/../secret"), true)
    },
    () => {
        assertEq(escapes(""), false)
    },
]

const rootTest = [
    () => {
        const r = root("a/b")
        assertEq(r, "")
    },
    () => {
        const r = root("/a/b")
        assertEq(r, "/")
    },
    () => {
        const r = root("//srv/share")
        assertEq(r, "//")
    },
    // Three or more leading slashes are an ordinary root followed by empty
    // segments, which is what POSIX requires; exactly two are the UNC case.
    () => {
        const r = root("///a")
        assertEq(r, "/")
    },
    () => {
        const norm = normalize("///a")
        assertEq(norm, "/a")
    },
    // Windows spells the UNC root with backslashes.
    () => {
        const r = root("\\\\srv\\share")
        assertEq(r, "//")
    },
    // A Windows drive is a root, so `..` cannot climb off it — `C:\\..` is
    // `C:\\` on Windows, not the parent of the drive.
    () => {
        const r = root("C:/a")
        assertEq(r, "C:/")
    },
    () => {
        const r = root("c:/a")
        assertEq(r, "c:/")
    },
    () => {
        const norm = normalize("C:/..")
        assertEq(norm, "C:/")
    },
    () => {
        const norm = normalize("C:/a/../../..")
        assertEq(norm, "C:/")
    },
    () => {
        const norm = normalize("C:/")
        assertEq(norm, "C:/")
    },
    // Only the absolute spelling roots. A bare `C:` and the drive-relative
    // `C:foo` — the current directory *on* drive C — stay ordinary segments,
    // and a prefix that is not a single letter is not a drive at all.
    () => {
        const r = root("C:")
        assertEq(r, "")
    },
    () => {
        const r = root("C:a/b")
        assertEq(r, "")
    },
    () => {
        const r = root("1:/x")
        assertEq(r, "")
    },
    () => {
        const r = root("ab:/x")
        assertEq(r, "")
    },
    // The UNC root stops at `//`: `server/share` are ordinary segments, so a
    // `..` can still climb past a share. Parsing them into the root would let
    // a `../` fold into it, which is what a root must never allow.
    () => {
        const c = concat("//srv/share")("../..")
        assertEq(c, "//")
    },
    () => {
        const p = parse("//a/b")
        assertEq(join(...p), "a/b")
    },
]

const parseTest = [
    // `parse` answers with segments only, so an absolute and a relative path
    // that name the same segments are indistinguishable through it. `root`
    // is what tells them apart.
    () => {
        const p = parse("/a/b")
        assertEq(join(...p), "a/b")
    },
    () => {
        const p = parse("a/b")
        assertEq(join(...p), "a/b")
    },
    // The root still reaches the fold: a `..` that would escape it is dropped.
    () => {
        const p = parse("/..")
        assertEq(p.length, 0)
    },
    () => {
        const p = parse("..")
        assertEq(join(...p), "..")
    },
    () => {
        const p = parse("../..")
        assertEq(join(...p), "../..")
    },
]

const concatTest = [
    () => {
        const c = concat("a")("b")
        assertEq(c, "a/b")
    },
    () => {
        const c = concat("a///b/")("c")
        assertEq(c, "a/b/c")
    },
    () => {
        const c = concat("a/../b/..")("c")
        assertEq(c, "c")
    },
    // The root comes from `a`, so `concat` no longer turns an absolute path
    // into a relative one. This is the shape `fjs compile` resolves imports
    // with: `concat(concat(path)('..'))(importPath)`.
    () => {
        const c = concat("/a/b/m.f.js")("..")
        assertEq(c, "/a/b")
    },
    () => {
        const c = concat("//srv/share/m.f.js")("..")
        assertEq(c, "//srv/share")
    },
    () => {
        const c = concat("/a/b")("../c")
        assertEq(c, "/a/c")
    },
    () => {
        const c = concat("/")("y")
        assertEq(c, "/y")
    },
    () => {
        const c = concat("/a")("../..")
        assertEq(c, "/")
    },
    () => {
        const c = concat("C:/a/b/m.f.js")("..")
        assertEq(c, "C:/a/b")
    },
    () => {
        const c = concat(concat("C:/a/m.f.js")(".."))("../../lib.f.js")
        assertEq(c, "C:/lib.f.js")
    },
    // A bare drive is not a root, and `concat` does not make it one: joined
    // with a separator, `C:` and `dir` would be the drive root `C:/dir`
    // instead of the drive-relative `C:dir` — a different place on the disk.
    () => {
        const c = concat("C:")("dir")
        assertEq(c, "C:dir")
    },
    () => {
        const r = root(concat("C:")("dir"))
        assertEq(r, "")
    },
    // The drive-absolute spelling is still reachable, and still a root.
    () => {
        const c = concat("C:/")("dir")
        assertEq(c, "C:/dir")
    },
    () => {
        const r = root(concat("C:/")("dir"))
        assertEq(r, "C:/")
    },
    // Only a real bare drive skips the separator.
    () => {
        const c = concat("ab:")("dir")
        assertEq(c, "ab:/dir")
    },
    () => {
        const c = concat("C:")("/abs")
        assertEq(c, "/abs")
    },
    // The left side is folded before its root is read, so every spelling of a
    // bare drive is one — testing the unfolded text caught only the literal.
    () => {
        const c = concat("./C:")("dir")
        assertEq(c, "C:dir")
    },
    () => {
        const c = concat("x/../C:")("dir")
        assertEq(c, "C:dir")
    },
    // Whatever `a` spells, appending a relative `b` leaves its root alone.
    () => {
        ["C:", "./C:", "x/../C:", "C:/", "./a", "/a", "//a", "", "."].forEach(a =>
            assertEq(root(concat(a)("dir")), root(normalize(a)), a))
    },
    // An absolute `b` names a path on its own, so it replaces `a` rather than
    // being appended to it.
    () => {
        const c = concat("a")("/abs/x")
        assertEq(c, "/abs/x")
    },
    () => {
        const c = concat("/a/b")("//srv/share")
        assertEq(c, "//srv/share")
    },
    // The separator `concat` inserts is not a root: with an empty `a`, a
    // leading `..` in `b` still has nothing to escape.
    () => {
        const c = concat("")("../lib.f.js")
        assertEq(c, "../lib.f.js")
    },
    () => {
        const c = concat("")("./lib.f.js")
        assertEq(c, "lib.f.js")
    },
]

const joinTest = [
    () => {
        const r = join('a', 'b')
        assertEq(r, 'a/b')
    },
    () => {
        const r = join('/abs/root', 'x')
        assertEq(r, '/abs/root/x')
    },
    () => {
        const r = join('a', 'b', 'c', 'd')
        assertEq(r, 'a/b/c/d')
    },
    () => {
        const r = join('', 'x')
        assertEq(r, '/x')
    },
    () => {
        const r = join()
        assertEq(r, '')
    },
    () => {
        const r = join('only')
        assertEq(r, 'only')
    },
]

const relativizeTest = [
    () => {
        const r = relativize('/repo', '/repo/fs/a.ts')
        assertEq(r, './fs/a.ts')
    },
    () => {
        const r = relativize('/repo', '/other/a.ts')
        assertEq(r, '/other/a.ts')
    },
    () => {
        const r = relativize('', './fs/a.ts')
        assertEq(r, './fs/a.ts')
    },
]
const toPosixTest = [
    () => {
        const p = toPosix('a\\b\\c')
        assertEq(p, 'a/b/c')
    },
    () => {
        const p = toPosix('a/b/c')
        assertEq(p, 'a/b/c')
    },
    () => {
        const p = toPosix('C:\\Users\\x')
        assertEq(p, 'C:/Users/x')
    },
    () => {
        const p = toPosix('')
        assertEq(p, '')
    },
]

const isProperPrefixTest = [
    () => {
        const r = isProperPrefix(['a', 'b'], ['a', 'b', 'c'])
        assertEq(r, true)
    },
    () => {
        const r = isProperPrefix(['a', 'b'], ['a', 'b'])
        assertEq(r, false)
    },
    () => {
        const r = isProperPrefix(['a', 'x'], ['a', 'b', 'c'])
        assertEq(r, false)
    },
    () => {
        const r = isProperPrefix(['a', 'b', 'c'], ['a', 'b'])
        assertEq(r, false)
    },
    () => {
        const r = isProperPrefix([], ['a'])
        assertEq(r, true)
    },
    () => {
        const r = isProperPrefix([], [])
        assertEq(r, false)
    },
]

export const proof = { normalizeTest, escapesTest, rootTest, parseTest, concatTest, joinTest, relativizeTest, toPosixTest, isProperPrefixTest }
