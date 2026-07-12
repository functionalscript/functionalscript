export type F<T> =
    | readonly[0|1|2, 1]
    | readonly[1, 3]
    | readonly[0|1|2|3|4, 2]
    | readonly[1|3, 5]

const f = <T>([i, x]: F<T>): undefined => {
    switch (i) {
        case 0: {
            // insert
            switch (x) {
                case 1: case 2: { return undefined }
            }
        }
        case 1: {
            // replace
            switch (x) {
                case 1:
                case 2:
                case 3:
                case 5: { return undefined }
            }
        }
        case 2: {
            // TODO: remove after TSGO fix the regression.
            const _xl: 1|2 = x
            switch (x) {
                case 1: case 2: { return undefined }
            }
            // TODO: remove after TSGO fix the regression.
            throw 'unreachable'
        }
        case 3: {
            // replace
            // TODO: remove after TSGO fix the regression.
            const _xl: 2|5 = x
            switch (x) {
                case 2: case 5: { return undefined }
            }
            // TODO: remove after TSGO fix the regression.
            throw 'unreachable'
        }
        case 4: {
            // insert
            // TODO: remove after TSGO fix the regression.
            const _xl: 2 = x
            return undefined
        }
    }
}
