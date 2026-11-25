import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildComparisonLinks,
  splitComparisonDistinctions,
  splitComparisonExamples,
} from "./comparisonLinks";
import type { GrammarComparison, GrammarPattern } from "./types";

function makeGrammar(
  id: string,
  pattern: string,
  overrides: Partial<GrammarPattern> = {},
): GrammarPattern {
  return {
    id,
    lesson: 1,
    pattern,
    connections: {},
    meaning: "",
    usage: "",
    examples: [],
    ...overrides,
  };
}

function makeComparison(
  id: string,
  patterns: string,
  overrides: Partial<GrammarComparison> = {},
): GrammarComparison {
  return {
    id,
    group: "Nhóm thử nghiệm",
    patterns,
    distinction: "A; B",
    whenToUse: "",
    exampleJa: "",
    exampleVi: "",
    ...overrides,
  };
}

describe("buildComparisonLinks (unit rules)", () => {
  it("works with arbitrary level IDs (N3/N2/N1) without hardcoding N4 IDs", () => {
    const grammar = [
      makeGrammar("n3-grammar-1", "～わけではない"),
      makeGrammar("n3-grammar-2", "～わけがない"),
    ];
    const comparisons = [
      makeComparison("n3-cmp-1", "～わけではない／～わけがない／～わけだ", {
        group: "Các mẫu わけ",
      }),
    ];

    const report = buildComparisonLinks(comparisons, grammar);

    expect(report.byComparisonId.get("n3-cmp-1")).toEqual([
      "n3-grammar-1",
      "n3-grammar-2",
    ]);
    expect(report.partsByComparisonId.get("n3-cmp-1")).toEqual([
      { part: "～わけではない", grammarIds: ["n3-grammar-1"] },
      { part: "～わけがない", grammarIds: ["n3-grammar-2"] },
      { part: "～わけだ", grammarIds: [] },
    ]);
    expect(report.byGrammarId.get("n3-grammar-1")).toEqual([comparisons[0]]);
    expect(report.byGrammarId.get("n3-grammar-2")).toEqual([comparisons[0]]);
    expect(report.unmatched).toEqual([
      { comparisonId: "n3-cmp-1", group: "Các mẫu わけ", part: "～わけだ" },
    ]);
  });

  it("never matches bare slot tokens like V, N, A when splitting grammar patterns on ／", () => {
    const grammar = [
      makeGrammar("g-sugiru", "V／A＋すぎる"),
      makeGrammar("g-teoku", "Vておく"),
      makeGrammar("g-ni", "N₁／N₂＋について"),
    ];
    const comparisons = [makeComparison("c-1", "Vておく／V／N₁")];

    const report = buildComparisonLinks(comparisons, grammar);

    expect(report.byComparisonId.get("c-1")).toEqual(["g-teoku"]);
    expect(report.byGrammarId.has("g-sugiru")).toBe(false);
    expect(report.byGrammarId.has("g-ni")).toBe(false);
    expect(report.unmatched.map((item) => item.part)).toEqual(["V", "N₁"]);
  });

  it("guards だけ against matching inside いただけませんか or いただく", () => {
    const grammar = [
      makeGrammar("g-req", "～んですが、Vていただけませんか"),
      makeGrammar("g-itadaku", "N₁は N₂に／から N₃を もらう／いただく"),
      makeGrammar("g-shika", "N／số lượng＋しか＋V phủ định"),
    ];
    const comparisons = [makeComparison("c-limit", "しか～ない／だけ")];

    const report = buildComparisonLinks(comparisons, grammar);

    expect(report.partsByComparisonId.get("c-limit")).toEqual([
      { part: "しか～ない", grammarIds: ["g-shika"] },
      { part: "だけ", grammarIds: [] },
    ]);
    expect(report.unmatched.map((item) => item.part)).toEqual(["だけ"]);
  });

  it("disambiguates same-form patterns via parenthesized hints and trailing Vietnamese descriptors", () => {
    const grammar = [
      makeGrammar("g-shimau-done", "Vてしまう (hoàn tất)"),
      makeGrammar("g-shimau-regret", "Vてしまう (lỡ, ngoài ý muốn)"),
      makeGrammar("g-sou-appear", "Aい／Aな＋そうです (vẻ ngoài)"),
      makeGrammar("g-sou-hearsay", "～そうです (truyền tin)"),
      makeGrammar("g-noni-use", "V辞書形＋のに／Nに (công dụng)"),
      makeGrammar("g-noni-conc", "～のに (nhượng bộ)"),
    ];
    const comparisons = [
      makeComparison("c-shimau", "Vてしまう (hoàn tất)／Vてしまう (lỡ)"),
      makeComparison("c-sou", "～そうだ vẻ ngoài／～そうだ truyền tin"),
      makeComparison(
        "c-noni",
        "V辞書形＋のに (công dụng)／thể thường＋のに (nhượng bộ)",
      ),
    ];

    const report = buildComparisonLinks(comparisons, grammar);

    expect(report.partsByComparisonId.get("c-shimau")).toEqual([
      { part: "Vてしまう (hoàn tất)", grammarIds: ["g-shimau-done"] },
      { part: "Vてしまう (lỡ)", grammarIds: ["g-shimau-regret"] },
    ]);
    expect(report.partsByComparisonId.get("c-sou")).toEqual([
      { part: "～そうだ vẻ ngoài", grammarIds: ["g-sou-appear"] },
      { part: "～そうだ truyền tin", grammarIds: ["g-sou-hearsay"] },
    ]);
    expect(report.partsByComparisonId.get("c-noni")).toEqual([
      { part: "V辞書形＋のに (công dụng)", grammarIds: ["g-noni-use"] },
      { part: "thể thường＋のに (nhượng bộ)", grammarIds: ["g-noni-conc"] },
    ]);
  });

  it("normalizes polite/plain forms and slot aliases without false collisions like ～ようだ vs Vよう", () => {
    const grammar = [
      makeGrammar("g-vol", "Thể ý hướng／Vよう"),
      makeGrammar("g-youda", "～ようです (suy đoán)"),
      makeGrammar("g-hougaii", "Vた／Vない＋ほうがいい"),
      makeGrammar("g-omou", "V意向形＋と思います"),
      makeGrammar("g-omotte", "V意向形＋と思っています"),
      makeGrammar("g-kamo", "～かもしれません"),
      makeGrammar("g-hazu", "～はずです"),
      makeGrammar("g-jidoshi", "Nが／Nは＋tự động từ thể て＋いる"),
      makeGrammar("g-tadoshi", "Nが／Nは Vてある"),
      makeGrammar("g-goni", "Lượng thời gian＋後に"),
      makeGrammar("g-shieki", "V使役て＋いただけませんか"),
    ];
    const comparisons = [
      makeComparison(
        "c-norm",
        "～ようだ／～たほうがいいです／Vようと思う／Vようと思っている／かもしれない／はずだ／自動詞ている／他動詞てある／lượng＋後に／Vさせていただけませんか",
      ),
    ];

    const report = buildComparisonLinks(comparisons, grammar);

    expect(report.partsByComparisonId.get("c-norm")).toEqual([
      { part: "～ようだ", grammarIds: ["g-youda"] },
      { part: "～たほうがいいです", grammarIds: ["g-hougaii"] },
      { part: "Vようと思う", grammarIds: ["g-omou"] },
      { part: "Vようと思っている", grammarIds: ["g-omotte"] },
      { part: "かもしれない", grammarIds: ["g-kamo"] },
      { part: "はずだ", grammarIds: ["g-hazu"] },
      { part: "自動詞ている", grammarIds: ["g-jidoshi"] },
      { part: "他動詞てある", grammarIds: ["g-tadoshi"] },
      { part: "lượng＋後に", grammarIds: ["g-goni"] },
      { part: "Vさせていただけませんか", grammarIds: ["g-shieki"] },
    ]);
    expect(report.byGrammarId.has("g-vol")).toBe(false);
  });

  it("handles ・ sub-parts inside ／-parts and splits standalone ・-only lists", () => {
    const grammar = [
      makeGrammar("g-tara", "～んですが、疑問詞＋Vたらいいですか"),
      makeGrammar("g-ba", "疑問詞＋Vばいいですか"),
      makeGrammar("g-req", "Vてもらえませんか／Vてください"),
      makeGrammar("g-itadake", "～んですが、Vていただけませんか"),
    ];
    const comparisons = [
      makeComparison("c-advice", "～たらいいですか・～ばいいですか"),
      makeComparison(
        "c-polite",
        "てください・てもらえませんか・ていただけませんか",
      ),
    ];

    const report = buildComparisonLinks(comparisons, grammar);

    expect(report.byComparisonId.get("c-advice")).toEqual(["g-tara", "g-ba"]);
    expect(report.partsByComparisonId.get("c-polite")).toEqual([
      { part: "てください", grammarIds: ["g-req"] },
      { part: "てもらえませんか", grammarIds: ["g-req"] },
      { part: "ていただけませんか", grammarIds: ["g-itadake"] },
    ]);
  });
});

