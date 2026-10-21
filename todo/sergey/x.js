const $0 = ($1) => {
    let $2 = [1, 1n];
    while ($2[0] < $1.length * 8) {
        const $3 = $2[0];
        $2 = [$3 + 1, $2[1] * 2n + ($1.charCodeAt($3 >> 3) >> 7 - $3 % 8 & 1 ? 1n : 0n)];
    }
    return -$2[1];
};
const $4 = ($5) =>
    "the longest Collatz chain below " +
    String(30000) +
    " starts at " +
    String($5 % 1048576) +
    " and takes " +
    String(($5 - $5 % 1048576) / 1048576) +
    " steps\n";
const $6 = ($7, $8) =>
    $7 === 1 ? $8 : $6($7 % 2 === 0 ? $7 / 2 : 3 * $7 + 1, $8 + 1);
const $9 = ($10) => $6($10, 0) * 1048576 + $10;
const $11 = ($12, $13) => $12 > $13 ? $12 : $13;
const $14 = ($15, $16) => $16 === 1 ? $9($15) : $11($14($15, $16 >> 1), $14($15 + ($16 >> 1), $16 - ($16 >> 1)));
export default () => {
    return {
        "command": "write",
        "payload": ["stdout", $0($4($14(1, 30000 - 1)))],
        "continuation": () => () => ["ok", undefined]
    };
};
