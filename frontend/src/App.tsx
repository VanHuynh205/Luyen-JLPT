import { completeNativeSignIn } from "@/adapters/auth/client";
import { listenForNativeAuth } from "@/adapters/auth/nativeAuth";
import { Layout } from "@/components/Layout";
import { NativeUpdates } from "@/components/NativeUpdates";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import AboutPage from "@/pages/AboutPage";
import AccountPage from "@/pages/AccountPage";
import GrammarDetailPage from "@/pages/GrammarDetailPage";
import GrammarListPage from "@/pages/GrammarListPage";
import HomePage from "@/pages/HomePage";
import KanjiLibraryPage from "@/pages/KanjiLibraryPage";
import KanjiQuizPage from "@/pages/KanjiQuizPage";
import ProgressPage from "@/pages/ProgressPage";
import ReadingDetailPage from "@/pages/ReadingDetailPage";
import ReadingListPage from "@/pages/ReadingListPage";
import VocabularyPage from "@/pages/VocabularyPage";
import {
  Link,
  RouterProvider,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  useRouterState,
} from "@tanstack/react-router";
import { isTauri } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { toast } from "sonner";

function RootShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <>
      <Layout routeKey={pathname} />
      <Toaster theme="light" position="top-center" closeButton />
      <NativeUpdates />
    </>
  );
}

function NotFoundPage() {
  return (
    <section
      data-ocid="not_found.page"
      className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center md:px-6"
    >
      <p lang="ja" className="font-jp text-5xl font-semibold text-primary/35">
        迷
      </p>
      <h1 className="mt-4 text-3xl font-semibold">Không tìm thấy trang</h1>
      <p className="mt-2 text-muted-foreground">
        Đường dẫn này không tồn tại hoặc đã được chuyển đi. Bạn có thể quay lại
        trang chủ để tiếp tục ôn tập.
      </p>
      <Button asChild className="mt-6 rounded-md">
        <Link to="/">Về trang chủ</Link>
      </Button>
    </section>
  );
}

const rootRoute = createRootRoute({
  component: RootShell,
});

const routes = [
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/gioi-thieu",
    component: AboutPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/tai-khoan",
    component: AccountPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: HomePage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/tu-vung",
    component: VocabularyPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/kanji",
    component: KanjiQuizPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/kanji/tra-cuu",
    component: KanjiLibraryPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/ngu-phap",
    component: GrammarListPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/ngu-phap/$patternId",
    component: GrammarDetailPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/doc-hieu",
    component: ReadingListPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/doc-hieu/$passageId",
    component: ReadingDetailPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/tien-do",
    component: ProgressPage,
  }),
] as const;

const routeTree = rootRoute.addChildren(routes);

const router = createRouter({
  routeTree,
  scrollRestoration: true,
  defaultNotFoundComponent: NotFoundPage,
  history: isTauri() ? createHashHistory() : undefined,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    let cleanup: (() => void) | undefined;
    let exchange = Promise.resolve();
    void listenForNativeAuth((callback) => {
      exchange = exchange
        .then(async () => {
          if (!active) return;
          let signedIn = false;
          if (callback.code) {
            signedIn = await completeNativeSignIn(
              callback.code,
              callback.flowId,
            ).then(
              () => true,
              () => false,
            );
          }
          if (!active) return;
          await router.navigate({ to: "/tai-khoan", replace: true });
          if (!signedIn) {
            toast.error("Liên kết tài khoản không hợp lệ hoặc đã hết hạn.");
          }
        })
        .catch(() => {
          if (active) toast.error("Không mở được liên kết tài khoản.");
        });
    })
      .then((unlisten) => {
        if (active) cleanup = unlisten;
        else unlisten();
      })
      .catch(() => {
        if (active) toast.error("Không mở được liên kết tài khoản.");
      });
    return () => {
      active = false;
      cleanup?.();
    };
  }, []);
  return <RouterProvider router={router} />;
}
