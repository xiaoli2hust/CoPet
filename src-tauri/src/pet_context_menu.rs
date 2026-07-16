use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    AppHandle, Emitter, EventTarget, LogicalPosition, Manager, WebviewWindow,
};

pub const PET_CONTEXT_MENU_ACTION_EVENT: &str = "copet-pet-context-menu-action";
pub const PET_CONTEXT_MENU_ASK_NIANLUN_ID: &str = "pet-context-menu-ask-nianlun";
pub const PET_CONTEXT_MENU_OPEN_NIANLUN_ID: &str = "pet-context-menu-open-nianlun";
pub const PET_CONTEXT_MENU_MESSAGES_ID: &str = "pet-context-menu-toggle-messages";
pub const PET_CONTEXT_MENU_SETTINGS_ID: &str = "pet-context-menu-open-settings";
pub const PET_CONTEXT_MENU_CHANGE_PET_ID: &str = "pet-context-menu-change-pet";
pub const PET_CONTEXT_MENU_HIDE_ID: &str = "pet-context-menu-hide-pet";
pub const PET_CONTEXT_MENU_QUIT_ID: &str = "pet-context-menu-quit";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetContextMenuLabels {
    #[serde(rename = "askNianLun")]
    pub ask_nianlun: String,
    #[serde(rename = "openChat")]
    pub open_nianlun: String,
    pub messages: String,
    pub open_settings: String,
    pub change_pet: String,
    pub hide_pet: String,
    pub quit: String,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetContextMenuPosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PetContextMenuAction {
    AskNianlun,
    OpenNianlun,
    ToggleMessages,
    OpenSettings,
    ChangePet,
    HidePet,
    Quit,
}

pub fn action_for_menu_id(id: &str) -> Option<PetContextMenuAction> {
    match id {
        PET_CONTEXT_MENU_ASK_NIANLUN_ID => Some(PetContextMenuAction::AskNianlun),
        PET_CONTEXT_MENU_OPEN_NIANLUN_ID => Some(PetContextMenuAction::OpenNianlun),
        PET_CONTEXT_MENU_MESSAGES_ID => Some(PetContextMenuAction::ToggleMessages),
        PET_CONTEXT_MENU_SETTINGS_ID => Some(PetContextMenuAction::OpenSettings),
        PET_CONTEXT_MENU_CHANGE_PET_ID => Some(PetContextMenuAction::ChangePet),
        PET_CONTEXT_MENU_HIDE_ID => Some(PetContextMenuAction::HidePet),
        PET_CONTEXT_MENU_QUIT_ID => Some(PetContextMenuAction::Quit),
        _ => None,
    }
}

pub fn handle_menu_event(app: &AppHandle, id: &str) -> bool {
    let Some(action) = action_for_menu_id(id) else {
        return false;
    };

    let _ = app.emit_to(
        EventTarget::webview_window("pet"),
        PET_CONTEXT_MENU_ACTION_EVENT,
        action,
    );
    true
}

#[tauri::command]
pub fn open_pet_context_menu(
    app: AppHandle,
    labels: PetContextMenuLabels,
    position: PetContextMenuPosition,
) -> Result<(), String> {
    let window: WebviewWindow = app
        .get_webview_window("pet")
        .ok_or_else(|| "pet window is not available".to_string())?;

    let ask_nianlun = MenuItem::with_id(
        &app,
        PET_CONTEXT_MENU_ASK_NIANLUN_ID,
        labels.ask_nianlun,
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let open_nianlun = MenuItem::with_id(
        &app,
        PET_CONTEXT_MENU_OPEN_NIANLUN_ID,
        labels.open_nianlun,
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let _messages = MenuItem::with_id(
        &app,
        PET_CONTEXT_MENU_MESSAGES_ID,
        labels.messages,
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let change_pet = MenuItem::with_id(
        &app,
        PET_CONTEXT_MENU_CHANGE_PET_ID,
        labels.change_pet,
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let open_settings = MenuItem::with_id(
        &app,
        PET_CONTEXT_MENU_SETTINGS_ID,
        labels.open_settings,
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let separator_before_settings =
        PredefinedMenuItem::separator(&app).map_err(|error| error.to_string())?;
    let separator_before_quit =
        PredefinedMenuItem::separator(&app).map_err(|error| error.to_string())?;
    let hide_pet = MenuItem::with_id(
        &app,
        PET_CONTEXT_MENU_HIDE_ID,
        labels.hide_pet,
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let quit = MenuItem::with_id(
        &app,
        PET_CONTEXT_MENU_QUIT_ID,
        labels.quit,
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;

    let menu = Menu::with_items(
        &app,
        &[
            &ask_nianlun,
            &open_nianlun,
            &separator_before_settings,
            &open_settings,
            &change_pet,
            &hide_pet,
            &separator_before_quit,
            &quit,
        ],
    )
    .map_err(|error| error.to_string())?;

    window
        .popup_menu_at(&menu, LogicalPosition::new(position.x, position.y))
        .map_err(|error| error.to_string())
}
