#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    let context = tauri::generate_context!();
    let updater_configured = context.config().plugins.0.contains_key("updater");

    let mut app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(
            tauri_plugin_opener::Builder::new()
                .open_js_links_on_click(false)
                .build(),
        )
        .plugin(tauri_plugin_process::init());

    if updater_configured {
        app = app.plugin(tauri_plugin_updater::Builder::new().build());
    }

    app.run(context).expect("could not run Luyện JLPT N4");
}
