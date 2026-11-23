import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAuthRedirectUrl,
  listenForNativeAuth,
  parseAuthCallback,
} from "./nativeAuth";

const plugin = vi.hoisted(() => ({
  isTauri: vi.fn(),
  getCurrent: vi.fn(),
  onOpenUrl: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: plugin.isTauri }));
vi.mock("@tauri-apps/plugin-deep-link", () => plugin);

const flowId = "0123456789abcdef0123456789abcdef";
const valid = `luyenjlpt://auth-callback?code=abc&sb_flow_id=${flowId}`;

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
});

describe("native auth callback", () => {
  it("uses HTTPS on the web and the app callback only in Tauri", async () => {
    expect(getAuthRedirectUrl("https://jlpt.test")).toBe(
      "https://jlpt.test/tai-khoan",
    );
    await listenForNativeAuth(vi.fn());
    expect(plugin.onOpenUrl).not.toHaveBeenCalled();
    plugin.isTauri.mockReturnValue(true);
    expect(getAuthRedirectUrl("http://tauri.localhost")).toBe(
      "luyenjlpt://auth-callback",
    );
  });

  it("ignores foreign callback hosts, paths, ports and credentials", () => {
    for (const url of [
      valid.replace("luyenjlpt:", "https:"),
      valid.replace("auth-callback", "other"),
      valid.replace("auth-callback", "auth-callback/path"),
      valid.replace("auth-callback", "auth-callback:99"),
      valid.replace("auth-callback", "user@auth-callback"),
      "invalid",
    ]) {
      expect(parseAuthCallback(url)).toBeNull();
    }
  });

  it("exchanges only a code bound to an explicit valid flow", () => {
    expect(parseAuthCallback(valid)).toEqual({ code: "abc", flowId });
    for (const url of [
      valid.split("&")[0],
      valid.replace(flowId, "invalid"),
      `${valid}&code=duplicate`,
      `${valid}&sb_flow_id=${flowId}`,
      `${valid}&error=access_denied`,
      `${valid}#access_token=ignore`,
      "luyenjlpt://auth-callback?error=access_denied&error_description=ignore",
    ]) {
      expect(parseAuthCallback(url)).toEqual({});
    }
  });

  it("subscribes before checking the launch link and skips duplicate delivery", async () => {
    plugin.isTauri.mockReturnValue(true);
    const unlisten = vi.fn();
    const receiver = vi.fn();
    plugin.onOpenUrl.mockImplementation((onUrls) => {
      onUrls([valid]);
      return Promise.resolve(unlisten);
    });
    plugin.getCurrent.mockResolvedValue([`${valid}&extra=ignored`]);
    expect(await listenForNativeAuth(receiver)).toBe(unlisten);
    expect(receiver).toHaveBeenCalledExactlyOnceWith({ code: "abc", flowId });
  });

  it("does not replay the launch link after the webview reloads", async () => {
    plugin.isTauri.mockReturnValue(true);
    plugin.onOpenUrl.mockResolvedValue(vi.fn());
    // The plugin keeps returning the launch link for the life of the process.
    plugin.getCurrent.mockResolvedValue([valid]);
    const receiver = vi.fn();
    await listenForNativeAuth(receiver);
    await listenForNativeAuth(receiver);
    expect(receiver).toHaveBeenCalledOnce();
  });

  it("removes the listener when reading the launch link fails", async () => {
    plugin.isTauri.mockReturnValue(true);
    const unlisten = vi.fn();
    plugin.onOpenUrl.mockResolvedValue(unlisten);
    plugin.getCurrent.mockRejectedValue(new Error("unavailable"));
    await expect(listenForNativeAuth(vi.fn())).rejects.toThrow("unavailable");
    expect(unlisten).toHaveBeenCalledOnce();
  });
});
