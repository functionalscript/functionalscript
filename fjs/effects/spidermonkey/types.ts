/**
 * The part of the SpiderMonkey shell's globals that the host uses.
 *
 * They are the shell's own, not the web platform's or Node's, so no library
 * declares them; the host reads them off `globalThis` through this type rather
 * than declaring them for every file.
 *
 * @module
 */

export type Shell = {
    /** The arguments after `--` on the shell's command line. */
    readonly scriptArgs: readonly string[]
    /** Writes a string to stdout without a newline. */
    readonly putstr: (s: string) => void
    /** Writes a string and a newline to stderr; there is no form without the newline. */
    readonly printErr: (s: string) => void
    /** Ends the shell with an exit code. */
    readonly quit: (code: number) => never
    readonly os: {
        /** One environment variable by name; the shell cannot list them. */
        readonly getenv: (name: string) => string | undefined
        /** Runs a command line through the system shell; answers its raw wait status. */
        readonly system: (command: string) => number
        readonly file: {
            /** The names in a directory, `.` and `..` among them; throws for anything that is not one. */
            readonly listDir: (path: string) => readonly string[]
            /** A file's bytes; a directory reads as "too large", so check first. */
            readonly readFile: (path: string, mode: 'binary') => Uint8Array
            /** Replaces a file's bytes, creating it; the shell writes no other way. */
            readonly writeTypedArrayToFile: (path: string, data: Uint8Array) => void
        }
    }
}
