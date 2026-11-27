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
  BookOpenText,
  ChevronRight,
  ClipboardCheck,
  Home,
  Languages,
  Layers,
  LogIn,
  Menu,
  Search,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const NAV_ITEMS = [
  { to: "/", label: "Trang chủ", id: "home", exact: true },
  { to: "/tu-vung", label: "Từ vựng", id: "vocabulary", exact: false },
  { to: "/kanji", label: "Kanji", id: "kanji", exact: false },
  { to: "/ngu-phap", label: "Ngữ pháp", id: "grammar", exact: false },
  { to: "/doc-hieu", label: "Đọc hiểu", id: "reading", exact: false },
  { to: "/luyen-de", label: "Luyện đề", id: "exam", exact: false },
  { to: "/tien-do", label: "Tiến độ của tôi", id: "progress", exact: false },
] as const;

type MobileMenuKey = "study" | "exam";

interface MobileMenuSubLink {
  id: string;
  to: "/tu-vung" | "/kanji" | "/ngu-phap" | "/luyen-de" | "/doc-hieu";
  label: string;
  hint: string;
  icon: typeof Layers;
}

type MobileTabItem =
  | {
      kind: "link";
      id: "home" | "lookup" | "progress";
      to: "/" | "/kanji/tra-cuu" | "/tien-do";
      label: string;
      exact: boolean;
      icon: typeof Home;
    }
  | {
      kind: "menu";
      id: MobileMenuKey;
      label: string;
      title: string;
      icon: typeof BookOpen;
      items: ReadonlyArray<MobileMenuSubLink>;
    };

const MOBILE_TABS: ReadonlyArray<MobileTabItem> = [
  {
    kind: "link",
    to: "/",
    label: "Trang chủ",
    id: "home",
    exact: true,
    icon: Home,
  },
  {
    kind: "menu",
    id: "study",
    label: "Ôn tập",
    title: "Ôn tập theo phần",
    icon: BookOpen,
    items: [
      {
        id: "vocabulary",
        to: "/tu-vung",
        label: "Từ vựng",
        hint: "Flashcard theo bài",
        icon: Layers,
      },
      {
        id: "kanji",
        to: "/kanji",
        label: "Kanji",
        hint: "Trắc nghiệm & chữ Hán",
        icon: Languages,
      },
      {
        id: "grammar",
        to: "/ngu-phap",
        label: "Ngữ pháp",
        hint: "Mẫu câu & cách chia",
        icon: BookOpen,
      },
    ],
  },
  {
    kind: "menu",
    id: "exam",
    label: "Luyện đề",
    title: "Luyện đề & Đọc hiểu",
    icon: ClipboardCheck,
    items: [
      {
        id: "mock",
        to: "/luyen-de",
        label: "Đề thi JLPT",
        hint: "Đề mô phỏng 3 phần",
        icon: ClipboardCheck,
      },
      {
        id: "reading",
        to: "/doc-hieu",
        label: "Đọc hiểu",
        hint: "Đoạn văn & câu hỏi",
        icon: BookOpenText,
      },
    ],
  },
  {
    kind: "link",
    to: "/kanji/tra-cuu",
    label: "Tra cứu",
    id: "lookup",
    exact: false,
    icon: Search,
  },
  {
    kind: "link",
    to: "/tien-do",
    label: "Tiến độ",
    id: "progress",
    exact: false,
    icon: BarChart3,
  },
];

