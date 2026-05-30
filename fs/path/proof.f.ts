import { concat, normalize, relativize } from "./module.f.ts"

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
export const proof = { normalizeTest, concatTest, relativizeTest }
