import "fake-indexeddb/auto";
import { db } from "@/adapters/local-store/db";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface FakeDomHarness {
  classes: Set<string>;
  storage: Map<string, string>;
  setOsDark: (dark: boolean) => void;
  dispatchStorage: (key: string, newValue: string | null) => void;
  renderHook: () => Promise<{
    getResult: () => {
      preference: string;
      resolved: string;
      setPreference: (next: "light" | "dark" | "system") => void;
    };
    unmount: () => Promise<void>;
  }>;
  cleanup: () => void;
}

function createFakeDom(initialOsDark = false): FakeDomHarness {
  let osDark = initialOsDark;
  const classes = new Set<string>();
  const storage = new Map<string, string>();
  const mediaListeners = new Set<(event: MediaQueryListEvent) => void>();
  const windowListeners = new Map<string, Set<(event: StorageEvent) => void>>();

  class MiniNode {
    nodeType: number;
    nodeName: string;
    ownerDocument: unknown;
    parentNode: MiniNode | null = null;
    childNodes: MiniNode[] = [];

    constructor(nodeType: number, nodeName: string, doc: unknown) {
      this.nodeType = nodeType;
      this.nodeName = nodeName;
      this.ownerDocument = doc;
    }

    appendChild(child: MiniNode) {
      return this.insertBefore(child, null);
    }

    insertBefore(child: MiniNode, ref: MiniNode | null) {
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = this;
      const idx = ref ? this.childNodes.indexOf(ref) : -1;
      if (idx >= 0) this.childNodes.splice(idx, 0, child);
      else this.childNodes.push(child);
      return child;
    }

    removeChild(child: MiniNode) {
      const idx = this.childNodes.indexOf(child);
      if (idx >= 0) {
        this.childNodes.splice(idx, 1);
        child.parentNode = null;
      }
      return child;
    }

    set textContent(value: string) {
      this.childNodes = value
        ? [new MiniNode(3, "#text", this.ownerDocument)]
        : [];
    }
  }

  class MiniElement extends MiniNode {
    tagName: string;
    style = { setProperty() {}, removeProperty() {} };
    constructor(tagName: string, doc: unknown) {
      super(1, tagName.toUpperCase(), doc);
      this.tagName = this.nodeName;
    }
    setAttribute() {}
    removeAttribute() {}
    addEventListener() {}
    removeEventListener() {}
  }

  class MiniIFrameElement extends MiniElement {}

  const classList = {
    add: (name: string) => classes.add(name),
    remove: (name: string) => classes.delete(name),
    contains: (name: string) => classes.has(name),
    toggle: (name: string, force?: boolean) => {
      const next = force === undefined ? !classes.has(name) : force;
      if (next) classes.add(name);
      else classes.delete(name);
      return next;
    },
  };

  const doc = {
    nodeType: 9,
    documentElement: Object.assign(new MiniElement("html", null), {
      classList,
    }),
    body: null as unknown as MiniElement,
    activeElement: null as MiniElement | null,
    defaultView: null as unknown,
    createElement: (tag: string) => new MiniElement(tag, doc),
    createElementNS: (_ns: string, tag: string) => new MiniElement(tag, doc),
    createTextNode: () => new MiniNode(3, "#text", doc),
    createComment: () => new MiniNode(8, "#comment", doc),
    addEventListener() {},
    removeEventListener() {},
  };
  doc.documentElement.ownerDocument = doc;
  doc.body = new MiniElement("body", doc);
  doc.documentElement.appendChild(doc.body);

  const win = {
    document: doc,
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, String(value));
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    },
    matchMedia: (query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? osDark : false,
      media: query,
      addEventListener: (
        _type: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        mediaListeners.add(listener);
      },
      removeEventListener: (
        _type: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        mediaListeners.delete(listener);
      },
    }),
    addEventListener: (
      type: string,
      listener: (event: StorageEvent) => void,
    ) => {
      const bucket = windowListeners.get(type) ?? new Set();
      bucket.add(listener);
      windowListeners.set(type, bucket);
    },
    removeEventListener: (
      type: string,
      listener: (event: StorageEvent) => void,
    ) => {
      windowListeners.get(type)?.delete(listener);
    },
    HTMLElement: MiniElement,
    HTMLIFrameElement: MiniIFrameElement,
    Element: MiniElement,
    Node: MiniNode,
  };
  doc.defaultView = win;

  const globals = globalThis as Record<string, unknown>;
  const keys = [
    "IS_REACT_ACT_ENVIRONMENT",
    "window",
    "document",
    "HTMLElement",
    "HTMLIFrameElement",
    "Element",
    "Node",
  ] as const;
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const key of keys) {
    previous.set(key, Object.getOwnPropertyDescriptor(globals, key));
  }
  Object.assign(globals, {
    IS_REACT_ACT_ENVIRONMENT: true,
    window: win,
    document: doc,
    HTMLElement: MiniElement,
    HTMLIFrameElement: MiniIFrameElement,
    Element: MiniElement,
    Node: MiniNode,
  });

  return {
    classes,
    storage,
    setOsDark(dark: boolean) {
      osDark = dark;
      for (const listener of [...mediaListeners]) {
        listener({
          matches: dark,
          media: "(prefers-color-scheme: dark)",
        } as MediaQueryListEvent);
      }
    },
    dispatchStorage(key: string, newValue: string | null) {
      for (const listener of [...(windowListeners.get("storage") ?? [])]) {
        listener({ key, newValue } as StorageEvent);
      }
    },
    async renderHook() {
      const { useThemePreference } = await import("./useThemePreference");
      let latest!: ReturnType<typeof useThemePreference>;
      function Probe() {
        latest = useThemePreference();
        return createElement("span", null, latest.preference);
      }
      const container = doc.createElement("div");
      doc.body.appendChild(container);
      const root = createRoot(container as unknown as HTMLElement);
      await act(async () => {
        root.render(createElement(Probe));
      });
      return {
        getResult: () => latest,
        async unmount() {
          await act(async () => {
            root.unmount();
          });
        },
      };
    },
    cleanup() {
      for (const key of keys) {
        const desc = previous.get(key);
        if (desc) Object.defineProperty(globals, key, desc);
        else delete globals[key];
      }
    },
  };
}

