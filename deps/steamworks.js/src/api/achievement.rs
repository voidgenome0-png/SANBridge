use napi_derive::napi;

#[napi]
pub mod achievement {
    #[napi]
    pub fn is_activated(achievement: String) -> bool {
        crate::client::get_client()
            .user_stats()
            .achievement(&achievement)
            .get()
            .unwrap_or(false)
    }

    #[napi]
    pub fn get_achievement_display_attribute(achievement: String, key: String) -> String {
        crate::client::get_client()
            .user_stats()
            .achievement(&achievement)
            .get_achievement_display_attribute(&key)
            .unwrap_or("")
            .to_owned()
    }

    #[napi]
    pub fn get_achievement_names() -> Vec<String> {
        crate::client::get_client()
            .user_stats()
            .get_achievement_names()
            .unwrap_or_default()
    }
}

