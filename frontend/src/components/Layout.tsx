import { useAuth } from "@/adapters/auth/session";
import { LevelSwitcher } from "@/components/LevelSwitcher";
import { SignInPrompt } from "@/components/SignInPrompt";
import { SyncIndicator } from "@/components/SyncIndicator";
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
import { LogIn, Menu } from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { to: "/", label: "Trang chủ", id: "home", exact: true },
  { to: "/tu-vung", label: "Từ vựng", id: "vocabulary", exact: false },
  { to: "/kanji", label: "Kanji", id: "kanji", exact: false },
  { to: "/ngu-phap", label: "Ngữ pháp", id: "grammar", exact: false },
  { to: "/doc-hieu", label: "Đọc hiểu", id: "reading", exact: false },
  { to: "/tien-do", label: "Tiến độ của tôi", id: "progress", exact: false },
] as const;

function Logo() {
  const { level } = useContent();
  return (
    <Link
      to="/"
      data-ocid="nav.logo.link"
      className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

export function Layout() {
  const { level, pack, status, retry } = useContent();
  const { session } = useAuth();
  const accountRoute = useMatch({ from: "/tai-khoan", shouldThrow: false });
  const homeRoute = useMatch({ from: "/", shouldThrow: false });
  const [open, setOpen] = useState(false);
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-card shadow-subtle">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
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
          <div className="flex items-center gap-2">
            <SyncIndicator />
            <AuthButton className="hidden sm:inline-flex" />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 lg:hidden"
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
                      className="w-full min-h-11"
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
        {!accountRoute && status === "loading" && (
          <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
            <output className="sr-only">Đang tải nội dung</output>
            <div aria-hidden="true" className="space-y-4">
              <Skeleton className="h-10 w-2/3 max-w-80 motion-reduce:animate-none" />
              <Skeleton className="h-36 max-w-2xl motion-reduce:animate-none" />
            </div>
          </section>
        )}
        {!accountRoute && status === "error" && (
          <section className="mx-auto max-w-6xl space-y-4 px-4 py-12 md:px-6">
            <h1 role="alert" className="text-lg font-semibold">
              Không tải được nội dung. Vui lòng thử lại.
            </h1>
            <Button type="button" onClick={retry}>
              Thử lại
            </Button>
          </section>
        )}
        {accountRoute ? (
          <Outlet />
        ) : (
          pack && (
            <Outlet key={`${pack.manifest.level}/${pack.manifest.version}`} />
          )
        )}
      </main>

      <footer className="border-t bg-muted/50">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
          <p>
            Ôn JLPT {level.toUpperCase()} · Từ vựng, kanji, ngữ pháp và đọc
            hiểu.
          </p>
          <p>© {year} Ôn JLPT.</p>
        </div>
      </footer>
    </div>
  );
}
