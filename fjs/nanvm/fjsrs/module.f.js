/**
 * The program `fjsrs` is: the `fjs` command line compiled to Rust and run
 * on NaNVM, with no JavaScript host
 * ([console program](../../../nanvm/lib/todo/console-program.md)).
 *
 * It is the same dispatch `fjs` runs, over the commands that run natively,
 * and so far none does: the table is empty, and what answers is the `help`
 * every table has. A command moves here from
 * [`fjs/module.f.js`](../../module.f.js) once it starts in a time a person
 * waits for; the whole compiler builds and answers correctly today, and
 * takes minutes to start
 * ([todo](../../../nanvm/fjsrs/todo/whole-compiler.md)).
 *
 * [`./build`](./build/module.f.js) compiles this module to the Rust the
 * `nanvm-fjsrs` crate links.
 *
 * @module
 *
 * @import { NodeOp, Program, Write } from '../../effects/node/types.ts'
 * @import { Commands } from '../../cli/types.ts'
 */

import { dispatch } from '../../cli/module.f.js'

/** The commands that run natively. @type {Commands<NodeOp>} */
export const commands = []

/** @type {Program<NodeOp | Write>} */
export const main = dispatch(commands)
