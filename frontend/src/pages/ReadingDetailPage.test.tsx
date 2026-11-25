import { miniPack } from "@/core/content/__fixtures__/mini-pack";
import type { ContentPack, ReadingPassage } from "@/core/content/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReadingDetailPage from "./ReadingDetailPage";

const routeState = vi.hoisted(() => ({
  passageId: "reading-01",
}));

const recordReadingAttempt = vi.hoisted(() => vi.fn());

const PASSAGE_ONE: ReadingPassage = {
  id: "reading-01",
  title: "Bài đọc số 1",
  length: "short",
  text: "昨日、友達と映画を見ました。",
  translation: "Hôm qua tôi đã xem phim cùng bạn.",
  vocabulary: [{ word: "映画", reading: "えいが", meaning: "phim" }],
  questions: [
    {
      question: "昨日、何をしましたか。",
      choices: ["映画を見ました", "本を読みました"],
      answerIndex: 0,
      explanation: "Trong bài có câu 「映画を見ました」.",
    },
  ],
};

const PASSAGE_TWO: ReadingPassage = {
  id: "reading-02",
  title: "Bài đọc số 2",
  length: "medium",
  text: "来週の土曜日、京都へ行きます。電車で行きます。",
  translation: "Thứ Bảy tuần sau tôi sẽ đi Kyoto. Tôi đi bằng tàu điện.",
  vocabulary: [{ word: "電車", reading: "でんしゃ", meaning: "tàu điện" }],
  questions: [
    {
      question: "いつ京都へ行きますか。",
      choices: ["今週の土曜日", "来週の土曜日"],
      answerIndex: 1,
      explanation: "Trong bài ghi 「来週の土曜日」.",
    },
    {
      question: "何で行きますか。",
      choices: ["バス", "電車"],
      answerIndex: 1,
      explanation: "Trong bài ghi 「電車で行きます」.",
    },
  ],
};

const testPack: ContentPack = {
  ...miniPack,
  manifest: {
    ...miniPack.manifest,
    counts: { ...miniPack.manifest.counts, reading: 2 },
  },
  reading: [PASSAGE_ONE, PASSAGE_TWO],
};

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...rest
  }: {
    children: ReactNode;
    to: string;
    [key: string]: unknown;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useParams: () => ({ passageId: routeState.passageId }),
}));

vi.mock("@/hooks/useContent", () => ({
  useContent: () => ({
    level: testPack.manifest.level,
    available: [testPack.manifest.level],
    pack: testPack,
    status: "ready" as const,
    retry: () => {},
    preferenceSync: { pending: false, synced: false },
  }),
  useReadyPack: () => testPack,
}));

vi.mock("@/hooks/useMotionPreference", () => ({
  useMotionPreference: () => ({
    preference: "reduced" as const,
    mode: "reduced" as const,
    osReduced: true,
    webglSupported: false,
    lowPerf: false,
    setPreference: () => {},
    markLowPerf: () => {},
  }),
}));

vi.mock("@/adapters/auth/session", () => ({
  useAuth: () => ({ session: null }),
}));

vi.mock("@/adapters/local-store/progress", () => ({
  progressStore: {
    recordReadingAttempt,
  },
}));

class TestEvent {
  type: string;
  bubbles: boolean;
  cancelable: boolean;
  defaultPrevented = false;
  target: TestNode | null = null;
  currentTarget: TestNode | null = null;

  constructor(
    type: string,
    init: { bubbles?: boolean; cancelable?: boolean } = {},
  ) {
    this.type = type;
    this.bubbles = Boolean(init.bubbles);
    this.cancelable = Boolean(init.cancelable);
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {}
}

class TestNode {
  nodeType: number;
  nodeName: string;
  ownerDocument: TestDocument;
  parentNode: TestNode | null = null;
  childNodes: TestNode[] = [];

  constructor(nodeType: number, nodeName: string, ownerDocument: TestDocument) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.ownerDocument = ownerDocument;
  }

  get firstChild() {
    return this.childNodes[0] ?? null;
  }

  get lastChild() {
    return this.childNodes[this.childNodes.length - 1] ?? null;
  }

  get nextSibling() {
    if (!this.parentNode) return null;
    const index = this.parentNode.childNodes.indexOf(this);
    return index >= 0 ? (this.parentNode.childNodes[index + 1] ?? null) : null;
  }

  get previousSibling() {
    if (!this.parentNode) return null;
    const index = this.parentNode.childNodes.indexOf(this);
    return index > 0 ? (this.parentNode.childNodes[index - 1] ?? null) : null;
  }

  appendChild(child: TestNode) {
    return this.insertBefore(child, null);
  }

