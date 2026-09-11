//! Re-export shim for backwards compatibility.
//! The canonical implementation has been relocated to crate::input::windows.

#[cfg(target_os = "windows")]
pub use crate::input::windows::*;
