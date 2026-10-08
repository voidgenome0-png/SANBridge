// SANBridge UserAchievementStored native bridge V2.
// steamworks 0.13.1 does not expose request_current_stats(); the Steam client
// preloads the current app's stats, and this bridge only listens for callbacks.
use napi::bindgen_prelude::Error;
use napi_derive::napi;
use steamworks::{AppId, Client};

#[macro_use]
extern crate lazy_static;

mod client;
mod api;

#[napi]
pub fn init(app_id: Option<u32>) -> Result<(), Error> {
    if client::has_client() {
        return Err(Error::from_reason("Steam client is already initialized"));
    }

    let steam_client = match app_id {
        Some(app_id) => Client::init_app(AppId(app_id)),
        None => Client::init(),
    }
    .map_err(|error| Error::from_reason(error.to_string()))?;

    client::set_client(steam_client);
    Ok(())
}

#[napi]
pub fn run_callbacks() {
    client::get_client().run_callbacks();
}

