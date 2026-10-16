/**
 * The Node effects' command names as Rust, for `nanvm-effects-node`.
 *
 * A native host answers `notImplemented` to a command of the declared set it
 * has no operation for, and refuses a command outside it, as `partialMatch`
 * does (`fjs/effects/module.f.mjs`). The set is
 * [`nodeCommands`](../../effects/node/module.f.mjs), so it is printed from
 * there rather than written twice.
 *
 * @module
 */

import { nodeCommands } from '../../effects/node/module.f.mjs'
import { stringLiteral } from '../../media/rust/module.f.mjs'
import { constSlice, generatedHeader } from '../../media/rust/item/module.f.js'
import { unwrap } from '../../types/result/module.f.js'

/**
 * Where {@link generate}'s output goes, relative to the repository root:
 * beside `native.rs`, which includes it by `#[path]`.
 *
 * @type {string}
 */
export const path = 'nanvm/effects-node/src/gen.commands.rs'

/**
 * The commands as one Rust constant. A command is authored source, so one
 * Rust cannot spell is a defect here and throws.
 *
 * @type {() => string}
 */
export const generate = () => [
    generatedHeader(
        '`npm run gen` from `fjs/nanvm/commands/module.f.mjs`',
        '`nodeCommands` in `fjs/effects/node/module.f.mjs` is the source'),
    '',
    unwrap(constSlice(
        "Every command of `NodeOp`: the set a request's command must belong to.",
        'COMMANDS',
        '&str',
        nodeCommands,
        stringLiteral)),
    '',
].join('\n')
