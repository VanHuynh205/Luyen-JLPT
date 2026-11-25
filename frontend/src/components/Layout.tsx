import { useAuth } from "@/adapters/auth/session";
import { LevelSwitcher } from "@/components/LevelSwitcher";
import { SignInPrompt } from "@/components/SignInPrompt";
import { SyncIndicator } from "@/components/SyncIndicator";
import { PageTransition } from "@/components/motion/PageTransition";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useContent } from "@/hooks/useContent";
import { Link, Outlet, useMatch } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  Home,
  Languages,
  Layers,
  LogIn,
  Menu,
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { to: "/", label: "Trang chủ", id: "home", exact: true },
  { to: "/tu-vung", label: "Từ vựng", id: "vocabulary", exact: false },
  { to: "/kanji", label: "Kanji", id: "kanji", exact: false },
  { to: "/ngu-phap", label: "Ngữ pháp", id: "grammar", exact: false },
  { to: "/doc-hieu", label: "Đọc hiểu", id: "reading", exact: false },
  { to: "/luyen-de", label: "Luyện đề", id: "exam", exact: false },
  { to: "/tien-do", label: "Tiến độ của tôi", id: "progress", exact: false },
] as const;

const MOBILE_TABS = [
  { to: "/", label: "Trang chủ", id: "home", exact: true, icon: Home },
  {
    to: "/tu-vung",
    label: "Từ vựng",
    id: "vocabulary",
    exact: false,
    icon: Layers,
  },
  { to: "/kanji", label: "Kanji", id: "kanji", exact: false, icon: Languages },
  {
    to: "/ngu-phap",
    label: "Ngữ pháp",
    id: "grammar",
    exact: false,
    icon: BookOpen,
  },
  {
    to: "/tien-do",
    label: "Tiến độ",
    id: "progress",
    exact: false,
    icon: BarChart3,
  },
] as const;

function Logo() {
  const { level } = useContent();
  return (
    <Link
      to="/"
      data-ocid="nav.logo.link"
      className="flex shrink-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="font-display text-xl font-semibold tracking-tight text-foreground">
        Ôn JLPT
      </span>
      <span
        className="hanko size-7 text-[0.7rem] leading-none"
        aria-hidden="true"
      >
        {level.toUpperCase()}
      </span>
    </Link>
  );
}

function AuthButton({
  className,
  onClick,
}: { className?: string; onClick?: () => void }) {
  const { session } = useAuth();
  return (
    <Button asChild className={className}>
      <Link to="/tai-khoan" data-ocid="auth.button" onClick={onClick}>
        <LogIn aria-hidden="true" />
        {session ? "Tài khoản" : "Đăng nhập"}
      </Link>
    </Button>
  );
}

const linkBase =
  "rounded-md px-3 py-2 text-sm font-medium transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const mobileTabBase =
  "flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[0.6875rem] leading-tight font-medium transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Layout({ routeKey = "" }: { routeKey?: string }) {
  const { level, pack, status, retry } = useContent();
  const { session } = useAuth();
  const accountRoute = useMatch({ from: "/tai-khoan", shouldThrow: false });
  const aboutRoute = useMatch({ from: "/gioi-thieu", shouldThrow: false });
  const standaloneRoute = accountRoute || aboutRoute;
  const homeRoute = useMatch({ from: "/", shouldThrow: false });
  const [open, setOpen] = useState(false);
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background pl-safe pr-safe supports-[height:100dvh]:min-h-dvh">
      <header className="sticky top-0 z-40 border-b bg-card/95 pt-safe shadow-subtle backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:h-16 md:gap-4 md:px-6">
          <Logo />
          <nav aria-label="Điều hướng chính" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.id}>
                  <Link
                    to={item.to}
                    data-ocid={`nav.${item.id}.link`}
                    activeOptions={{ exact: item.exact }}
                    className={`${linkBase} text-muted-foreground hover:bg-secondary hover:text-secondary-foreground`}
                    activeProps={{
                      className: `${linkBase} bg-secondary text-primary`,
                      "aria-current": "page",
                    }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex min-w-0 items-center gap-2">
            <SyncIndicator />
            <AuthButton className="hidden sm:inline-flex" />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11 lg:hidden"
                  aria-label="Mở menu"
                  data-ocid="nav.menu.open_modal_button"
                >
                  <Menu className="size-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-72 bg-card"
                data-ocid="nav.sheet"
              >
                <SheetHeader>
                  <SheetTitle className="text-left">
                    <Logo />
                  </SheetTitle>
                </SheetHeader>
                <nav aria-label="Điều hướng di động" className="px-4">
                  <ul className="flex flex-col gap-1">
                    {NAV_ITEMS.map((item) => (
                      <li key={item.id}>
                        <Link
                          to={item.to}
                          data-ocid={`nav.mobile.${item.id}.link`}
                          activeOptions={{ exact: item.exact }}
                          onClick={() => setOpen(false)}
                          className={`${linkBase} flex min-h-11 items-center text-base text-foreground hover:bg-secondary`}
                          activeProps={{
                            className: `${linkBase} flex min-h-11 items-center text-base ink-rule bg-secondary text-primary`,
                            "aria-current": "page",
                          }}
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 sm:hidden">
                    <AuthButton
                      className="min-h-11 w-full"
                      onClick={() => setOpen(false)}
                    />
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        <LevelSwitcher />
      </header>

      <main className="flex-1 bg-paper">
        {!session && homeRoute && <SignInPrompt />}
        {!standaloneRoute && status === "loading" && (
          <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
            <output className="sr-only">Đang tải nội dung</output>
            <div aria-hidden="true" className="space-y-4">
              <Skeleton className="h-10 w-2/3 max-w-80 motion-reduce:animate-none" />
              <Skeleton className="h-36 max-w-2xl motion-reduce:animate-none" />
            </div>
          </section>
        )}
        {!standaloneRoute && status === "error" && (
          <section className="mx-auto max-w-6xl space-y-4 px-4 py-12 md:px-6">
            <h1 role="alert" className="text-lg font-semibold">
              Không tải được nội dung. Vui lòng thử lại.
            </h1>
            <Button type="button" onClick={retry}>
              Thử lại
            </Button>
          </section>
        )}
        {standaloneRoute ? (
          <PageTransition routeKey={routeKey}>
            <Outlet />
          </PageTransition>
        ) : (
          pack && (
            <PageTransition
              routeKey={`${routeKey}:${pack.manifest.level}/${pack.manifest.version}`}
            >
              <Outlet key={`${pack.manifest.level}/${pack.manifest.version}`} />
            </PageTransition>
          )
        )}
      </main>

      <footer className="border-t bg-muted/50 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-safe">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
          <p>
            Ôn JLPT {level.toUpperCase()} · Từ vựng, kanji, ngữ pháp và đọc
            hiểu.
          </p>
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            <span>© {year} Ôn JLPT.</span>
            <Link to="/gioi-thieu" className="underline underline-offset-4">
              Giới thiệu
            </Link>
          </p>
        </div>
      </footer>

      <nav
        aria-label="Điều hướng nhanh"
        data-ocid="nav.bottom_bar"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-safe shadow-subtle backdrop-blur-sm md:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {MOBILE_TABS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id} className="min-w-0">
                <Link
                  to={item.to}
                  data-ocid={`nav.tab.${item.id}.link`}
                  activeOptions={{ exact: item.exact }}
                  className={`${mobileTabBase} text-muted-foreground`}
                  activeProps={{
                    className: `${mobileTabBase} text-primary font-semibold`,
                    "aria-current": "page",
                  }}
                >
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