function isMobileMenuActive(id: MobileMenuKey, pathname: string): boolean {
  if (id === "study") {
    return (
      pathname === "/tu-vung" ||
      pathname === "/kanji" ||
      pathname === "/ngu-phap" ||
      pathname.startsWith("/ngu-phap/")
    );
  }
  return (
    pathname === "/luyen-de" ||
    pathname.startsWith("/luyen-de/") ||
    pathname === "/doc-hieu" ||
    pathname.startsWith("/doc-hieu/")
  );
}

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
  "flex min-h-12 min-w-11 w-full flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[0.6875rem] leading-tight font-medium transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Layout({ routeKey = "" }: { routeKey?: string }) {
  const { level, pack, status, retry } = useContent();
  const { session } = useAuth();
  const currentPath = routeKey;
  const accountRoute = useMatch({ from: "/tai-khoan", shouldThrow: false });
  const aboutRoute = useMatch({ from: "/gioi-thieu", shouldThrow: false });
  const standaloneRoute = accountRoute || aboutRoute;
  const homeRoute = useMatch({ from: "/", shouldThrow: false });
  const [open, setOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<MobileMenuKey | null>(null);
  const bottomNavRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDialogElement>(null);
  const menuTriggerRefs = useRef<
    Partial<Record<MobileMenuKey, HTMLButtonElement | null>>
  >({});
  const year = new Date().getFullYear();

  const activePopoverTab =
    openMenu !== null
      ? MOBILE_TABS.find(
          (tab): tab is Extract<MobileTabItem, { kind: "menu" }> =>
            tab.kind === "menu" && tab.id === openMenu,
        )
      : undefined;

  useEffect(() => {
    void currentPath;
    setOpenMenu(null);
  }, [currentPath]);

  useEffect(() => {
    if (!openMenu) return;
    popoverRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      const trigger = menuTriggerRefs.current[openMenu];
      setOpenMenu(null);
      trigger?.focus();
    };

    const handleOutsideInteraction = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && bottomNavRef.current?.contains(target)) {
        return;
      }
      setOpenMenu(null);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handleOutsideInteraction);
    document.addEventListener("click", handleOutsideInteraction);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handleOutsideInteraction);
      document.removeEventListener("click", handleOutsideInteraction);
    };
  }, [openMenu]);

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
            <Sheet
              open={open}
              onOpenChange={(next) => {
                setOpen(next);
                if (next) setOpenMenu(null);
              }}
            >
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

      {openMenu !== null && (
        <div
          aria-hidden="true"
          data-ocid="nav.tab.popover_backdrop"
          className="fixed inset-0 z-30 bg-foreground/15 md:hidden"
        />
      )}

      <div
        ref={bottomNavRef}
        className="fixed inset-x-0 bottom-0 z-40 pl-safe pr-safe md:hidden"
      >
        {activePopoverTab && (
          <dialog
            ref={popoverRef}
            open
            id={`mobile-nav-popover-${activePopoverTab.id}`}
            aria-label={activePopoverTab.title}
            tabIndex={-1}
            data-ocid={`nav.tab.${activePopoverTab.id}.popover`}
            className="static inset-auto mx-auto mb-2 block w-[calc(100%-1.5rem)] max-w-md rounded-2xl border bg-popover p-2 text-popover-foreground shadow-elevated focus:outline-none"
          >
            <div className="flex items-center justify-between gap-2 pl-3 pr-0.5">
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {activePopoverTab.title}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Đóng menu ${activePopoverTab.label}`}
                data-ocid={`nav.tab.${activePopoverTab.id}.close_button`}
                className="min-h-11 min-w-11 sm:size-11"
                onClick={() => {
                  const trigger = menuTriggerRefs.current[activePopoverTab.id];
                  setOpenMenu(null);
                  trigger?.focus();
                }}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <ul className="mt-1 flex flex-col gap-1">
              {activePopoverTab.items.map((sub) => {
                const SubIcon = sub.icon;
                return (
                  <li key={sub.id}>
                    <Link
                      to={sub.to}
                      data-ocid={`nav.tab.${activePopoverTab.id}.${sub.id}.link`}
                      onClick={() => setOpenMenu(null)}
                      className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-medium text-popover-foreground transition-smooth hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      activeProps={{
                        className:
                          "flex min-h-11 items-center justify-between gap-3 rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-primary transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        "aria-current": "page",
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <SubIcon
                          className="size-4 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block truncate">{sub.label}</span>
                          <span className="block truncate text-xs font-normal text-muted-foreground">
                            {sub.hint}
                          </span>
                        </span>
                      </span>
                      <ChevronRight
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </dialog>
        )}

        <nav
          aria-label="Điều hướng nhanh"
          data-ocid="nav.bottom_bar"
          className="border-t bg-card/95 pb-safe shadow-subtle backdrop-blur-sm"
        >
          <ul className="mx-auto grid max-w-lg grid-cols-5">
            {MOBILE_TABS.map((item) => {
              const Icon = item.icon;
              if (item.kind === "link") {
                return (
                  <li key={item.id} className="min-w-0">
                    <Link
                      to={item.to}
                      data-ocid={`nav.tab.${item.id}.link`}
                      activeOptions={{ exact: item.exact }}
                      onClick={() => setOpenMenu(null)}
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
              }

              const isOpen = openMenu === item.id;
              const isActive = isMobileMenuActive(item.id, currentPath);
              return (
                <li key={item.id} className="min-w-0">
                  <button
                    ref={(el) => {
                      menuTriggerRefs.current[item.id] = el;
                    }}
                    type="button"
                    data-ocid={`nav.tab.${item.id}.button`}
                    aria-expanded={isOpen}
                    aria-haspopup="dialog"
                    aria-controls={`mobile-nav-popover-${item.id}`}
                    data-active={isActive ? "true" : undefined}
                    onClick={() =>
                      setOpenMenu((prev) => (prev === item.id ? null : item.id))
                    }
                    className={`${mobileTabBase} ${
                      isOpen || isActive
                        ? "font-semibold text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden="true" />
                    <span className="max-w-full truncate">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
