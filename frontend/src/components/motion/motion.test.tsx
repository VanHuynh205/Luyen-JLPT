import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HankoStamp } from "./HankoStamp";
import { HomeSmoothScroll } from "./HomeSmoothScroll";
import { PageTransition } from "./PageTransition";
import { PaperTiltCard } from "./PaperTiltCard";

describe("motion components SSR safety and contract", () => {
  it("renders HomeSmoothScroll children without browser globals", () => {
    const html = renderToStaticMarkup(
      <HomeSmoothScroll>
        <section>Trang chủ</section>
      </HomeSmoothScroll>,
    );
    expect(html).toContain("<section>Trang chủ</section>");
  });

  it("renders PageTransition visible by default with custom className", () => {
    const html = renderToStaticMarkup(
      <PageTransition routeKey="/tu-vung" className="study-shell">
        <p>Từ vựng N4</p>
      </PageTransition>,
    );
    expect(html).toContain("study-shell");
    expect(html).toContain("Từ vựng N4");
    expect(html).not.toContain("opacity:0");
  });

  it("renders HankoStamp with label, optional sublabel, and size variants", () => {
    const withSub = renderToStaticMarkup(
      <HankoStamp label="9/10" sublabel="Đạt" size="lg" className="my-seal" />,
    );
    expect(withSub).toContain("9/10");
    expect(withSub).toContain("Đạt");
    expect(withSub).toContain("my-seal");
    expect(withSub).toContain("-rotate-[4deg]");

    const compact = renderToStaticMarkup(<HankoStamp label="N4" size="sm" />);
    expect(compact).toContain("N4");
    expect(compact).not.toContain("border-t");
  });

  it("renders PaperTiltCard children and subtle sheen layer", () => {
    const html = renderToStaticMarkup(
      <PaperTiltCard className="rounded-xl" maxTiltDeg={3}>
        <div>Thẻ học</div>
      </PaperTiltCard>,
    );
    expect(html).toContain("rounded-xl");
    expect(html).toContain("Thẻ học");
    expect(html).toContain("opacity-0");
  });
});
