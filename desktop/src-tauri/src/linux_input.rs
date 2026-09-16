//! Re-export shim for backwards compatibility.
#[allow(unused_imports)]
#[cfg(target_os = "linux")]
pub use crate::input::linux::*;
