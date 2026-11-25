import type { ContentPack } from "@/core/content/types";
import { useContent } from "@/hooks/useContent";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

const SUB_NAV_ITEMS = [
  {
    id: "grammar",
    to: "/ngu-phap",
    label: "Mẫu ngữ pháp",
    exact: true,
    count: (pack: ContentPack) => pack.grammar.length,
  },
  {
    id: "comparisons",
    to: "/ngu-phap/so-sanh",
    label: "So sánh",
    exact: false,
    count: (pack: ContentPack) => pack.comparisons.length,
  },
  {
    id: "conjugations",
    to: "/ngu-phap/cach-chia",
    label: "Bảng chia",
    exact: false,
    count: (pack: ContentPack) => pack.conjugations.length,
  },
  {
    id: "keigo",
    to: "/ngu-phap/kinh-ngu",
    label: "Kính ngữ",
    exact: false,
    count: (pack: ContentPack) => pack.keigo.length,
  },
  {
    id: "verb_pairs",
    to: "/ngu-phap/tu-dong-tha-dong",
    label: "Tự / Tha động từ",
    exact: false,
    count: (pack: ContentPack) => pack.verbPairs.length,
  },
] as const;

export type GrammarSubNavRoute = (typeof SUB_NAV_ITEMS)[number]["to"];

const BASE_LINK_CLASS =
  "group inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const ACTIVE_LINK_CLASS =
  "border-primary bg-primary text-primary-foreground shadow-subtle";
const INACTIVE_LINK_CLASS =
  "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-secondary/60 hover:text-foreground";
const COUNT_BADGE_CLASS =
  "rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground group-aria-[current=page]:bg-primary-foreground/20 group-aria-[current=page]:text-primary-foreground";

export function GrammarSubNav({
  active,
  className,
}: {
  active?: GrammarSubNavRoute;
  className?: string;
}) {
  const { pack } = useContent();

  return (
    <nav
      aria-label="Phân mục ngữ pháp"
      data-ocid="grammar_subnav.nav"
      className={cn("mt-6 flex flex-wrap items-center gap-2", className)}
    >
      {SUB_NAV_ITEMS.map((item) => {
        const count = pack ? item.count(pack) : null;
        const linkProps =
          active !== undefined
            ? {
                "aria-current":
                  active === item.to ? ("page" as const) : undefined,
                className: cn(
                  BASE_LINK_CLASS,
                  active === item.to ? ACTIVE_LINK_CLASS : INACTIVE_LINK_CLASS,
                ),
              }
            : {
                activeOptions: { exact: item.exact },
                className: BASE_LINK_CLASS,
                activeProps: {
                  className: ACTIVE_LINK_CLASS,
                  "aria-current": "page" as const,
                },
                inactiveProps: {
                  className: INACTIVE_LINK_CLASS,
                },
              };

        return (
          <Link
            key={item.id}
            to={item.to}
            data-ocid={`grammar_subnav.${item.id}.link`}
            {...linkProps}
          >
            <span className="truncate">{item.label}</span>
            {count !== null && (
              <span className={COUNT_BADGE_CLASS}>{count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
