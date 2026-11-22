import { Layout } from "@/components/Layout";
import { Toaster } from "@/components/ui/sonner";
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
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Layout />
      <Toaster theme="light" position="top-center" closeButton />
    </>
  ),
});

const routes = [
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

const router = createRouter({ routeTree, scrollRestoration: true });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return <RouterProvider router={router} />;
}
