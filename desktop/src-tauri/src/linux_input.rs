//! Re-export shim for backwards compatibility.
//! The canonical implementation has been relocated to crate::input::linux.

#[cfg(target_os = "linux")]
pub use crate::input::linux::*;