describe("buildComparisonLinks (real N4 pack)", () => {
  const comparisons = JSON.parse(
    readFileSync(
      new URL("../../../../infra/content/n4/comparisons.json", import.meta.url),
      "utf8",
    ),
  ) as GrammarComparison[];
  const grammar = JSON.parse(
    readFileSync(
      new URL("../../../../infra/content/n4/grammar.json", import.meta.url),
      "utf8",
    ),
  ) as GrammarPattern[];

  it("links all N4 comparisons accurately with zero false positives and only genuine meta/N5 unmatched parts", () => {
    const report = buildComparisonLinks(comparisons, grammar);

    expect(report.partsByComparisonId.get("comparison-SS001")).toEqual([
      { part: "～んですか", grammarIds: ["grammar-G001"] },
      { part: "～ですか・ますか", grammarIds: [] },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS002")).toEqual([
      {
        part: "～たらいいですか・～ばいいですか",
        grammarIds: ["grammar-G008", "grammar-G059"],
      },
      { part: "～たほうがいいです", grammarIds: ["grammar-G039"] },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS003")).toEqual([
      { part: "Vていただけませんか", grammarIds: ["grammar-G007"] },
      { part: "Vさせていただけませんか", grammarIds: ["grammar-G130"] },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS004")).toEqual([
      { part: "てください", grammarIds: ["grammar-G009"] },
      { part: "てくれませんか", grammarIds: ["grammar-G009", "grammar-G108"] },
      { part: "てもらえませんか", grammarIds: ["grammar-G009"] },
      {
        part: "てくださいませんか",
        grammarIds: ["grammar-G009", "grammar-G100"],
      },
      { part: "ていただけませんか", grammarIds: ["grammar-G007"] },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS005")).toEqual([
      { part: "見える・聞こえる", grammarIds: ["grammar-G011"] },
      { part: "見られる・聞ける", grammarIds: [] },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS006")).toEqual([
      { part: "しか～ない", grammarIds: ["grammar-G014"] },
      { part: "だけ", grammarIds: [] },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS007")).toEqual([
      { part: "自動詞ている", grammarIds: ["grammar-G024"] },
      { part: "他動詞てある", grammarIds: ["grammar-G027"] },
      {
        part: "Vておく",
        grammarIds: ["grammar-G029", "grammar-G030", "grammar-G031"],
      },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS008")).toEqual([
      { part: "Vてしまう (hoàn tất)", grammarIds: ["grammar-G025"] },
      { part: "Vてしまう (lỡ)", grammarIds: ["grammar-G026"] },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS009")).toEqual([
      { part: "Vようと思う", grammarIds: ["grammar-G034"] },
      { part: "Vようと思っている", grammarIds: ["grammar-G033"] },
      { part: "Vる・ないつもり", grammarIds: ["grammar-G035"] },
      { part: "Vる・Nの予定", grammarIds: ["grammar-G036"] },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS010")).toEqual([
      { part: "Vてから", grammarIds: ["grammar-G054"] },
      { part: "Vた・Nのあとで", grammarIds: ["grammar-G053"] },
      { part: "lượng＋後に", grammarIds: ["grammar-G055"] },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS011")).toEqual([
      { part: "と", grammarIds: ["grammar-G063"] },
      { part: "ば", grammarIds: ["grammar-G058"] },
      { part: "たら", grammarIds: ["grammar-G062"] },
      { part: "なら", grammarIds: ["grammar-G060"] },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS012")).toEqual([
      { part: "～場合は", grammarIds: ["grammar-G115"] },
      { part: "～とき", grammarIds: [] },
      { part: "～たら", grammarIds: ["grammar-G062"] },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS013")).toEqual([
      { part: "Vる・ないように", grammarIds: ["grammar-G064"] },
      { part: "Vる・Nのために", grammarIds: ["grammar-G102"] },
      { part: "Vるのに・Nに", grammarIds: ["grammar-G103"] },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS014")).toEqual([
      { part: "ようにする", grammarIds: ["grammar-G068"] },
      { part: "ようになる", grammarIds: ["grammar-G066"] },
      { part: "なくなる", grammarIds: ["grammar-G067"] },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS015")).toEqual([
      { part: "Vないで", grammarIds: ["grammar-G056", "grammar-G057"] },
      { part: "Vなくて", grammarIds: ["grammar-G083"] },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS016")).toEqual([
      { part: "から", grammarIds: ["grammar-G088"] },
      { part: "ので", grammarIds: ["grammar-G086"] },
      {
        part: "Vて・Aくて・Nで",
        grammarIds: ["grammar-G083", "grammar-G084", "grammar-G085"],
      },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS017")).toEqual([
      { part: "V辞書形＋のに (công dụng)", grammarIds: ["grammar-G103"] },
      { part: "thể thường＋のに (nhượng bộ)", grammarIds: ["grammar-G116"] },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS018")).toEqual([
      { part: "Vたところ", grammarIds: ["grammar-G119"] },
      { part: "Vたばかり", grammarIds: ["grammar-G120"] },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS019")).toEqual([
      { part: "でしょう", grammarIds: ["grammar-G040"] },
      { part: "かもしれない", grammarIds: ["grammar-G041"] },
      { part: "はずだ", grammarIds: ["grammar-G122"] },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS020")).toEqual([
      { part: "～そうだ vẻ ngoài", grammarIds: ["grammar-G106"] },
      { part: "～そうだ truyền tin", grammarIds: ["grammar-G123"] },
      { part: "～ようだ", grammarIds: ["grammar-G124"] },
      { part: "～らしい", grammarIds: ["grammar-G126"] },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS021")).toEqual([
      { part: "Vられる", grammarIds: ["grammar-G134"] },
      { part: "Vれる", grammarIds: ["grammar-G134"] },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS022")).toEqual([
      { part: "あげる", grammarIds: ["grammar-G094"] },
      { part: "くれる", grammarIds: ["grammar-G096"] },
      { part: "もらう", grammarIds: ["grammar-G095"] },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS024")).toEqual([
      { part: "Aく・Aに・Nに なる", grammarIds: ["grammar-G070"] },
      { part: "Aく・Aに・Nに する", grammarIds: ["grammar-G111"] },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS026")).toEqual([
      { part: "それで", grammarIds: ["grammar-G140"] },
      { part: "そこで", grammarIds: ["grammar-G140"] },
      { part: "それに", grammarIds: ["grammar-G019"] },
    ]);
    expect(report.partsByComparisonId.get("comparison-SS027")).toEqual([
      { part: "～てくる", grammarIds: ["grammar-G107", "grammar-G147"] },
      { part: "～ていく", grammarIds: ["grammar-G147"] },
    ]);

    expect(report.byGrammarId.has("grammar-G109")).toBe(false);
    expect(report.byGrammarId.has("grammar-G032")).toBe(false);

    expect(
      report.unmatched.map(
        ({ comparisonId, part }) => `${comparisonId}:${part}`,
      ),
    ).toEqual([
      "comparison-SS001:～ですか・ますか",
      "comparison-SS005:見られる・聞ける",
      "comparison-SS006:だけ",
      "comparison-SS012:～とき",
      "comparison-SS023:尊敬語",
      "comparison-SS023:謙譲語I",
      "comparison-SS023:謙譲語II",
      "comparison-SS023:丁寧語",
      "comparison-SS025:の",
      "comparison-SS025:こと",
    ]);

    for (const [comparisonId, grammarIds] of report.byComparisonId) {
      for (const grammarId of grammarIds) {
        const linked = report.byGrammarId.get(grammarId) ?? [];
        expect(linked.some((item) => item.id === comparisonId)).toBe(true);
      }
    }
  });
});

