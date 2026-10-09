//! The values the VM throws, built in one place.
//!
//! A thrown value is, for now, a string: the name of the error's
//! constructor, a colon, and the message — `"TypeError: value is not
//! iterable"`. A failure is one outcome whatever its message
//! (`spec/README.md`), so the text is for a reader and the shape is what
//! this module fixes. When real `Error` objects land, `thrown` is the one
//! function that changes.
//!
//! Each case the VM throws has its own constructor here, so a throw site
//! and the test that expects it name the same thing.

use crate::vm::{Any, IVm};

fn thrown<A: IVm>(name: &str, message: &str) -> Any<A> {
    format!("{name}: {message}").as_str().into()
}

fn type_error<A: IVm>(message: &str) -> Any<A> {
    thrown("TypeError", message)
}

fn range_error<A: IVm>(message: &str) -> Any<A> {
    thrown("RangeError", message)
}

// TypeError

/// A host conversion, `TryFrom<Any<A>>`, given a value of another type —
/// among them calling what is not a function, or spreading arguments that
/// are not an array.
pub(crate) fn unexpected_type<A: IVm>() -> Any<A> {
    type_error("unexpected type")
}

/// A member read on `undefined` or `null`.
pub(crate) fn nullish_to_object<A: IVm>() -> Any<A> {
    type_error("Cannot convert undefined or null to object")
}

/// `ToNumber` of a `bigint`.
pub(crate) fn bigint_to_number<A: IVm>() -> Any<A> {
    type_error("Cannot convert a BigInt value to a number")
}

/// `ToPrimitive` of an object whose `toString` and `valueOf` answer no
/// primitive.
pub(crate) fn cannot_convert_to_primitive<A: IVm>() -> Any<A> {
    type_error("Cannot convert to primitive value")
}

/// `ToPrimitive` of a function without text — a host or hand-written
/// function, which no EDAG renders. A result that does not depend on the
/// text is answered without it: see `NumberCoercion` and `is_less_than`.
pub(crate) fn function_text<A: IVm>() -> Any<A> {
    type_error("Cannot convert a function to its text")
}

/// An arithmetic operator given a `bigint` and a `number`.
pub(crate) fn mixed_numeric_operands<A: IVm>() -> Any<A> {
    type_error("Cannot mix BigInt and other types, use explicit conversions")
}

/// `>>>` on two `bigint`s.
pub(crate) fn bigint_unsigned_right_shift<A: IVm>() -> Any<A> {
    type_error("BigInts have no unsigned right shift, use >> instead")
}

/// `GetIterator` of a value that is not iterable. JavaScript engines name
/// the expression spread, which a value no longer knows.
pub(crate) fn not_iterable<A: IVm>() -> Any<A> {
    type_error("value is not iterable")
}

/// `reduce` of an empty array with no initial value.
pub(crate) fn reduce_of_empty_array<A: IVm>() -> Any<A> {
    type_error("Reduce of empty array with no initial value")
}

/// `toSorted` given a comparison that is neither a function nor
/// `undefined`.
pub(crate) fn invalid_comparison_function<A: IVm>() -> Any<A> {
    type_error("The comparison function must be either a function or undefined")
}

// RangeError

/// `/` or `%` of a `bigint` by zero, V8's exact message.
pub(crate) fn division_by_zero<A: IVm>() -> Any<A> {
    range_error("Division by zero")
}

/// A `bigint` past the size limit.
pub(crate) fn bigint_too_large<A: IVm>() -> Any<A> {
    range_error("Maximum BigInt size exceeded")
}

/// `**` of a `bigint` by a negative exponent.
pub(crate) fn negative_exponent<A: IVm>() -> Any<A> {
    range_error("Exponent must be non-negative")
}

/// A string longer than NaNVM holds: `String<A>` is indexed by `u32`, so
/// `2³² − 1` code units. ECMAScript lets an engine refuse a string shorter
/// than its own `2⁵³ − 1` limit, and V8 refuses far shorter ones, with the
/// same `RangeError`.
pub(crate) fn string_too_long<A: IVm>() -> Any<A> {
    range_error("Invalid string length")
}

/// An array longer than JavaScript's limit, `2³² − 1` elements, which is
/// also `Array<A>`'s `u32` length limit.
pub(crate) fn array_too_long<A: IVm>() -> Any<A> {
    range_error("Invalid array length")
}

/// `repeat`'s count negative or infinite.
pub(crate) fn invalid_count<A: IVm>() -> Any<A> {
    range_error("Invalid count value")
}

/// `with`'s index outside the array.
pub(crate) fn invalid_index<A: IVm>() -> Any<A> {
    range_error("Invalid index")
}

/// `name`'s digit count or radix argument outside `low..=high`.
pub(crate) fn argument_out_of_range<A: IVm>(name: &str, low: u32, high: u32) -> Any<A> {
    range_error(&format!(
        "{name}() argument must be between {low} and {high}"
    ))
}

/// A fraction's `toString` in a radix other than ten, not implemented.
pub(crate) fn fraction_radix<A: IVm>() -> Any<A> {
    range_error("a fraction's digits in a radix other than 10 are not supported")
}

#[cfg(test)]
mod tests {
    use crate::{naive::Naive, vm::Any};

    /// A thrown value names its constructor before its message.
    #[test]
    fn shape() {
        let t: Any<Naive> = super::not_iterable();
        assert_eq!(t, "TypeError: value is not iterable".into());
        let r: Any<Naive> = super::argument_out_of_range("toFixed", 0, 100);
        assert_eq!(
            r,
            "RangeError: toFixed() argument must be between 0 and 100".into()
        );
    }
}
