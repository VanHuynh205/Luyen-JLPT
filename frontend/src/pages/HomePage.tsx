import { ProgressPanel } from "@/components/home/ProgressPanel";
import { SectionCard } from "@/components/home/SectionCard";
import {
  computeSectionStats,
  getStudySections,
} from "@/components/home/sections";
import { Button } from "@/components/ui/button";
import { useReadyPack } from "@/hooks/useContent";
import { useIsSignedIn, useMyProgress } from "@/hooks/useProgress";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";

export default function HomePage() {
  const pack = useReadyPack();
  const level = pack.manifest.level.toUpperCase();
  const studySections = useMemo(() => getStudySections(pack), [pack]);
  const { isInitializing } = useIsSignedIn();
  const progress = useMyProgress();
  const reduceMotion = useReducedMotion();

  const stats = useMemo(
    () => (progress.data ? computeSectionStats(progress.data, pack) : null),
    [progress.data, pack],
  );
  const showStats = !progress.isError ? stats : null;
  const isLoading =
    isInitializing ||
    ((progress.isPending || !progress.data) && !progress.isError);

  const fadeUp = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease: "easeOut" as const },
        };

  return (
    <div data-ocid="home.page">
      <section className="bg-paper relative overflow-hidden border-b">
        <span
          aria-hidden="true"
          className="font-jp pointer-events-none absolute left-1/2 top-6 hidden select-none text-[14rem] leading-none text-foreground/[0.04] lg:block"
          style={{ writingMode: "vertical-rl" }}
        >
          合格
        </span>
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[1.25fr_1fr] lg:items-center">
          <motion.div {...fadeUp(0)}>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              Luyện thi năng lực tiếng Nhật · JLPT {level}
            </p>
            <h1 className="mt-4 text-4xl leading-tight md:text-6xl">
              Chinh phục JLPT {level} mỗi ngày
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
              Từ vựng, kanji, ngữ pháp và đọc hiểu trong một lộ trình gọn gàng.
              Mỗi chữ Nhật đều có cách đọc{" "}
              <ruby className="font-jp text-foreground" lang="ja">
                振<rt>ふ</rt>
              </ruby>
              <span className="font-jp text-foreground" lang="ja">
                り
              </span>
              <ruby className="font-jp text-foreground" lang="ja">
                仮名<rt>がな</rt>
              </ruby>
              , âm Hán Việt và nghĩa tiếng Việt.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="rounded-md transition-smooth"
              >
                <Link to="/tu-vung" data-ocid="home.hero.primary_button">
                  Bắt đầu học
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-md bg-card transition-smooth"
              >
                <Link to="/kanji" data-ocid="home.hero.secondary_button">
                  Làm trắc nghiệm kanji
                </Link>
              </Button>
            </div>
          </motion.div>

          <motion.div {...fadeUp(0.15)}>
            <ProgressPanel
              level={level}
              sections={studySections}
              isLoading={isLoading}
              isError={progress.isError}
              isRefetching={progress.isFetching}
              stats={showStats}
              onRetry={() => void progress.refetch()}
            />
          </motion.div>
        </div>
      </section>

      <section
        aria-labelledby="home-sections-title"
        className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-20"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="home-sections-title" className="text-3xl md:text-4xl">
              Lộ trình học tập
            </h2>
            <p className="mt-2 text-muted-foreground">
              Bốn phần bám sát cấu trúc đề thi JLPT {level}. Chọn một phần để
              bắt đầu.
            </p>
          </div>
        </div>
        <div
          data-ocid="home.section.list"
          className="mt-8 grid gap-5 sm:grid-cols-2"
        >
          {studySections.map((section, i) => (
            <motion.div key={section.key} {...fadeUp(0.05 * i)}>
              <SectionCard
                section={section}
                level={level}
                index={i + 1}
                stat={showStats ? showStats[section.key] : null}
              />
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
