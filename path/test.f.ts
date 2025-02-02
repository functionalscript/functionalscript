import { concat, normalize } from "./module.f.ts"

export default {
    normalize: [
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
    ],
    concat: [
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
}