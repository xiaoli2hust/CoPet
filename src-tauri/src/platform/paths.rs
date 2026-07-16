use std::path::{Path, PathBuf};

pub fn config_root(home: &Path) -> PathBuf {
    // Keep CoPet's established data root so upgrades retain pets, settings,
    // import previews, and runtime state on every supported platform.
    home.join(".copet")
}
