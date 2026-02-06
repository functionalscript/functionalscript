import { uint, vec8 } from "../../bit_vec/module.f.ts"
import { readFile } from "./module.f.ts"

export default {
    map: () => {
        let e = readFile('hello').map(([k, v]) => {
            if (k === 'error') { throw v }
            return uint(v) * 2n
        })
        //
        while (true) {
            if ('pure' in e) {
                const result = e.pure
                if (result !== 0x2An) { throw result }
                return
            }
            const [cmd, p, cont] = e.do
            if (cmd !== 'readFile') { throw cmd }
            if (p !== 'hello') { throw p }
            e = cont(['ok', vec8(0x15n)])
        }
    }
}