  insertBefore(child: TestNode, ref: TestNode | null) {
    if (child.nodeType === 11) {
      for (const fragmentChild of [...child.childNodes]) {
        this.insertBefore(fragmentChild, ref);
      }
      return child;
    }
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    const index = ref ? this.childNodes.indexOf(ref) : -1;
    if (index >= 0) {
      this.childNodes.splice(index, 0, child);
    } else {
      this.childNodes.push(child);
    }
    return child;
  }

  removeChild(child: TestNode) {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
      child.parentNode = null;
    }
    return child;
  }

  get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    for (const child of this.childNodes) {
      child.parentNode = null;
    }
    this.childNodes =
      value === "" ? [] : [new TestText(value, this.ownerDocument)];
    if (this.childNodes[0]) {
      this.childNodes[0].parentNode = this;
    }
  }
}

class TestText extends TestNode {
  private value: string;

  constructor(value: string, ownerDocument: TestDocument) {
    super(3, "#text", ownerDocument);
    this.value = String(value);
  }

  get nodeValue() {
    return this.value;
  }

  set nodeValue(next: string) {
    this.value = String(next);
  }

  override get textContent() {
    return this.value;
  }

  override set textContent(next: string) {
    this.value = String(next);
  }
}

class TestComment extends TestNode {
  data: string;

  constructor(data: string, ownerDocument: TestDocument) {
    super(8, "#comment", ownerDocument);
    this.data = String(data);
  }

  get nodeValue() {
    return this.data;
  }

  set nodeValue(next: string) {
    this.data = String(next);
  }

  override get textContent() {
    return "";
  }
}

type EventHandler = (event: TestEvent) => void;

class TestElement extends TestNode {
  tagName: string;
  attributes = new Map<string, string>();
  listeners = new Map<string, Set<EventHandler>>();
  dataset: Record<string, string> = {};
  style = {
    display: "",
    transform: "",
    transformOrigin: "",
    opacity: "",
    visibility: "",
    removeAttribute() {},
    removeProperty() {},
    setProperty() {},
    getPropertyValue() {
      return "";
    },
  };
  get offsetParent() {
    return this.parentNode;
  }
  get nextElementSibling(): TestElement | null {
    let sibling = this.nextSibling;
    while (sibling && !(sibling instanceof TestElement)) {
      sibling = sibling.nextSibling;
    }
    return sibling;
  }
  getBoundingClientRect() {
    return { width: 100, height: 40, top: 0, left: 0, right: 100, bottom: 40 };
  }
  classList = {
    toggle() {},
    add() {},
    remove() {},
  };
  type = "";
  name = "";
  private isChecked = false;
  private isDisabled = false;
  private currentValue = "";

  constructor(tagName: string, ownerDocument: TestDocument) {
    super(1, tagName.toUpperCase(), ownerDocument);
    this.tagName = this.nodeName;
  }

  get checked() {
    return this.isChecked;
  }

  set checked(value: boolean) {
    this.isChecked = Boolean(value);
  }

  get disabled() {
    return this.isDisabled;
  }

  set disabled(value: boolean) {
    this.isDisabled = Boolean(value);
    if (this.isDisabled) {
      this.attributes.set("disabled", "");
    } else {
      this.attributes.delete("disabled");
    }
  }

  get value() {
    return this.currentValue;
  }

  set value(next: string) {
    this.currentValue = String(next);
  }

  getAttributeNames() {
    return [...this.attributes.keys()];
  }

  get children(): TestElement[] {
    return this.childNodes.filter(
      (child): child is TestElement => child instanceof TestElement,
    );
  }

  setAttribute(key: string, value: string) {
    const normalized = String(value);
    this.attributes.set(key, normalized);
    if (key === "disabled") this.isDisabled = true;
    if (key === "type") this.type = normalized;
    if (key === "name") this.name = normalized;
  }

  getAttribute(key: string) {
    return this.attributes.get(key) ?? null;
  }

  hasAttribute(key: string) {
    return this.attributes.has(key);
  }

  removeAttribute(key: string) {
    this.attributes.delete(key);
    if (key === "disabled") this.isDisabled = false;
  }

  addEventListener(type: string, handler: EventHandler) {
    const bucket = this.listeners.get(type) ?? new Set<EventHandler>();
    bucket.add(handler);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: string, handler: EventHandler) {
    this.listeners.get(type)?.delete(handler);
  }

  dispatchEvent(event: TestEvent) {
    event.target = event.target ?? this;
    let current: TestNode | null = this;
    while (current) {
      event.currentTarget = current;
      if (current instanceof TestElement) {
        const handlers = current.listeners.get(event.type);
        if (handlers) {
          for (const handler of [...handlers]) {
            handler.call(current, event);
          }
        }
      }
      current = event.bubbles ? current.parentNode : null;
    }
    return !event.defaultPrevented;
  }

