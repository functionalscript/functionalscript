/**
 * The host boundary of the Cloudflare site build.
 *
 * @module
 */

/**
 * The process, network and host facts `../cloudflare-build.mjs` takes from
 * Node, each replaceable by a proof.
 */
export type CloudflareBuildHost = {
    /** Runs a command to its exit code, with the given environment. */
    readonly run?: (command: string, args: readonly string[], env: Readonly<Record<string, string | undefined>>) => Promise<number>
    /** Saves what a URL serves as an executable file at `path`. */
    readonly download?: (url: string, path: string) => Promise<void>
    readonly platform?: string
    readonly arch?: string
}
