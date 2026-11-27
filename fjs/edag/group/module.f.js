/**
 * The source language admits an interval of consecutive functions when each
 * can reach every other by following references within that interval.
 * @module
 */

/** @type {(start: number, last: number, edges: readonly {readonly from: number, readonly to: number}[]) => boolean} */
export const isFunctionGroup = (start, last, edges) => {
    /** The first member reaches every member in both directions exactly
     * when they are one strongly connected component. @type {(reverse: boolean) => boolean} */
    const reachesAll = reverse => {
        let reached = [start]
        for (let i = 0; i < reached.length; i += 1) {
            const member = reached[Number(i)]
            for (const edge of edges) {
                const from = reverse ? edge.to : edge.from
                const to = reverse ? edge.from : edge.to
                if (from === member && to >= start && to <= last && !reached.includes(to)) { reached = [...reached, to] }
            }
        }
        return reached.length === last - start + 1
    }
    return reachesAll(false) && reachesAll(true)
}
