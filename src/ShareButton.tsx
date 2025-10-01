import { createSignal } from "solid-js";
import { store } from "./state";

type Props = {
  /** Optional explicit path to share (no scheme). If omitted, deduced from state. */
  path?: string;
  /** Button text, default "Share" */
  label?: string;
};

export function ShareButton(props: Props) {
  const [ok, setOk] = createSignal<null | "copied" | "error">(null);

  async function copy() {
    try {
      // Decide what to share:
      // - if props.path provided, use as-is
      // - else if preview open, share file path (no trailing slash)
      // - else share directory path (with trailing slash)
      const p =
        props.path ??
        (store.preview?.open
          ? (store.dir + store.preview.name).replace(/\/+$/, "")
          : store.dir);

      const u = new URL(window.location.href);
      u.hash = `#p=${encodeURIComponent(p)}`;

      const text = u.toString();

      if (navigator.clipboard && "writeText" in navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }

      setOk("copied");
      setTimeout(() => setOk(null), 1200);
    } catch {
      setOk("error");
      setTimeout(() => setOk(null), 1500);
    }
  }

  return (
    <button type="button" onClick={copy} aria-live="polite">
      {ok() === "copied"
        ? "Copied"
        : ok() === "error"
          ? "Error"
          : (props.label ?? "Share")}
    </button>
  );
}
