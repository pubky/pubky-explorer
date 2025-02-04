import { Client } from '@synonymdev/pubky'
import { createStore } from 'solid-js/store';

export const client = import.meta.env.VITE_TESTNET == "true" ?
  Client.testnet() :
  new Client();

export const [store, setStore] = createStore<{
  explorer: Boolean,
  dir: string,
  loading: boolean,
  shallow: boolean,
  list: Array<{ link: string, name: string, isDirectory: boolean }>
}>({
  explorer: false,
  dir: "",
  loading: false,
  shallow: true,
  list: []
})

export function resetStore() {
  setStore('dir', '')
  setStore('loading', false)
  setStore('list', [])
  setStore('explorer', false)
}

export function loadList() {
  setStore('list', [])
  loadMore()
}

export function switchShallow() {
  setStore('shallow', !store.shallow)
  if (store.dir.length > 0) {
    loadList()
  }
}

export function loadMore() {
  // @ts-ignore
  const cursor = (store.list.length > 0 && store.list[store.list.length - 1])['link']

  let path = store.dir

  setStore('loading', true)

  // ITEMS IN VIEW
  let limit = Math.ceil(window.innerHeight / 40);

  client.list(`pubky://${path}`, cursor || "", false, limit, store.shallow).then((l: Array<string>) => {
    const list = l.map(link => {
      let name = link.replace('pubky://', '').replace(store.dir, '');
      let isDirectory = name.endsWith('/');

      return {
        link,
        isDirectory,
        name
      }
    })

    setStore('loading', false)

    let map = new Map();

    for (let item of store.list) {
      map.set(item.name, item)
    }
    for (let item of list) {
      map.set(item.name, item)
    }

    // @ts-ignore
    setStore('list', Array.from(map.values()))
    setStore('dir', path)
  })
  .catch((e: String) => {
    setStore('loading', false)
    if (e === "error sending request") {
      console.log(e, ": cannot reach homeserver or pk does not exist")
    } else {
      console.log("ERROR: ", e);
    }
  });
}

export function updateDir(path: string) {
  path = path?.split('://')[1] || path

  let parts = path.split("/").filter(Boolean);

  // if (parts.length > 1 && !path.endsWith("/")) {
  //   parts = parts.slice(0, parts.length - 1)
  // }

  path = parts.join('/')

  // Homeserver doesn't support reading root.
  if (path.length == 52) {
    path = path + "/pub/"
  }

  if (!path.endsWith('/')) {
    path = path + '/'
  }

  setStore("dir", path)
  loadList()
}

export async function downloadFile(link: string) {
  setStore("loading", true);

  try {
    const response: Response = await client.fetch(link);

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }

    const fileBlob: Blob = await response.blob();

    const element = document.createElement('a');
    element.href = URL.createObjectURL(fileBlob);
    const parts = link.split('/');
    element.download = parts[parts.length - 1];

    document.body.appendChild(element);
    element.click();
    element.remove();
  } catch (err: unknown) {
    console.error("Error fetching file:", err);
  }
  finally {
    setStore("loading", false);
  }
}