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
});

// request guard
let currentRequestId = 0;
let isFetching = false;

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

  // visible rows rough estimate
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
 */
export function updateDir(
  inputPath: string,
  urlMode: "push" | "replace" | "none" = "push",
) {
  const path = normalizeDir(inputPath);

  if (urlMode !== "none") {
    const encoded = encodeURIComponent(path);
    const nextHash = `#p=${encoded}`;
    const currentHash = new URL(window.location.href).hash;
    if (urlMode === "push") {
      if (currentHash !== nextHash) history.pushState({ p: path }, "", nextHash);
    } else {
      history.replaceState({ p: path }, "", nextHash);
    }
  }

  setStore("dir", path);
  setStore("list", []);
  setStore("error", null);

  // bump request id to invalidate in-flight promises
  currentRequestId++;
  isFetching = false;

  loadList();
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
    console.error("Error fetching file:", err);
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
    } else if (
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
    } else {
      setStore("preview", { kind: "other", mime, loading: false } as any);
    }
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

  // restore hash to directory form (#p=<dir>/)
  const dirHash = `#p=${encodeURIComponent(store.dir)}`;
  const currentHash = new URL(window.location.href).hash;
  if (currentHash !== dirHash) {
    history.pushState({ p: store.dir }, "", dirHash);
  }
}

// --- helpers ---

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

  // Homeserver doesn't support reading root; 52-char key ⇒ append /pub/
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
