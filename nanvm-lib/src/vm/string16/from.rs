use crate::vm::{Any, IVm, String16, ToAny, ToString16};

impl<A: IVm> From<&str> for String16<A> {
    fn from(value: &str) -> Self {
        value.encode_utf16().to_string16()
    }
}

impl<A: IVm> From<&str> for Any<A> {
    fn from(value: &str) -> Self {
        let s: String16<_> = value.into();
        s.to_any()
    }
}

// TODO: Should we use `TryFrom` instead since we can have an error?
impl<A: IVm> From<String16<A>> for String {
    fn from(value: String16<A>) -> Self {
        char::decode_utf16(value)
            .map(|r| r.unwrap_or(char::REPLACEMENT_CHARACTER))
            .collect()
    }
}
