import { miniPack } from "@/core/content/__fixtures__/mini-pack";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { KanjiCard } from "./KanjiCard";

it("shows only the compounds supplied for the selected kanji", () => {
  const empty = renderToStaticMarkup(
    <KanjiCard entry={miniPack.kanji[0]} index={1} compounds={[]} />,
  );
  const withCompound = renderToStaticMarkup(
    <KanjiCard
      entry={miniPack.kanji[0]}
      index={1}
      compounds={miniPack.compounds}
    />,
  );
  expect(empty).not.toContain("見学");
  expect(withCompound).toContain("見学");
});
