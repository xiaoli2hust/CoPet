#[path = "agent_support/helpers.rs"]
mod helpers;

#[path = "agent_support/antigravity.rs"]
mod antigravity;

#[path = "agent_support/claude_code.rs"]
mod claude_code;

#[path = "agent_support/codex.rs"]
mod codex;

#[cfg(not(windows))]
#[path = "agent_support/copilot.rs"]
mod copilot;

#[cfg(windows)]
#[test]
fn copilot_adapter_reports_unsupported_on_windows() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join(".copet");
    let home = temp.path().join("home");
    let manager = helpers::manager_with_fake_agents(&root, &home);

    let error = manager.install("copilot").unwrap_err();

    assert!(error.to_string().contains("Windows"));
    assert!(!root.join("adapters").join("copilot.json").exists());
}

#[path = "agent_support/cursor.rs"]
mod cursor;

#[path = "agent_support/gemini.rs"]
mod gemini;

#[path = "agent_support/manager.rs"]
mod manager;

#[path = "agent_support/opencode.rs"]
mod opencode;

#[path = "agent_support/pi.rs"]
mod pi;
