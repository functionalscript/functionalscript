import { isVec, uint, vec8 } from "../../bit_vec/module.f.ts"
import { run } from "../mock/module.f.ts"
import { emptyState, mkdir, readFile, virtual } from "./module.f.ts"

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
    },
    mkdir: () => {
        const v = run(virtual)
        const [state, [t, result]] = v(emptyState)(mkdir('a'))
        if (t === 'error') { throw result }
        const a = state.root.a
        if (a === undefined || isVec(a)) { throw a }
    }
}
