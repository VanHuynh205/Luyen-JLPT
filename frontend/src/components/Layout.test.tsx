import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { Layout } from "./Layout";

const state = vi.hoisted(() => ({
  route: "/",
  status: "loading",
  online: true,
  signedIn: false,
  progress: { synced: false, queued: 0 as number | null },
  preference: { synced: false, pending: false },
}));

vi.mock("@/adapters/auth/session", () => ({
  useAuth: () => ({
    session: state.signedIn ? { user: { id: "owner" } } : null,
  }),
}));
vi.mock("@/adapters/auth/AccountProgress", () => ({
  useAccountProgress: () => ({
    ...state.progress,
    enabled: state.signedIn,
    online: state.online,
  }),
}));
vi.mock("@/hooks/useContent", () => ({
  useContent: () => ({
    level: "n4",
    pack: null,
    status: state.status,
    preferenceSync: state.preference,
  }),
}));
vi.mock("./LevelSwitcher", () => ({ LevelSwitcher: () => null }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  Outlet: () => <span>Route content</span>,
  useMatch: ({ from }: { from: string }) =>
    state.route === from ? {} : undefined,
}));

beforeEach(() => {
  state.route = "/";
  state.status = "loading";
  state.online = true;
  state.signedIn = false;
  state.progress = { synced: false, queued: 0 };
  state.preference = { synced: false, pending: false };
});

it.each(["loading", "error"])(
  "renders account content while the pack is %s",
  (status) => {
    state.route = "/tai-khoan";
    state.status = status;
    const html = renderToStaticMarkup(<Layout />);
    expect(html).toContain("Route content");
    expect(html).not.toContain("Không tải được nội dung");
    expect(html).not.toContain("Đang tải nội dung");
  },
);

it("keeps content routes gated and offers guests a non-blocking invite", () => {
  state.status = "error";
  const html = renderToStaticMarkup(<Layout />);
  expect(html).not.toContain("Route content");
  expect(html).toContain("Không tải được nội dung");
  expect(html).toContain("Tiến độ của bạn chỉ lưu trên máy này");
  state.signedIn = true;
  expect(renderToStaticMarkup(<Layout />)).not.toContain(
    "Tiến độ của bạn chỉ lưu trên máy này",
  );
});

it("only reports fully synced after both initial reads, with no pending operations", () => {
  state.signedIn = true;
  expect(renderToStaticMarkup(<Layout />)).toContain("Chưa đồng bộ");
  state.progress = { synced: true, queued: 2 };
  state.preference.pending = true;
  expect(renderToStaticMarkup(<Layout />)).toContain("Chờ đồng bộ 3");
  state.progress.queued = 0;
  state.preference.pending = false;
  expect(renderToStaticMarkup(<Layout />)).not.toContain("Đã đồng bộ");
  state.preference.synced = true;
  expect(renderToStaticMarkup(<Layout />)).toContain("Đã đồng bộ");
});

it("reports offline ahead of synced, and still shows the queued count", () => {
  state.signedIn = true;
  state.online = false;
  state.progress = { synced: true, queued: 2 };
  state.preference = { synced: true, pending: false };
  const html = renderToStaticMarkup(<Layout />);
  expect(html).toContain("Ngoại tuyến · Chờ đồng bộ 2");
  expect(html).not.toContain("Đã đồng bộ");
});

it("does not call an unknown outbox size synced", () => {
  state.signedIn = true;
  state.progress = { synced: true, queued: null };
  state.preference.synced = true;
  expect(renderToStaticMarkup(<Layout />)).toContain("Chưa đồng bộ");
});

it("includes Luyện đề in desktop/sheet nav while keeping 5 FR-39 mobile bottom tabs", () => {
  const html = renderToStaticMarkup(<Layout />);
  expect(html).toContain("Luyện đề");
  const bottomBar = html.split('data-ocid="nav.bottom_bar"')[1] ?? "";
  expect(bottomBar).toContain("grid-cols-5");
  expect(bottomBar).toContain("Trang chủ");
  expect(bottomBar).toContain("Ôn tập");
  expect(bottomBar).toContain("Luyện đề");
  expect(bottomBar).toContain("Tra cứu");
  expect(bottomBar).toContain("Tiến độ");
});
