use tauri::{AppHandle, LogicalPosition, Manager, PhysicalPosition, Position, WebviewWindow};

const CHAT_GAP: f64 = 12.0;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ScreenRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

pub fn clamp_chat_position(
    screen: ScreenRect,
    pet: ScreenRect,
    chat_width: f64,
    chat_height: f64,
    scale: f64,
) -> (f64, f64) {
    let max_x = screen.x + screen.width - chat_width;
    let max_y = screen.y + screen.height - chat_height;
    let preferred_right = pet.x + pet.width + CHAT_GAP * scale;
    let preferred_left = pet.x - chat_width - CHAT_GAP * scale;
    let x = if preferred_right <= max_x {
        preferred_right
    } else {
        preferred_left
    }
    .clamp(screen.x, max_x.max(screen.x));
    let y = (pet.y + pet.height - chat_height).clamp(screen.y, max_y.max(screen.y));
    (x, y)
}

pub fn clamp_chat_near_pet(app: &AppHandle, chat: &WebviewWindow) -> Result<(), String> {
    let pet = app
        .get_webview_window("pet")
        .ok_or_else(|| "pet window is unavailable".to_string())?;
    let pet_position = pet.outer_position().map_err(|error| error.to_string())?;
    let pet_size = pet.outer_size().map_err(|error| error.to_string())?;
    let chat_size = chat.outer_size().map_err(|error| error.to_string())?;
    let monitor = pet
        .current_monitor()
        .map_err(|error| error.to_string())?
        .or_else(|| app.primary_monitor().ok().flatten())
        .ok_or_else(|| "no monitor is available".to_string())?;
    let scale = monitor.scale_factor();
    let work_position = monitor.position();
    let work_size = monitor.size();

    let (x, y) = clamp_chat_position(
        ScreenRect {
            x: work_position.x as f64,
            y: work_position.y as f64,
            width: work_size.width as f64,
            height: work_size.height as f64,
        },
        ScreenRect {
            x: pet_position.x as f64,
            y: pet_position.y as f64,
            width: pet_size.width as f64,
            height: pet_size.height as f64,
        },
        chat_size.width as f64,
        chat_size.height as f64,
        scale,
    );

    chat.set_position(Position::Physical(PhysicalPosition::new(
        x.round() as i32,
        y.round() as i32,
    )))
    .map_err(|error| error.to_string())
}

pub fn logical_position(x: f64, y: f64) -> Position {
    Position::Logical(LogicalPosition::new(x, y))
}
