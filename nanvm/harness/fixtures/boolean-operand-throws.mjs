/**
 * An unused conversion still evaluates its operand. Its failure propagates
 * instead of being hidden by truthiness conversion or dead-result removal.
 */
const fail = () => { throw "Boolean operand"; };
const ignored = Boolean(fail());
export default 1;