describe("splitComparisonExamples", () => {
  it("splits ／-separated pairs before sentence punctuation (preserving multi-sentence sides)", () => {
    expect(
      splitComparisonExamples(
        "道が分からなかった。そこで駅員に聞いた。／この部屋は広い。それに明るい。",
        "Tôi không biết đường nên hỏi nhân viên ga.／Phòng này rộng. Hơn nữa còn sáng.",
      ),
    ).toEqual([
      {
        ja: "道が分からなかった。そこで駅員に聞いた。",
        vi: "Tôi không biết đường nên hỏi nhân viên ga.",
      },
      {
        ja: "この部屋は広い。それに明るい。",
        vi: "Phòng này rộng. Hơn nữa còn sáng.",
      },
    ]);
  });

  it("splits aligned multi-sentence examples when no ／ separator is present", () => {
    expect(
      splitComparisonExamples(
        "納豆が食べられます。魚が猫に食べられました。先生は何を食べられますか。",
        "Tôi ăn được natto. Cá bị mèo ăn. Thầy/cô dùng món gì ạ?",
      ),
    ).toEqual([
      { ja: "納豆が食べられます。", vi: "Tôi ăn được natto." },
      { ja: "魚が猫に食べられました。", vi: "Cá bị mèo ăn." },
      { ja: "先生は何を食べられますか。", vi: "Thầy/cô dùng món gì ạ?" },
    ]);
  });

  it("falls back to a single pair when counts differ and returns [] for blank input", () => {
    expect(splitComparisonExamples("一。二。", "Một câu duy nhất.")).toEqual([
      { ja: "一。二。", vi: "Một câu duy nhất." },
    ]);
    expect(splitComparisonExamples("  ", "")).toEqual([]);
  });
});

