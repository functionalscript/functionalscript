/**
 * Compiled by `fjs compile` into `../gen.fixtures/parity.rs`, committed and
 * drift-checked by `npm run gen` (see `../../fjs/ci/README.md`). Consumed by
 * `../tests/parity.rs`, which performs each program on `nanvm-effects-node`,
 * and by `../../fjs/nanvm/parity/proof.mjs`, which performs the same programs
 * on the Node runner. Both must answer `expected`: this is what "the native
 * host does what the Node one does" means for the operations it implements.
 *
 * A case is `{ run, expected }`. `run(root)` is an effect that does its
 * operations inside the directory `root` and ends `['ok', answers]`, one
 * entry per step; `expected` is `answers` for a host that agrees. An answer
 * is `['ok', view of the value]` or `['error', code]`, the code being what a
 * program reads from `ioError` (`null` where there is none). The message is
 * left out: it is a host's own text, and the contract is the code. Bytes are
 * `Vec`s, the bits with a stop bit in front, negated where the first was `0`
 * (`fjs/types/bit_vec`); a view compares them, since JSON has no bigint.
 *
 * What the corpus leaves out is where the Node runner itself differs between
 * platforms or from its own contract, so no answer is one to agree on: `rmdir`
 * of a file, which Windows answers `ENOENT` where the contract says `ENOTDIR`,
 * and `readdir` of a file likewise; and `writeBytes` at an offset a read could
 * not name, which the Node runner answers by writing at the descriptor's cursor
 * and the native one refuses with `ERR_OUT_OF_RANGE`.
 */

import { entry } from '../../fjs/js/entry/module.f.js';

/**
 * `['ok', view(value)]`, or `['error', code]`.
 *
 * @type {(view: (value: any) => unknown, answer: any) => unknown}
 */
const summary = (view, answer) =>
    answer[0] === 'ok'
        ? ['ok', view(answer[1])]
        : answer[1][0] === 'ioError'
            ? ['error', answer[1][1].code ?? null]
            : ['error', answer[1]];

/** @type {(acc: readonly unknown[]) => () => readonly ['ok', readonly unknown[]]} */
const end = acc => () => ['ok', acc];

/**
 * One command, then `rest` with its summary appended. A program is
 * `step(a)(step(b)(end))([])`.
 *
 * @type {(command: string, payload: readonly unknown[], view: (value: any) => unknown) => (rest: (acc: readonly unknown[]) => unknown) => (acc: readonly unknown[]) => unknown}
 */
const step = (command, payload, view) => rest => acc => ({
    command,
    payload,
    continuation: (/** @type {any} */ answer) => rest([...acc, summary(view, answer)]),
});

/** What an operation with no value shows. */
const none = (/** @type {unknown} */ _) => null;

const hi = -59497n;
const hihi = -3899222121n;

export const mkdirs = {
    run: (/** @type {string} */ root) => step('mkdir', [root + '/a/b', { recursive: true }], none)(
        step('mkdir', [root + '/a/b', { recursive: true }], none)(
            step('mkdir', [root + '/a/b', undefined], none)(
                step('mkdir', [root + '/x/y', undefined], none)(
                    step('mkdir', [root + '/d', undefined], none)(end)))))([]),
    expected: [['ok', null], ['ok', null], ['error', 'EEXIST'], ['error', 'ENOENT'], ['ok', null]],
};

export const files = {
    run: (/** @type {string} */ root) => step('writeFile', [root + '/f', hi], none)(
        step('readFile', [root + '/f'], (/** @type {unknown} */ v) => v === hi)(
            step('writeFile', [root + '/f', hihi], none)(
                step('readFile', [root + '/f'], (/** @type {unknown} */ v) => v === hihi)(
                    step('rm', [root + '/f'], none)(
                        step('readFile', [root + '/f'], none)(
                            step('rm', [root + '/f'], none)(end)))))))([]),
    expected: [['ok', null], ['ok', true], ['ok', null], ['ok', true], ['ok', null], ['error', 'ENOENT'], ['error', 'ENOENT']],
};

export const rmOfADirectory = {
    run: (/** @type {string} */ root) => step('rm', [root], none)(end)([]),
    expected: [['error', 'ERR_FS_EISDIR']],
};

export const stats = {
    run: (/** @type {string} */ root) => step('writeFile', [root + '/f', hi], none)(
        step('stat', [root + '/f'], (/** @type {any} */ v) => [v.size, v.isFile, v.isDirectory])(
            step('stat', [root], (/** @type {any} */ v) => [v.isFile, v.isDirectory])(
                step('stat', [root + '/none'], none)(
                    step('access', [root + '/f'], none)(
                        step('access', [root], none)(
                            step('access', [root + '/none'], none)(end)))))))([]),
    expected: [['ok', null], ['ok', [2, true, false]], ['ok', [false, true]], ['error', 'ENOENT'], ['ok', null], ['ok', null], ['error', 'ENOENT']],
};

