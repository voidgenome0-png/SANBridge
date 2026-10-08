use std::sync::Mutex;
use steamworks::Client;

lazy_static! {
    static ref STEAM_CLIENT: Mutex<Option<Client>> = Mutex::new(None);
}

pub fn has_client() -> bool {
    STEAM_CLIENT.lock().unwrap().is_some()
}

pub fn get_client() -> Client {
    STEAM_CLIENT
        .lock()
        .unwrap()
        .as_ref()
        .expect("Steam client is not initialized")
        .clone()
}

pub fn set_client(client: Client) {
    *STEAM_CLIENT.lock().unwrap() = Some(client);
}