  click() {
    if (this.isDisabled) return;
    if (this.tagName === "INPUT" && this.type === "radio") {
      this.isChecked = true;
    }
    this.dispatchEvent(
      new TestEvent("click", { bubbles: true, cancelable: true }),
    );
  }

  querySelectorAll(selector: string): TestElement[] {
    const matches: TestElement[] = [];
    const visit = (node: TestNode) => {
      for (const child of node.childNodes) {
        if (child instanceof TestElement) {
          if (matchesSelector(child, selector)) {
            matches.push(child);
          }
          visit(child);
        }
      }
    };
    visit(this);
    return matches;
  }

  querySelector(selector: string): TestElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

class TestIFrameElement extends TestElement {}

function matchesSelector(element: TestElement, selector: string): boolean {
  const attrMatch = selector.match(/^\[([^=\]]+)="([^"]*)"\]$/);
  if (attrMatch) {
    return element.getAttribute(attrMatch[1]) === attrMatch[2];
  }
  return element.tagName.toLowerCase() === selector.toLowerCase();
}

interface TestDocument {
  nodeType: number;
  documentElement: TestElement;
  body: TestElement;
  activeElement: TestElement | null;
  defaultView: unknown;
  createElement: (tag: string) => TestElement;
  createElementNS: (_ns: string, tag: string) => TestElement;
  createTextNode: (text: string) => TestText;
  createComment: (data: string) => TestComment;
  addEventListener: () => void;
  removeEventListener: () => void;
}

function installDom() {
  const doc: TestDocument = {
    nodeType: 9,
    documentElement: null as unknown as TestElement,
    body: null as unknown as TestElement,
    activeElement: null,
    defaultView: null,
    createElement: (tag) => new TestElement(tag, doc),
    createElementNS: (_ns, tag) => new TestElement(tag, doc),
    createTextNode: (text) => new TestText(text, doc),
    createComment: (data) => new TestComment(data, doc),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  doc.documentElement = new TestElement("html", doc);
  doc.body = new TestElement("body", doc);
  doc.documentElement.appendChild(doc.body);

  const getComputedStyle = () => ({
    transform: "none",
    transformOrigin: "50% 50%",
    getPropertyValue: () => "",
  });

  const win = {
    document: doc,
    scrollTo: vi.fn(),
    addEventListener: () => {},
    removeEventListener: () => {},
    getComputedStyle,
    HTMLElement: TestElement,
    HTMLIFrameElement: TestIFrameElement,
    Element: TestElement,
    Node: TestNode,
    Text: TestText,
    Event: TestEvent,
  };
  doc.defaultView = win;

  const globals = globalThis as Record<string, unknown>;
  const keys = [
    "IS_REACT_ACT_ENVIRONMENT",
    "window",
    "document",
    "getComputedStyle",
    "HTMLElement",
    "HTMLIFrameElement",
    "Element",
    "Node",
    "Text",
    "Event",
  ] as const;
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const key of keys) {
    previous.set(key, Object.getOwnPropertyDescriptor(globals, key));
  }

  Object.assign(globals, {
    IS_REACT_ACT_ENVIRONMENT: true,
    window: win,
    document: doc,
    getComputedStyle,
    HTMLElement: TestElement,
    HTMLIFrameElement: TestIFrameElement,
    Element: TestElement,
    Node: TestNode,
    Text: TestText,
    Event: TestEvent,
  });

  const container = doc.createElement("div");
  doc.body.appendChild(container);
  const root = createRoot(container as unknown as HTMLElement);

  return {
    container,
    root,
    win,
    cleanup() {
      for (const key of keys) {
        const descriptor = previous.get(key);
        if (descriptor) {
          Object.defineProperty(globals, key, descriptor);
        } else {
          delete globals[key];
        }
      }
    },
  };
}

function getChoiceInput(
  container: TestElement,
  questionNumber: number,
  choiceNumber: number,
): TestElement {
  const label = container.querySelector(
    `[data-ocid="reading_detail.choice.radio.${questionNumber}.${choiceNumber}"]`,
  );
  const input = label?.querySelector("input");
  if (!input) {
    throw new Error(
      `Missing radio input for question ${questionNumber}, choice ${choiceNumber}`,
    );
  }
  return input;
}

