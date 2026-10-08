use napi_derive::napi;

#[napi]
pub mod callback {
    use napi::{
        threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode},
        JsFunction,
    };

    #[napi]
    pub struct Handle {
        handle: Option<steamworks::CallbackHandle>,
    }

    #[napi(object)]
    pub struct UserAchievementStoredPayload {
        pub game_id: String,
        pub achievement_name: String,
        pub current_progress: u32,
        pub max_progress: u32,
    }

    #[napi]
    impl Handle {
        #[napi]
        pub fn disconnect(&mut self) {
            // CallbackHandle unregisters itself when dropped.
            self.handle.take();
        }
    }

    #[napi]
    pub fn register_user_achievement_stored(
        #[napi(ts_arg_type = "(value: UserAchievementStoredPayload) => void")] handler: JsFunction,
    ) -> Handle {
        let threadsafe_handler: ThreadsafeFunction<
            UserAchievementStoredPayload,
            ErrorStrategy::Fatal,
        > =
            handler
                .create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))
                .expect("Failed to create UserAchievementStored callback");

        let client = crate::client::get_client();
        let handle = client.register_callback(move |value: steamworks::UserAchievementStored| {
            let payload = UserAchievementStoredPayload {
                game_id: value.game_id.raw().to_string(),
                achievement_name: value.achievement_name,
                current_progress: value.current_progress,
                max_progress: value.max_progress,
            };
            threadsafe_handler.call(payload, ThreadsafeFunctionCallMode::NonBlocking);
        });

        Handle { handle: Some(handle) }
    }
}
