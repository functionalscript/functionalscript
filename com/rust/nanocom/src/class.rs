use crate::{Interface, Vmt};

pub trait Class: Sized {
    type Interface: Interface;
    fn static_vmt() -> &'static Vmt<Self::Interface>;
}