describe("ReadingDetailPage", () => {
  let dom: ReturnType<typeof installDom>;
  let root: Root;
  let queryClient: QueryClient;

  const renderPage = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ReadingDetailPage />
        </QueryClientProvider>,
      );
    });
  };

  beforeEach(() => {
    routeState.passageId = "reading-01";
    recordReadingAttempt.mockReset();
    recordReadingAttempt.mockResolvedValue(undefined);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    dom = installDom();
    root = dom.root;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
    dom.cleanup();
  });

  it("resets answers, submitted result panel, and mutation state when switching passages without unmounting", async () => {
    await renderPage();

    const submitBefore = dom.container.querySelector(
      '[data-ocid="reading_detail.submit_button"]',
    );
    expect(submitBefore?.disabled).toBe(true);
    expect(dom.container.textContent).toContain(
      "Đã trả lời 0/1 câu — hãy trả lời hết để nộp bài.",
    );

    await act(async () => {
      getChoiceInput(dom.container, 1, 1).click();
    });
    await act(async () => {
      dom.container
        .querySelector('[data-ocid="reading_detail.submit_button"]')
        ?.click();
    });

    expect(
      dom.container.querySelector(
        '[data-ocid="reading_detail.result.success_state"]',
      ),
    ).not.toBeNull();
    expect(dom.container.textContent).toContain("Đã lưu vào tiến độ.");
    expect(recordReadingAttempt).toHaveBeenCalledWith(
      { owner: "guest", level: "n4" },
      { passageId: "reading-01", score: 1, total: 1 },
    );

    // Expand study aid on reading-01 to verify its state does not leak either.
    await act(async () => {
      dom.container
        .querySelector('[data-ocid="reading_detail.translation.toggle"]')
        ?.click();
    });
    expect(
      dom.container.querySelector(
        '[data-ocid="reading_detail.translation.panel"]',
      ),
    ).not.toBeNull();

    // Switch directly to reading-02 while keeping ReadingDetailPage mounted.
    routeState.passageId = "reading-02";
    await renderPage();

    expect(dom.container.textContent).toContain("Bài đọc số 2");
    expect(
      dom.container.querySelector(
        '[data-ocid="reading_detail.result.success_state"]',
      ),
    ).toBeNull();
    expect(dom.container.textContent).not.toContain("Đã lưu vào tiến độ.");
    expect(dom.container.textContent).toContain(
      "Đã trả lời 0/2 câu — hãy trả lời hết để nộp bài.",
    );

    const submitOnTwo = dom.container.querySelector(
      '[data-ocid="reading_detail.submit_button"]',
    );
    expect(submitOnTwo).not.toBeNull();
    expect(submitOnTwo?.disabled).toBe(true);

    const radios = dom.container.querySelectorAll("input");
    expect(radios).toHaveLength(4);
    for (const radio of radios) {
      expect(radio.checked).toBe(false);
      expect(radio.disabled).toBe(false);
    }

    // Completing and submitting reading-02 records reading-02 cleanly and starts StudyAids collapsed.
    await act(async () => {
      getChoiceInput(dom.container, 1, 2).click();
      getChoiceInput(dom.container, 2, 1).click();
    });
    await act(async () => {
      dom.container
        .querySelector('[data-ocid="reading_detail.submit_button"]')
        ?.click();
    });

    expect(recordReadingAttempt).toHaveBeenLastCalledWith(
      { owner: "guest", level: "n4" },
      { passageId: "reading-02", score: 1, total: 2 },
    );
    expect(
      dom.container.querySelector(
        '[data-ocid="reading_detail.result.success_state"]',
      )?.textContent,
    ).toContain("1/2");
    expect(
      dom.container.querySelector(
        '[data-ocid="reading_detail.translation.panel"]',
      ),
    ).toBeNull();
  });

  it("isolates an in-flight mutation from the previous passage after switching", async () => {
    const firstAttempt = Promise.withResolvers<void>();
    recordReadingAttempt.mockReturnValueOnce(firstAttempt.promise);

    await renderPage();

    await act(async () => {
      getChoiceInput(dom.container, 1, 1).click();
    });
    await act(async () => {
      dom.container
        .querySelector('[data-ocid="reading_detail.submit_button"]')
        ?.click();
    });

    expect(dom.container.textContent).toContain("Đang lưu…");

    routeState.passageId = "reading-02";
    await renderPage();

    await act(async () => {
      firstAttempt.reject(new Error("late failure"));
      await Promise.resolve();
    });

    expect(
      dom.container.querySelector(
        '[data-ocid="reading_detail.result.success_state"]',
      ),
    ).toBeNull();
    expect(dom.container.textContent).not.toContain("Đang lưu…");
    expect(dom.container.textContent).not.toContain("Chưa lưu được kết quả.");
    expect(dom.container.textContent).toContain(
      "Đã trả lời 0/2 câu — hãy trả lời hết để nộp bài.",
    );
  });

  it("renders the empty state when the passage does not exist", async () => {
    routeState.passageId = "missing-passage";
    await renderPage();

    expect(
      dom.container.querySelector('[data-ocid="reading_detail.empty_state"]'),
    ).not.toBeNull();
    expect(dom.container.textContent).toContain("Không tìm thấy bài đọc");
  });
});
