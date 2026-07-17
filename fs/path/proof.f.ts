import { concat, isProperPrefix, join, normalize, relativize, toPosix } from "./module.f.ts"
import { assert } from '../asserts/module.f.ts'

const normalizeTest = [
    () => {
        const norm = normalize("dir/file.json")
        assert(norm === "dir/file.json", norm)
    },
    () => {
        const norm = normalize("dir//file.json")
        assert(norm === "dir/file.json", norm)
    },
    () => {
        const norm = normalize("../../dir/file.json")
        assert(norm === "../../dir/file.json", norm)
    },
    () => {
        const norm = normalize("../../dir/../file.json")
        assert(norm === "../../file.json", norm)
    },
]

const concatTest = [
    () => {
        const c = concat("a")("b")
        assert(c === "a/b", c)
    },
    () => {
        const c = concat("a///b/")("c")
        assert(c === "a/b/c", c)
    },
    () => {
        const c = concat("a/../b/..")("c")
        assert(c === "c", c)
    },
]

const joinTest = [
    () => {
        const r = join('a', 'b')
        assert(r === 'a/b', r)
    },
    () => {
        const r = join('/abs/root', 'x')
        assert(r === '/abs/root/x', r)
    },
    () => {
        const r = join('a', 'b', 'c', 'd')
        assert(r === 'a/b/c/d', r)
    },
    () => {
        const r = join('', 'x')
        assert(r === '/x', r)
    },
    () => {
        const r = join()
        assert(r === '', r)
    },
    () => {
        const r = join('only')
        assert(r === 'only', r)
    },
]

const relativizeTest = [
    () => {
        const r = relativize('/repo', '/repo/fs/a.ts')
        assert(r === './fs/a.ts', r)
    },
    () => {
        const r = relativize('/repo', '/other/a.ts')
        assert(r === '/other/a.ts', r)
    },
    () => {
        const r = relativize('', './fs/a.ts')
        assert(r === './fs/a.ts', r)
    },
]
const toPosixTest = [
    () => {
        const p = toPosix('a\\b\\c')
        assert(p === 'a/b/c', p)
    },
    () => {
        const p = toPosix('a/b/c')
        assert(p === 'a/b/c', p)
    },
    () => {
        const p = toPosix('C:\\Users\\x')
        assert(p === 'C:/Users/x', p)
    },
    () => {
        const p = toPosix('')
        assert(p === '', p)
    },
]

const isProperPrefixTest = [
    () => {
        const r = isProperPrefix(['a', 'b'], ['a', 'b', 'c'])
        assert(r === true, r)
    },
    () => {
        const r = isProperPrefix(['a', 'b'], ['a', 'b'])
        assert(r === false, r)
    },
    () => {
        const r = isProperPrefix(['a', 'x'], ['a', 'b', 'c'])
        assert(r === false, r)
    },
    () => {
        const r = isProperPrefix(['a', 'b', 'c'], ['a', 'b'])
        assert(r === false, r)
    },
    () => {
        const r = isProperPrefix([], ['a'])
        assert(r === true, r)
    },
    () => {
        const r = isProperPrefix([], [])
        assert(r === false, r)
    },
]

export const proof = { normalizeTest, concatTest, joinTest, relativizeTest, toPosixTest, isProperPrefixTest }
