import { concat, isProperPrefix, join, normalize, parse, relativize, root, toPosix } from "./module.f.mjs"
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
    () => {
        const r = root("C:/a")
        assertEq(r, "")
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

export const proof = { normalizeTest, rootTest, parseTest, concatTest, joinTest, relativizeTest, toPosixTest, isProperPrefixTest }
