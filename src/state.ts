import { Client } from "@synonymdev/pubky";
import { createStore } from "solid-js/store";

export const client =
  import.meta.env.VITE_TESTNET == "true" ? Client.testnet() : new Client();

export type ListItem = { link: string; name: string; isDirectory: boolean };

export const [store, setStore] = createStore<{
  explorer: boolean;
  dir: string;
  loading: boolean;
  shallow: boolean;
  list: Array<ListItem>;
  error: string | null;
}>({
  explorer: false,
  dir: "",
  loading: false,
  shallow: true,
  list: [],
  error: null,
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

      setStore("list", Array.from(map.values()));
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

export function updateDir(inputPath: string) {
  const path = normalizePath(inputPath);

  // push to URL for deep-linking
  const encoded = encodeURIComponent(path);
  const currentHash = new URL(window.location.href).hash;
  const nextHash = `#p=${encoded}`;
  if (currentHash !== nextHash) {
    history.pushState({ p: path }, "", nextHash);
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

// --- helpers ---

function normalizePath(raw: string): string {
  let path = (raw || "").trim();

  // strip accepted prefixes
  path = path.replace(/^pubky:\/\/?/i, "").replace(/^pk:/i, "");

  // drop protocol/host if a full URL sneaks in
  try {
    if (/^[a-z]+:\/\//i.test(path)) {
      const u = new URL(path);
      path = (u.host + u.pathname).replace(/^\/+/, "");
    }
  } catch {
    /* ignore */
  }

  // split and resolve ., ..
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
  path = stack.join("/");

  // Homeserver doesn't support reading root; 52-char key ⇒ append /pub/
  if (path.length === 52) path = path + "/pub/";
  if (!path.endsWith("/")) path = path + "/";
  return path;
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
