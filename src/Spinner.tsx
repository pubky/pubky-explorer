import { Show } from "solid-js";
import { store } from "./state";
import "./css/Spinner.css";

export function Spinner() {
  return (
    <Show when={store.loading}>
      <div class="spinner-fixed">
        <div class="spinner" aria-label="Loading" role="status" />
      </div>
    </Show>
  );
}
