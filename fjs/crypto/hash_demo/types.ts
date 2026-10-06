import type { Hash } from '../sha2/types.ts'

/** The hash and its names on the page and in OpenSSL. */
export type HashDemoAlgorithm<S> = {
    readonly name: string
    readonly hash: Hash<S>
    readonly openssl: string
}