describe("splitComparisonDistinctions", () => {
  it("aligns ／-separated patterns with ;-separated distinctions", () => {
    expect(
      splitComparisonDistinctions(
        "Vてしまう (hoàn tất)／Vてしまう (lỡ)",
        "Hoàn thành trọn vẹn; việc không mong muốn hay tiếc nuối",
      ),
    ).toEqual([
      { pattern: "Vてしまう (hoàn tất)", detail: "Hoàn thành trọn vẹn" },
      {
        pattern: "Vてしまう (lỡ)",
        detail: "việc không mong muốn hay tiếc nuối",
      },
    ]);
  });

  it("aligns ・-separated patterns when there is no ／ separator", () => {
    expect(
      splitComparisonDistinctions(
        "てください・てくれませんか・てもらえませんか・てくださいませんか・ていただけませんか",
        "Yêu cầu trực tiếp; nhờ gần gũi; xin nhận giúp đỡ; dùng tôn kính của くれる; dùng khiêm nhường ở phía nhận",
      ),
    ).toEqual([
      { pattern: "てください", detail: "Yêu cầu trực tiếp" },
      { pattern: "てくれませんか", detail: "nhờ gần gũi" },
      { pattern: "てもらえませんか", detail: "xin nhận giúp đỡ" },
      { pattern: "てくださいませんか", detail: "dùng tôn kính của くれる" },
      {
        pattern: "ていただけませんか",
        detail: "dùng khiêm nhường ở phía nhận",
      },
    ]);
  });

  it("returns null when pattern count does not match distinction count", () => {
    expect(
      splitComparisonDistinctions(
        "Vられる／Vれる",
        "Có thể làm; đối tượng chịu tác động; người được kính trọng làm",
      ),
    ).toBeNull();
    expect(splitComparisonDistinctions("A／B", "Chỉ một mô tả")).toBeNull();
  });

  it("splits all 27 real N4 comparisons cleanly (26 aligned, SS021 returns null)", () => {
    const comparisons = JSON.parse(
      readFileSync(
        new URL(
          "../../../../infra/content/n4/comparisons.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as GrammarComparison[];

    const nullIds: string[] = [];
    for (const item of comparisons) {
      const examples = splitComparisonExamples(item.exampleJa, item.exampleVi);
      expect(examples.length).toBeGreaterThanOrEqual(2);
      for (const pair of examples) {
        expect(pair.ja.length).toBeGreaterThan(0);
        expect(pair.vi.length).toBeGreaterThan(0);
      }
      const distinctions = splitComparisonDistinctions(
        item.patterns,
        item.distinction,
      );
      if (distinctions === null) nullIds.push(item.id);
    }
    expect(nullIds).toEqual(["comparison-SS021"]);
  });
});
