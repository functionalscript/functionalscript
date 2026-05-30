// A test that returns a thenable (Promise-like object) that rejects.
// sandbox (fjs) awaits any thenable so it catches the rejection → exit 1.
// registerModule checks `instanceof Promise`, so a plain thenable is treated as
// a plain return value → exit 0, incorrectly reporting the test as passed.
export const thenableRejects = () => ({
    then(_resolve: (v: undefined) => void, reject: (e: unknown) => void) {
        reject('thenable failure')
    }
})
