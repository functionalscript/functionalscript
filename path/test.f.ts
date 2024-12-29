import { normalize } from "./module.f.ts"

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
    ]
}