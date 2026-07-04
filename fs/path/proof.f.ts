import { concat, isProperPrefix, join, normalize, relativize, toPosix } from "./module.f.ts"

const normalizeTest = [
    () => {
        const norm = normalize("dir/file.json")
        if (norm !== "dir/file.json") { throw norm }
    },
    () => {
        const norm = normalize("dir//file.json")
        if (norm !== "dir/file.json") { throw norm }
    },
    () => {
        const norm = normalize("../../dir/file.json")
        if (norm !== "../../dir/file.json") { throw norm }
    },
    () => {
        const norm = normalize("../../dir/../file.json")
        if (norm !== "../../file.json") { throw norm }
    },
]

const concatTest = [
    () => {
        const c = concat("a")("b")
        if (c !== "a/b") { throw c }
    },
    () => {
        const c = concat("a///b/")("c")
        if (c !== "a/b/c") { throw c }
    },
    () => {
        const c = concat("a/../b/..")("c")
        if (c !== "c") { throw c }
    },
]

const joinTest = [
    () => {
        const r = join('a', 'b')
        if (r !== 'a/b') { throw r }
    },
    () => {
        const r = join('/abs/root', 'x')
        if (r !== '/abs/root/x') { throw r }
    },
    () => {
        const r = join('a', 'b', 'c', 'd')
        if (r !== 'a/b/c/d') { throw r }
    },
    () => {
        const r = join('', 'x')
        if (r !== '/x') { throw r }
    },
    () => {
        const r = join()
        if (r !== '') { throw r }
    },
    () => {
        const r = join('only')
        if (r !== 'only') { throw r }
    },
]

const relativizeTest = [
    () => {
        const r = relativize('/repo', '/repo/fs/a.ts')
        if (r !== './fs/a.ts') { throw r }
    },
    () => {
        const r = relativize('/repo', '/other/a.ts')
        if (r !== '/other/a.ts') { throw r }
    },
    () => {
        const r = relativize('', './fs/a.ts')
        if (r !== './fs/a.ts') { throw r }
    },
]
const toPosixTest = [
    () => {
        const p = toPosix('a\\b\\c')
        if (p !== 'a/b/c') { throw p }
    },
    () => {
        const p = toPosix('a/b/c')
        if (p !== 'a/b/c') { throw p }
    },
    () => {
        const p = toPosix('C:\\Users\\x')
        if (p !== 'C:/Users/x') { throw p }
    },
    () => {
        const p = toPosix('')
        if (p !== '') { throw p }
    },
]

const isProperPrefixTest = [
    () => {
        const r = isProperPrefix(['a', 'b'], ['a', 'b', 'c'])
        if (r !== true) { throw r }
    },
    () => {
        const r = isProperPrefix(['a', 'b'], ['a', 'b'])
        if (r !== false) { throw r }
    },
    () => {
        const r = isProperPrefix(['a', 'x'], ['a', 'b', 'c'])
        if (r !== false) { throw r }
    },
    () => {
        const r = isProperPrefix(['a', 'b', 'c'], ['a', 'b'])
        if (r !== false) { throw r }
    },
    () => {
        const r = isProperPrefix([], ['a'])
        if (r !== true) { throw r }
    },
    () => {
        const r = isProperPrefix([], [])
        if (r !== false) { throw r }
    },
]

export const proof = { normalizeTest, concatTest, joinTest, relativizeTest, toPosixTest, isProperPrefixTest }
