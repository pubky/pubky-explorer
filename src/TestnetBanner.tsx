import { For, createSignal, onCleanup, onMount } from "solid-js";

type ServiceStatus = "checking" | "connected" | "disconnected";

type LocalService = {
  name: string;
  port: number;
  url: string;
};

const LOCAL_SERVICES: LocalService[] = [
  {
    name: "PKARR relay",
    port: 15411,
    url: "http://localhost:15411/",
  },
  {
    name: "Homeserver",
    port: 6286,
    url: "http://localhost:6286/",
  },
];

const PROBE_INTERVAL_MS = 15_000;
const PROBE_TIMEOUT_MS = 4_000;

export function TestnetBanner() {
  const [statuses, setStatuses] = createSignal<Record<number, ServiceStatus>>(
    Object.fromEntries(
      LOCAL_SERVICES.map((service) => [service.port, "checking"]),
    ),
  );

  let probeActive = false;

  async function probeServices() {
    if (probeActive || document.visibilityState === "hidden") return;
    probeActive = true;

    try {
      await Promise.all(
        LOCAL_SERVICES.map(async (service) => {
          const status = await probeService(service);
          setStatuses((current) => ({
            ...current,
            [service.port]: status,
          }));
        }),
      );
    } finally {
      probeActive = false;
    }
  }

  onMount(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void probeServices();
    };
    const interval = window.setInterval(
      () => void probeServices(),
      PROBE_INTERVAL_MS,
    );

    document.addEventListener("visibilitychange", handleVisibilityChange);
    void probeServices();

    onCleanup(() => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    });
  });

  return (
    <aside class="testnet-banner" aria-label="Local testnet status">
      <strong class="testnet-banner-title">Local testnet</strong>
      <ul class="testnet-services" aria-live="polite">
        <For each={LOCAL_SERVICES}>
          {(service) => {
            const status = () => statuses()[service.port] ?? "checking";
            return (
              <li
                class={`testnet-service ${status()}`}
                aria-label={`${service.name} on localhost:${service.port}: ${statusLabel(status())}`}
              >
                <i aria-hidden="true" />
                <span>
                  {service.name} · localhost:{service.port}
                </span>
                <strong>{statusLabel(status())}</strong>
              </li>
            );
          }}
        </For>
      </ul>
    </aside>
  );
}

async function probeService(service: LocalService): Promise<ServiceStatus> {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    PROBE_TIMEOUT_MS,
  );

  try {
    await fetch(service.url, {
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
    return "connected";
  } catch {
    return "disconnected";
  } finally {
    window.clearTimeout(timeout);
  }
}

function statusLabel(status: ServiceStatus): string {
  if (status === "connected") return "Connected";
  if (status === "disconnected") return "Unavailable";
  return "Checking";
}
