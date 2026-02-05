import { readFile } from "./node/module.f.ts"

export default {
    map: () => {
        const e = readFile('hello').map(a => a)
    }
}