export const renames = {
    run: (/** @type {string} */ root) => step('writeFile', [root + '/a', hi], none)(
        step('writeFile', [root + '/b', hihi], none)(
            step('rename', [root + '/a', root + '/b'], none)(
                step('readFile', [root + '/b'], (/** @type {unknown} */ v) => v === hi)(
                    step('readFile', [root + '/a'], none)(
                        step('rename', [root + '/a', root + '/c'], none)(end))))))([]),
    expected: [['ok', null], ['ok', null], ['ok', null], ['ok', true], ['error', 'ENOENT'], ['error', 'ENOENT']],
};

export const rmdirs = {
    run: (/** @type {string} */ root) => step('mkdir', [root + '/d', undefined], none)(
        step('writeFile', [root + '/d/f', hi], none)(
            step('rmdir', [root + '/d'], none)(
                step('rm', [root + '/d/f'], none)(
                    step('rmdir', [root + '/d'], none)(
                        step('rmdir', [root + '/d'], none)(end))))))([]),
    expected: [['ok', null], ['ok', null], ['error', 'ENOTEMPTY'], ['ok', null], ['ok', null], ['error', 'ENOENT']],
};

export const windows = {
    run: (/** @type {string} */ root) => step('writeFile', [root + '/f', hihi], none)(
        step('readBytes', [root + '/f', 1, 2], (/** @type {unknown} */ v) => v === -59752n)(
            step('readBytes', [root + '/f', 3, 10], (/** @type {unknown} */ v) => v === -233n)(
                step('readBytes', [root + '/f', 9, 4], (/** @type {unknown} */ v) => v === 0n)(
                    step('readBytes', [root + '/f', 0, 0], (/** @type {unknown} */ v) => v === 0n)(
                        step('readBytes', [root + '/none', 0, 1], none)(
                            step('readBytes', [root + '/f', -1, 1], none)(
                                step('readBytes', [root + '/f', 0, 131073], none)(
                                    step('readBytes', [root + '/f', 0.5, 1], none)(end)))))))))([]),
    expected: [['ok', null], ['ok', true], ['ok', true], ['ok', true], ['ok', true], ['error', 'ENOENT'], ['error', null], ['error', null], ['error', null]],
};

export const exclusive = {
    run: (/** @type {string} */ root) => step('createExclusive', [root + '/a'], none)(
        step('createExclusive', [root + '/a'], none)(
            step('writeExclusive', [root + '/a', [hi]], none)(
                step('writeExclusive', [root + '/b', [hi, hi]], none)(
                    step('readFile', [root + '/b'], (/** @type {unknown} */ v) => v === hihi)(
                        step('writeExclusive', [root + '/n/c', [hi]], none)(end))))))([]),
    expected: [['ok', null], ['error', 'EEXIST'], ['error', 'EEXIST'], ['ok', null], ['ok', true], ['error', 'ENOENT']],
};

export const writeBytes = {
    run: (/** @type {string} */ root) => step('writeFile', [root + '/f', hihi], none)(
        step('writeBytes', [root + '/f', 1, -55898n], none)(
            step('readFile', [root + '/f'], (/** @type {unknown} */ v) => v === -3898235497n)(
                step('writeBytes', [root + '/none', 0, hi], none)(end))))([]),
    expected: [['ok', null], ['ok', null], ['ok', true], ['error', 'ENOENT']],
};

export const readWhole = {
    run: (/** @type {string} */ root) => step('writeFile', [root + '/f', hihi], none)(
        step('readWhole', [root + '/f'], (/** @type {any} */ v) => v[0] === hihi)(
            step('readWhole', [root], none)(
                step('readWhole', [root + '/none'], none)(end))))([]),
    expected: [['ok', null], ['ok', true], ['error', 'ERR_NOT_A_FILE'], ['error', 'ENOENT']],
};

export const directory = {
    run: (/** @type {string} */ root) => step('mkdir', [root + '/b', undefined], none)(
        step('mkdir', [root + '/a', undefined], none)(
            step('writeFile', [root + '/z', hi], none)(
                step('writeFile', [root + '/a/f', hi], none)(
                    step('readdir', [root, {}], (/** @type {any} */ v) => [entry(v[0], 'name'), entry(v[1], 'name'), entry(v[2], 'name')])(
                        step('readdir', [root, { recursive: true }], (/** @type {any} */ v) => [entry(v[0], 'name'), entry(v[1], 'name'), entry(v[2], 'name'), entry(v[3], 'name')])(
                            step('readdir', [root + '/none', {}], none)(end)))))))([]),
    expected: [['ok', null], ['ok', null], ['ok', null], ['ok', null], ['ok', ['a', 'b', 'z']], ['ok', ['a', 'b', 'z', 'f']], ['error', 'ENOENT']],
};
