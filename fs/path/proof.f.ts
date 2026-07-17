import { concat, isProperPrefix, join, normalize, relativize, toPosix } from "./module.f.ts"
import { assertEq } from '../asserts/module.f.ts'

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

export const proof = { normalizeTest, concatTest, joinTest, relativizeTest, toPosixTest, isProperPrefixTest }
