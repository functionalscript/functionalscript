// The bigint utility's exact integer answer must survive a shared Math.log2
// whose fractional results can differ from the host's in their last bits.
import { log2 } from '../../../fjs/types/bigint/module.f.js';

const powers = [1n, 2n, 1n << 53n, 1n << 1_023n, 1n << 1_024n];
export default [
    log2(-1n), log2(0n),
    powers.map(power => [log2(power - 1n), log2(power), log2(power + 1n)]),
    // This integer rounds to Infinity on Number conversion inside the remainder phase.
    log2((1n << 1_024n) - (1n << 970n)),
];
