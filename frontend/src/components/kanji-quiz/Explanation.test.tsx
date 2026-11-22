import { miniPack } from "@/core/content/__fixtures__/mini-pack";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { Explanation } from "./Explanation";

vi.mock("@/hooks/useContent", () => ({
  useContent: () => ({ pack: miniPack }),
}));

it("uses the selected pack to fill missing compound component details", () => {
  const entry = {
    ...miniPack.compounds[0],
    components: [{ kanji: "見", hanViet: "", meaning: "" }],
  };
  const html = renderToStaticMarkup(
    <Explanation item={{ kind: "compound", id: entry.id, entry }} />,
  );
  expect(html).toContain("KIẾN");
  expect(html).toContain("nhìn");
});
