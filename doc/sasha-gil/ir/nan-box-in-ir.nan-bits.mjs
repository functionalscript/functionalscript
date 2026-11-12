// @ts-nocheck
// Which NaN bits does a WASM engine produce? Operands and results cross as i64,
// so the host never touches a float. It accompanies section 5.1 of
// nan-box-in-ir.md. Run: node nan-box-in-ir.nan-bits.mjs
const leb = n => { const r = []; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; r.push(b) } while (n); return r }
const sec = (id, body) => [id, ...leb(body.length), ...body]
const ops = { add: 0xa0, sub: 0xa1, mul: 0xa2, div: 0xa3, min: 0xa4, max: 0xa5 }
const un = { sqrt: 0x9f, neg: 0x9a, abs: 0x99, floor: 0x9c, nearest: 0x9e }
const names = [...Object.keys(ops), ...Object.keys(un)]
const types = [[0x60, 2, 0x7e, 0x7e, 1, 0x7e], [0x60, 1, 0x7e, 1, 0x7e]]
const funcs = names.map(n => n in ops ? 0 : 1)
const bodies = names.map(n => {
    const code = n in ops
        ? [0, 0x20, 0, 0xbf, 0x20, 1, 0xbf, ops[n], 0xbd, 0x0b]
        : [0, 0x20, 0, 0xbf, un[n], 0xbd, 0x0b]
    return [...leb(code.length), ...code]
})
const exports_ = names.flatMap((n, i) => [n.length, ...Buffer.from(n), 0, i])
const bytes = new Uint8Array([
    0, 0x61, 0x73, 0x6d, 1, 0, 0, 0,
    ...sec(1, [types.length, ...types.flat()]),
    ...sec(3, [funcs.length, ...funcs]),
    ...sec(7, [names.length, ...exports_]),
    ...sec(10, [bodies.length, ...bodies.flat()]),
])
const { instance } = await WebAssembly.instantiate(bytes)
const f = instance.exports
const hx = x => '0x' + BigInt.asUintN(64, x).toString(16).toUpperCase().padStart(16, '0').replace(/(....)(?=.)/g, '$1_')
const P = 0x7FF8_0000_0000_0000n, N = 0xFFF8_0000_0000_0000n
const INF = 0x7FF0_0000_0000_0000n, NINF = 0xFFF0_0000_0000_0000n, ONE = 0x3FF0_0000_0000_0000n, ZERO = 0n, MONE = 0xBFF0_0000_0000_0000n
const odd = 0x7FF8_0000_0000_1234n  // a quiet NaN with another payload
const sig = 0x7FF0_0000_0000_0001n  // a signaling NaN
const rows = [
    ['0 / 0', f.div(ZERO, ZERO)], ['inf - inf', f.sub(INF, INF)], ['0 * inf', f.mul(ZERO, INF)],
    ['inf + -inf', f.add(INF, NINF)], ['sqrt(-1)', f.sqrt(MONE)],
    ['+nan + 1', f.add(P, ONE)], ['-nan + 1', f.add(N, ONE)], ['1 + -nan', f.add(ONE, N)],
    ['+nan * -nan', f.mul(P, N)], ['-nan * +nan', f.mul(N, P)], ['min(+nan, 1)', f.min(P, ONE)], ['max(1, -nan)', f.max(ONE, N)],
    ['neg(+nan)', f.neg(P)], ['abs(-nan)', f.abs(N)], ['floor(-nan)', f.floor(N)], ['nearest(+nan)', f.nearest(P)],
    ['odd payload + 1', f.add(odd, ONE)], ['signaling + 1', f.add(sig, ONE)],
]
for (const [what, r] of rows) console.log(what.padEnd(18), hx(r))
const set = new Set(rows.slice(0, 16).map(([, r]) => hx(r)))
console.log('results over canonical-payload operands:', [...set].join(', '))
