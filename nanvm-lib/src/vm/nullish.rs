/// <https://developer.mozilla.org/en-US/docs/Glossary/Nullish>
/// "In JavaScript, a nullish value is the value which is either null or undefined. Nullish values are always falsy."
#[derive(Debug, PartialEq, Clone, Copy)]
pub enum Nullish {
    Null,
    Undefined,
}
