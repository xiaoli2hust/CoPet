use tauri::{AppHandle, Manager};

pub fn quit(app: &AppHandle) {
    if let Some(runtime) = app.try_state::<crate::runtime_server::RuntimeManager>() {
        runtime.shutdown();
    }
    // Tauri's macOS run loop can keep the process alive after AppHandle::exit.
    // Match CoPet's existing tray quit behavior so Windows and macOS both exit
    // without a background runtime process.
    std::process::exit(0);
}