describe("useThemePreference", () => {
  let harness: FakeDomHarness;

  beforeEach(async () => {
    vi.resetModules();
    await db.open();
    harness = createFakeDom(false);
  });

  afterEach(async () => {
    const { db: activeDb } = await import("@/adapters/local-store/db");
    activeDb.close();
    db.close();
    harness.cleanup();
    await db.delete();
  });

  it("resolves system preference via matchMedia and toggles html.dark class", async () => {
    harness.cleanup();
    harness = createFakeDom(true);

    const mounted = await harness.renderHook();
    expect(mounted.getResult().preference).toBe("system");
    expect(mounted.getResult().resolved).toBe("dark");
    expect(harness.classes.has("dark")).toBe(true);

    await act(async () => {
      mounted.getResult().setPreference("light");
    });

    expect(mounted.getResult().preference).toBe("light");
    expect(mounted.getResult().resolved).toBe("light");
    expect(harness.classes.has("dark")).toBe(false);
    expect(harness.storage.get("luyen-jlpt:theme")).toBe("light");

    await mounted.unmount();
  });

  it("persists selection to localStorage and db.settings and ignores OS changes when pinned", async () => {
    const mounted = await harness.renderHook();
    expect(mounted.getResult().resolved).toBe("light");

    await act(async () => {
      mounted.getResult().setPreference("dark");
    });
    await vi.waitFor(async () => {
      const row = await db.settings.get("themePreference");
      expect(row?.value).toBe("dark");
    });

    expect(harness.storage.get("luyen-jlpt:theme")).toBe("dark");
    expect(harness.classes.has("dark")).toBe(true);

    await act(async () => {
      harness.setOsDark(false);
    });
    expect(mounted.getResult().resolved).toBe("dark");
    expect(harness.classes.has("dark")).toBe(true);

    await act(async () => {
      mounted.getResult().setPreference("system");
    });
    expect(mounted.getResult().resolved).toBe("light");
    expect(harness.classes.has("dark")).toBe(false);

    await act(async () => {
      harness.setOsDark(true);
    });
    expect(mounted.getResult().resolved).toBe("dark");
    expect(harness.classes.has("dark")).toBe(true);

    await mounted.unmount();
  });

  it("restores saved preference from db.settings when localStorage is empty and normalizes invalid values", async () => {
    await db.settings.put({ key: "themePreference", value: "dark" });
    harness.storage.set("luyen-jlpt:theme", "bogus");

    const { parseThemePreference } = await import("./useThemePreference");
    expect(parseThemePreference("bogus")).toBe("system");
    expect(parseThemePreference("dark")).toBe("dark");

    harness.storage.delete("luyen-jlpt:theme");
    const mounted = await harness.renderHook();
    await act(async () => {
      await vi.waitFor(() => {
        expect(mounted.getResult().preference).toBe("dark");
      });
    });
    expect(mounted.getResult().resolved).toBe("dark");
    expect(harness.classes.has("dark")).toBe(true);
    expect(harness.storage.get("luyen-jlpt:theme")).toBe("dark");

    await act(async () => {
      harness.dispatchStorage("luyen-jlpt:theme", "light");
    });
    expect(mounted.getResult().preference).toBe("light");
    expect(mounted.getResult().resolved).toBe("light");
    expect(harness.classes.has("dark")).toBe(false);

    await mounted.unmount();
  });
});
