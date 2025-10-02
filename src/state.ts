import { Client } from "@synonymdev/pubky";
import { createStore } from "solid-js/store";

export const client =
  import.meta.env.VITE_TESTNET == "true" ? Client.testnet() : new Client();

export type ListItem = { link: string; name: string; isDirectory: boolean };

type PreviewState = {
  open: boolean;
  link: string;
  name: string;
  kind: "image" | "text" | "other";
  mime: string;
  url: string | null;
  text: string | null;
  loading: boolean;
  error: string | null;
};

type CacheEntry = {
  list: Array<ListItem>;
  scroll: number;
  ts: number;
  shallow: boolean;
  sortOrder: "asc" | "desc";
};

const CACHE_NS = "pkx-cache-v1";
const CACHE_MAX = 40;

export const [store, setStore] = createStore<{
  explorer: boolean;
  dir: string;
  loading: boolean;
  shallow: boolean;
  list: Array<ListItem>;
  error: string | null;
  sortOrder: "asc" | "desc";
  dirsFirst: boolean;
  preview: PreviewState;
  toasts: Array<{ text: string; kind: "ok" | "err" }>;
}>({
  explorer: false,
  dir: "",
  loading: false,
  shallow: true,
  list: [],
  error: null,
  sortOrder: "asc",
  dirsFirst: true,
  preview: {
    open: false,
    link: "",
    name: "",
    kind: "other",
    mime: "",
    url: null,
    text: null,
    loading: false,
    error: null,
  },
  toasts: [],
});

// request guard
let currentRequestId = 0;
let isFetching = false;

// prefetch guard
const prefetchInFlight = new Set<string>();

export function resetStore() {
  setStore("dir", "");
  setStore("loading", false);
  setStore("list", []);
  setStore("explorer", false);
  setStore("error", null);
}

export function setSort(order: "asc" | "desc") {
  setStore("sortOrder", order);
  if (store.list.length) setStore("list", sortItems([...store.list]));
}

export function toggleDirsFirst() {
  setStore("dirsFirst", !store.dirsFirst);
  if (store.list.length) setStore("list", sortItems([...store.list]));
}

export function loadList() {
  setStore("list", []);
  loadMore();
}

export function switchShallow() {
  setStore("shallow", !store.shallow);
  if (store.dir.length > 0) {
    loadList();
  }
}

export function loadMore() {
  if (isFetching) return; // dedupe
  const cursor =
    store.list.length > 0 ? store.list[store.list.length - 1].link : "";
  const path = store.dir;

  setStore("loading", true);
  setStore("error", null);

  const limit = Math.ceil(window.innerHeight / 40);

  const reqId = ++currentRequestId;
  isFetching = true;

  client
    .list(`pubky://${path}`, cursor || "", false, limit, store.shallow)
    .then((l: Array<string>) => {
      if (reqId !== currentRequestId) return; // stale; ignore
      const list = l.map((link) => {
        let name = link.replace("pubky://", "").replace(store.dir, "");
        let isDirectory = name.endsWith("/");
        return { link, isDirectory, name };
      });

      let map = new Map<string, ListItem>();
      for (let item of store.list) map.set(item.name, item);
      for (let item of list) map.set(item.name, item);

      const merged = Array.from(map.values());
      setStore("list", sortItems(merged));
      setStore("dir", path);

      // cache updated list and current scroll
      cachePut(path, {
        list: merged,
        scroll: window.scrollY,
      });
    })
    .catch((e: any) => {
      if (reqId !== currentRequestId) return; // stale; ignore
      const msg = normalizeError(e);
      setStore("error", msg);
    })
    .finally(() => {
      if (reqId === currentRequestId) {
        setStore("loading", false);
        isFetching = false;
      }
    });
}

/**
 * Navigate to a directory. URL handling can be:
 *  - 'push'   → pushState (default)
 *  - 'replace'→ replaceState
 *  - 'none'   → do not modify URL
 * Session cache restore + background revalidate if cached.
 */
export function updateDir(
  inputPath: string,
  urlMode: "push" | "replace" | "none" = "push",
) {
  const prev = store.dir;
  if (prev) cacheSaveScrollFor(prev, window.scrollY);

  const path = normalizeDir(inputPath);

  if (urlMode !== "none") {
    const encoded = encodeURIComponent(path);
    const nextHash = `#p=${encoded}`;
    const currentHash = new URL(window.location.href).hash;
    if (urlMode === "push") {
      if (currentHash !== nextHash)
        history.pushState({ p: path }, "", nextHash);
    } else {
      history.replaceState({ p: path }, "", nextHash);
    }
  }

  setStore("dir", path);
  setStore("error", null);

  // bump request id to invalidate in-flight promises
  currentRequestId++;
  isFetching = false;

  // try cache restore
  const cached = cacheGet(path);
  if (cached) {
    setStore("list", sortItems(cached.list));
    setStore("explorer", true);
    // instant scroll restore
    requestAnimationFrame(() => window.scrollTo(0, cached.scroll || 0));
    // background revalidate first page
    backgroundRevalidate(path);
  } else {
    setStore("list", []);
    loadMore();
  }
}

