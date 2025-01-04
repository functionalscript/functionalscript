import { error, ok, unwrap, type Result } from "./module.f.ts";

export default {
    example: () => {
        const success: Result<number, string> = ok(42)
        const failure: Result<number, string> = error('Something went wrong')

        if (unwrap(success) !== 42) { throw 'error' }
        const [kind, v] = failure
        if (kind !== 'error') { throw 'error' }
        // `v` is inferred as `string` here
        if (v !== 'Something went wrong') { throw 'error' }
    }
}
