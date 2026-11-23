#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(
            tauri_plugin_opener::Builder::new()
                .open_js_links_on_click(false)
                .build(),
        );
    #[cfg(target_os = "android")]
    let builder = builder.plugin(tauri_plugin_http::init());
    builder
        .run(tauri::generate_context!())
        .expect("error while running Luyện JLPT mobile");
}
