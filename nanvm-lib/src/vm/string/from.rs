use crate::vm::{Any, IVm, String, ToAny, ToString};

impl<A: IVm> From<&str> for String<A> {
    fn from(value: &str) -> Self {
        value.encode_utf16().to_string()
    }
}

impl<A: IVm> From<&str> for Any<A> {
    fn from(value: &str) -> Self {
        let s: String<_> = value.into();
        s.to_any()
    }
}

/// Lossy: a lone surrogate, which a JavaScript string may hold and a Rust
/// string cannot, becomes U+FFFD. Use `char::decode_utf16` directly where a
/// lone surrogate must be told apart from a real U+FFFD.
impl<A: IVm> From<String<A>> for std::string::String {
    fn from(value: String<A>) -> Self {
        char::decode_utf16(value)
            .map(|r| r.unwrap_or(char::REPLACEMENT_CHARACTER))
            .collect()
    }
}
