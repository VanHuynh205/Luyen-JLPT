import { ProgressPanel } from "@/components/home/ProgressPanel";
import { SectionCard } from "@/components/home/SectionCard";
import {
  computeSectionStats,
  getStudySections,
} from "@/components/home/sections";
import { HomeSmoothScroll } from "@/components/motion/HomeSmoothScroll";
import { PaperTiltCard } from "@/components/motion/PaperTiltCard";
import { Button } from "@/components/ui/button";
import { useReadyPack } from "@/hooks/useContent";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { useIsSignedIn, useMyProgress } from "@/hooks/useProgress";
import { DeskHeroStage } from "@/scene/DeskHeroStage";
import { Link } from "@tanstack/react-router";
import gsap from "gsap";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

export default function HomePage() {
  const pack = useReadyPack();
  const levelCode = pack.manifest.level;
  const level = levelCode.toUpperCase();
  const studySections = useMemo(() => getStudySections(pack), [pack]);
  const { isInitializing } = useIsSignedIn();
  const progress = useMyProgress();
  const { mode } = useMotionPreference();
  const pageRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(
    () => (progress.data ? computeSectionStats(progress.data, pack) : null),
    [progress.data, pack],
  );
  const showStats = !progress.isError ? stats : null;
  const isLoading =
    isInitializing ||
    ((progress.isPending || !progress.data) && !progress.isError);

  useEffect(() => {
    const root = pageRef.current;
    if (!root || mode === "reduced") return;
    const ctx = gsap.context(() => {
      gsap.from("[data-home-reveal]", {
        opacity: 0,
        y: 12,
        duration: 0.45,
        stagger: 0.06,
        ease: "power2.out",
        clearProps: "transform,opacity",
      });
    }, root);
    return () => ctx.revert();
  }, [mode]);

  return (
    <HomeSmoothScroll>
      <div ref={pageRef} data-ocid="home.page">
        <section className="bg-paper relative overflow-hidden border-b">
          <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 md:px-6 md:py-16 lg:grid-cols-[1.08fr_1fr] lg:items-center lg:gap-12">
            <div data-home-reveal="">
              <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
                Chinh phục JLPT {level} mỗi ngày
              </h1>
              <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
                Từ vựng, kanji, ngữ pháp và đọc hiểu trên một bàn học gọn gàng.
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
            </div>

            <div data-home-reveal="" className="min-w-0">
              <DeskHeroStage level={levelCode} className="w-full" />
            </div>
          </div>
        </section>

        <section
          aria-labelledby="home-sections-title"
          className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16"
        >
          <div className="grid gap-10 lg:grid-cols-[1.55fr_1fr] lg:items-start">
            <div>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 id="home-sections-title" className="text-2xl md:text-3xl">
                    Lộ trình học tập
                  </h2>
                  <p className="mt-2 text-muted-foreground">
                    Bốn phần bám sát cấu trúc đề thi JLPT {level}. Chọn một phần
                    để bắt đầu.
                  </p>
                </div>
              </div>
              <div
                data-ocid="home.section.list"
                className="mt-6 grid gap-5 sm:grid-cols-2"
              >
                {studySections.map((section, i) => (
                  <div key={section.key} data-home-reveal="" className="h-full">
                    <PaperTiltCard className="h-full">
                      <SectionCard
                        section={section}
                        level={level}
                        index={i + 1}
                        stat={showStats ? showStats[section.key] : null}
                      />
                    </PaperTiltCard>
                  </div>
                ))}
              </div>
              <div
                data-home-reveal=""
                className="mt-6 flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card sm:flex-row sm:items-center sm:justify-between md:p-6"
              >
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold text-foreground">
                    Đề thi thử JLPT {level}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Làm đề mô phỏng 3 phần có bấm giờ chuẩn, tự động khóa đáp án
                    khi hết giờ và xem lời giải chi tiết.
                  </p>
                </div>
                <Button
                  asChild
                  className="min-h-11 shrink-0 rounded-md transition-smooth"
                >
                  <Link to="/luyen-de" data-ocid="home.exam.link">
                    Luyện đề JLPT {level}
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>

            <div data-home-reveal="" className="lg:sticky lg:top-32">
              <ProgressPanel
                level={level}
                sections={studySections}
                isLoading={isLoading}
                isError={progress.isError}
                isRefetching={progress.isFetching}
                stats={showStats}
                onRetry={() => void progress.refetch()}
              />
            </div>
          </div>
        </section>
      </div>
    </HomeSmoothScroll>
  );
}