export async function downloadFile(link: string) {
  setStore("loading", true);
  try {
    const response: Response = await client.fetch(link);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch file: ${response.status} ${response.statusText}`,
      );
    }
    const fileBlob: Blob = await response.blob();
    const element = document.createElement("a");
    element.href = URL.createObjectURL(fileBlob);
    const parts = link.split("/");
    element.download = parts[parts.length - 1];
    document.body.appendChild(element);
    element.click();
    element.remove();
  } catch (err: unknown) {
    setStore(
      "error",
      err instanceof Error ? err.message : "Failed to fetch file",
    );
  } finally {
    setStore("loading", false);
  }
}

/** Open preview and reflect file selection in the URL unless disabled. */
export async function openPreview(
  link: string,
  name: string,
  opts?: { updateUrl?: boolean },
) {
  const shouldUpdateUrl = opts?.updateUrl !== false;

  // reflect file selection in hash as #p=<dir><file> (no trailing slash)
  if (shouldUpdateUrl) {
    const filePath = (store.dir + name).replace(/\/+$/, "");
    const nextHash = `#p=${encodeURIComponent(filePath)}`;
    const currentHash = new URL(window.location.href).hash;
    if (currentHash !== nextHash) {
      history.pushState({ p: filePath, preview: true }, "", nextHash);
    }
  }

  // reset previous object URL
  if (store.preview.url) {
    try {
      URL.revokeObjectURL(store.preview.url);
    } catch {}
  }

  setStore("preview", {
    open: true,
    link,
    name,
    kind: "other",
    mime: "",
    url: null,
    text: null,
    loading: true,
    error: null,
  });

  try {
    const res = await client.fetch(link);
    if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
    const mime = (res.headers.get("content-type") || "").toLowerCase();

    // 1) Images by header
    if (mime.startsWith("image/")) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setStore("preview", {
        kind: "image",
        mime,
        url,
        text: null,
        loading: false,
      } as any);
      return;
    }

    // 2) Text by header
    if (
      mime.startsWith("text/") ||
      mime.includes("application/json") ||
      mime.includes("application/xml")
    ) {
      const text = await res.text();
      setStore("preview", {
        kind: "text",
        mime,
        text,
        url: null,
        loading: false,
      } as any);
      return;
    }

    // 3) Try JSON.parse for mislabeled octet-stream
    if (
      mime === "application/octet-stream" ||
      mime === "binary/octet-stream" ||
      mime === ""
    ) {
      const blob = await res.blob();
      const text = await blob.text();
      const trimmed = text.replace(/^\uFEFF/, "").trim();
      try {
        const parsed = JSON.parse(trimmed);
        setStore("preview", {
          kind: "text",
          mime: "application/json",
          text: JSON.stringify(parsed, null, 2),
          url: null,
          loading: false,
        } as any);
        return;
      } catch {
        // not JSON -> fall through to unknown/binary
      }
    }

    setStore("preview", { kind: "other", mime, loading: false } as any);
  } catch (e: any) {
    setStore("preview", {
      error: e?.message || "Preview failed",
      loading: false,
    } as any);
  }
}

export function closePreview() {
  if (store.preview.url) {
    try {
      URL.revokeObjectURL(store.preview.url);
    } catch {}
  }
  setStore("preview", {
    open: false,
    link: "",
    name: "",
    kind: "other",
    mime: "",
    url: null,
    text: null,
    loading: false,
    error: null,
  });

  const dirHash = `#p=${encodeURIComponent(store.dir)}`;
  const currentHash = new URL(window.location.href).hash;
  if (currentHash !== dirHash) {
    history.pushState({ p: store.dir }, "", dirHash);
  }
}

/** Prefetch first page for a directory path (intent-based). */
export function prefetchDir(dirPath: string) {
  const dir = normalizeDir(dirPath);
  const key = cacheKey(dir);
  if (cacheGet(dir)) return; // already cached
  if (prefetchInFlight.has(key)) return;

  prefetchInFlight.add(key);

  const limit = Math.ceil(window.innerHeight / 40);
  client
    .list(`pubky://${dir}`, "", false, limit, store.shallow)
    .then((l: Array<string>) => {
      const list = l.map((link) => {
        const name = link.replace("pubky://", "").replace(dir, "");
        const isDirectory = name.endsWith("/");
        return { link, isDirectory, name };
      });
      cachePut(dir, { list, scroll: 0 });
    })
    .finally(() => prefetchInFlight.delete(key));
}

/** Save current scroll for active directory into session cache. */
export function cacheSaveScroll(scroll: number = window.scrollY) {
  if (!store.dir) return;
  cacheSaveScrollFor(store.dir, scroll);
}

// --- helpers: cache, sort, normalize, revalidate ---

