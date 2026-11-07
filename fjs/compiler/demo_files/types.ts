/**
 * Type-level API for `fjs/compiler/demo_files`: the files of a program typed
 * into one box.
 *
 * @module
 */

/** One file: its name, relative to the program's directory, and its text. */
export type File = readonly [name: string, text: string]

/** A program's files, the main module first. */
export type Files = readonly File[]

/** Each file a program reaches, with the module files it imports. */
export type Imports = readonly (readonly [name: string, imports: readonly string[]])[]
