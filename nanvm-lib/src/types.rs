#[repr(transparent)]
struct Any<T: interface::Any> (pub T);
