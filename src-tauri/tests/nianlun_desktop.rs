use copet_lib::{
    app_state::NianLunSettings,
    config_store::ConfigStore,
    platform::window::{clamp_chat_position, ScreenRect},
};
use tempfile::tempdir;

#[test]
fn nianlun_settings_default_to_local_mock_mode() {
    let directory = tempdir().expect("temp directory");
    let store = ConfigStore::new(directory.path());
    let state = store.ensure_ready().expect("default state");

    assert_eq!(state.nianlun.base_url, "http://localhost:8000");
    assert_eq!(state.nianlun.chat_path, "/api/agent/chat");
    assert!(state.nianlun.mock_enabled);
    assert!(!state.agent_integrations_enabled);
}

#[test]
fn nianlun_settings_persist_without_a_token() {
    let directory = tempdir().expect("temp directory");
    let store = ConfigStore::new(directory.path());
    store.ensure_ready().expect("default state");
    let settings = NianLunSettings {
        base_url: "https://agent.example.test".to_string(),
        chat_path: "/v1/chat".to_string(),
        health_path: "/healthz".to_string(),
        stream_enabled: false,
        timeout_ms: 12_000,
        mock_enabled: false,
        history_enabled: false,
    };

    let state = store
        .set_nianlun_settings(settings.clone())
        .expect("settings update");
    let reloaded = ConfigStore::new(directory.path())
        .app_state()
        .expect("reloaded state");

    assert_eq!(state.nianlun, settings);
    assert_eq!(reloaded.nianlun, settings);
    assert!(reloaded.nianlun_user_configured);
    let config = std::fs::read_to_string(directory.path().join("config.json"))
        .expect("stored configuration");
    assert!(!config.to_ascii_lowercase().contains("token"));
}

#[test]
fn nianlun_settings_match_frontend_names_and_accept_legacy_names() {
    let serialized = serde_json::to_value(NianLunSettings::default()).expect("serialized settings");

    assert_eq!(serialized["enableStreaming"], true);
    assert_eq!(serialized["mockMode"], true);
    assert_eq!(serialized["saveHistory"], true);
    assert!(serialized.get("streamEnabled").is_none());
    assert!(serialized.get("mockEnabled").is_none());
    assert!(serialized.get("historyEnabled").is_none());

    let legacy = serde_json::json!({
        "baseUrl": "http://localhost:8000",
        "chatPath": "/api/agent/chat",
        "healthPath": "/api/health",
        "streamEnabled": false,
        "timeoutMs": 15_000,
        "mockEnabled": false,
        "historyEnabled": false
    });
    let settings = serde_json::from_value::<NianLunSettings>(legacy).expect("legacy settings");

    assert!(!settings.stream_enabled);
    assert!(!settings.mock_enabled);
    assert!(!settings.history_enabled);
}

#[test]
fn chat_position_stays_inside_a_scaled_secondary_monitor() {
    let screen = ScreenRect {
        x: -2_560.0,
        y: 120.0,
        width: 2_560.0,
        height: 1_440.0,
    };
    let pet = ScreenRect {
        x: -310.0,
        y: 1_350.0,
        width: 205.0,
        height: 236.0,
    };
    let (x, y) = clamp_chat_position(screen, pet, 630.0, 840.0, 1.5);

    assert!(x >= screen.x);
    assert!(x + 630.0 <= screen.x + screen.width);
    assert!(y >= screen.y);
    assert!(y + 840.0 <= screen.y + screen.height);
}

#[test]
fn chat_position_uses_the_right_side_when_space_is_available() {
    let screen = ScreenRect {
        x: 0.0,
        y: 0.0,
        width: 1_920.0,
        height: 1_080.0,
    };
    let pet = ScreenRect {
        x: 100.0,
        y: 500.0,
        width: 164.0,
        height: 189.0,
    };
    let (x, _) = clamp_chat_position(screen, pet, 420.0, 560.0, 1.0);

    assert_eq!(x, 276.0);
}