function backgroundRevalidate(path: string) {
  const limit = Math.ceil(window.innerHeight / 40);
  const reqId = ++currentRequestId;
  isFetching = true;
  setStore("loading", true);

  client
    .list(`pubky://${path}`, "", false, limit, store.shallow)
    .then((l: Array<string>) => {
      if (reqId !== currentRequestId) return;
      const head = l.map((link) => {
        let name = link.replace("pubky://", "").replace(path, "");
        let isDirectory = name.endsWith("/");
        return { link, isDirectory, name };
      });

      // merge head with existing list
      const map = new Map<string, ListItem>();
      for (const it of store.list) map.set(it.name, it);
      for (const it of head) map.set(it.name, it);
      const merged = Array.from(map.values());
      setStore("list", sortItems(merged));

      cachePut(path, { list: merged, scroll: window.scrollY });
    })
    .catch(() => {})
    .finally(() => {
      if (reqId === currentRequestId) {
        setStore("loading", false);
        isFetching = false;
      }
    });
}

function sortItems(items: ListItem[]): ListItem[] {
  const mult = store.sortOrder === "asc" ? 1 : -1;
  return items.sort((a, b) => {
    if (store.dirsFirst && a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    return a.name.localeCompare(b.name) * mult;
  });
}

/** Normalize a directory path (always ends with '/'). */
function normalizeDir(raw: string): string {
  let path = stripPrefixesAndResolve(raw);
  if (path.length === 52) path = path + "/pub/";
  if (!path.endsWith("/")) path = path + "/";
  return path;
}

/** Strip pubky:// or pk: and resolve ., .. and any accidental protocol/host. */
function stripPrefixesAndResolve(raw: string): string {
  let path = (raw || "").trim();
  path = path.replace(/^pubky:\/\/?/i, "").replace(/^pk:/i, "");
  try {
    if (/^[a-z]+:\/\//i.test(path)) {
      const u = new URL(path);
      path = (u.host + u.pathname).replace(/^\/+/, "");
    }
  } catch {}
  const parts = path.split("/").filter((x) => x.length > 0);
  const stack: string[] = [];
  for (const seg of parts) {
    if (seg === ".") continue;
    if (seg === "..") {
      if (stack.length > 0) stack.pop();
      continue;
    }
    stack.push(seg);
  }
  return stack.join("/");
}

function normalizeError(e: any): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") {
    if (e.toLowerCase().includes("error sending request"))
      return "Network error or PK not found";
    return e;
  }
  const msg = e.message || "Unknown error";
  if (/abort/i.test(msg)) return "Request canceled";
  if (/404/.test(msg)) return "Not found";
  if (/403/.test(msg)) return "Forbidden";
  if (/timeout/i.test(msg)) return "Request timeout";
  return msg;
}

// --- sessionStorage LRU ---

function cacheKey(dir: string): string {
  return `${dir}|sh=${store.shallow ? 1 : 0}|so=${store.sortOrder}`;
}

function loadCacheStore(): {
  entries: Record<string, CacheEntry>;
  order: string[];
} | null {
  try {
    const raw = sessionStorage.getItem(CACHE_NS);
    if (!raw) return { entries: {}, order: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object")
      return { entries: {}, order: [] };
    return {
      entries: parsed.entries || {},
      order: parsed.order || [],
    };
  } catch {
    return { entries: {}, order: [] };
  }
}

function saveCacheStore(data: {
  entries: Record<string, CacheEntry>;
  order: string[];
}) {
  try {
    sessionStorage.setItem(CACHE_NS, JSON.stringify(data));
  } catch {}
}

function cacheGet(dir: string): CacheEntry | null {
  const key = cacheKey(dir);
  const data = loadCacheStore();
  if (!data) return null;
  const entry = data.entries[key];
  if (!entry) return null;
  // bump LRU
  data.order = [key, ...data.order.filter((k) => k !== key)].slice(
    0,
    CACHE_MAX,
  );
  saveCacheStore(data);
  return entry;
}

function cachePut(dir: string, partial: Partial<CacheEntry>) {
  const key = cacheKey(dir);
  const data = loadCacheStore()!;
  const prev = data.entries[key] || {
    list: [],
    scroll: 0,
    ts: 0,
    shallow: store.shallow,
    sortOrder: store.sortOrder,
  };
  const next: CacheEntry = {
    ...prev,
    ...partial,
    ts: Date.now(),
    shallow: store.shallow,
    sortOrder: store.sortOrder,
  };
  data.entries[key] = next;
  data.order = [key, ...data.order.filter((k) => k !== key)];
  if (data.order.length > CACHE_MAX) {
    for (let i = CACHE_MAX; i < data.order.length; i++) {
      const k = data.order[i];
      delete data.entries[k];
    }
    data.order.length = CACHE_MAX;
  }
  saveCacheStore(data);
}

function cacheSaveScrollFor(dir: string, scroll: number) {
  if (!dir) return;
  cachePut(dir, { scroll });
}
