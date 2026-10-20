import { assertEq } from '../../../asserts/module.f.js'
import { bigint } from './module.f.js'

/** @type {(v: unknown) => number} */
const asNumber = v => /** @type {number} */ (v)

export const proof = {
    zeros: () => {
        assertEq(bigint(0), 0n)
        assertEq(bigint(-0), 0n)
    },
    small: () => {
        assertEq(bigint(1), 1n)
        assertEq(bigint(-1), -1n)
        assertEq(bigint(2), 2n)
        assertEq(bigint(0xff), 0xffn)
        assertEq(bigint(-0x100), -0x100n)
    },
    exact: () => {
        assertEq(bigint(2 ** 53 + 2), 0x20_0000_0000_0002n)
        assertEq(bigint(-(2 ** 53 + 2)), -0x20_0000_0000_0002n)
        assertEq(bigint(2 ** 1023), 1n << 1023n)
        assertEq(bigint(1.7976931348623157e308), (1n << 1024n) - (1n << 971n))
    },
    // the built-in's answer, value for value
    builtIn: () => [
        0, -0, 1, -1, 2, 3, 0xff, -0x100, 2 ** 31, 2 ** 32 - 1, 2 ** 32, 2 ** 53 - 1,
        2 ** 53, 2 ** 53 + 2, -(2 ** 53 + 2), 1e21, 1e100, 1e308, -1e308,
        1.7976931348623157e308, -1.7976931348623157e308,
    ].forEach(n => assertEq(bigint(n), BigInt(n), n)),
    throw: {
        fraction: () => bigint(0.5),
        negativeFraction: () => bigint(-1.5),
        smallest: () => bigint(5e-324),
        nan: () => bigint(NaN),
        infinity: () => bigint(Infinity),
        negativeInfinity: () => bigint(-Infinity),
        string: () => bigint(asNumber('12')),
        boolean: () => bigint(asNumber(true)),
        null: () => bigint(asNumber(null)),
        undefined: () => bigint(asNumber(undefined)),
        bigint: () => bigint(asNumber(1n)),
    },
}
