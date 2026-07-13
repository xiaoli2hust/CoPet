const SERVICE: &str = "com.nianlun.desktop-pet";
const ACCOUNT: &str = "nianlun-agent-token";

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, ACCOUNT).map_err(|error| error.to_string())
}

pub fn read_token() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(token) if token.is_empty() => Ok(None),
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

pub fn save_token(token: &str) -> Result<(), String> {
    let entry = entry()?;
    if token.trim().is_empty() {
        return match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(error.to_string()),
        };
    }
    entry.set_password(token).map_err(|error| error.to_string())
}
