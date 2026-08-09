import { defineConfig, type Plugin } from "vite";
import solid from "vite-plugin-solid";

function pagesPreviewFallback(): Plugin {
  return {
    name: "pages-preview-fallback",
    configurePreviewServer(server) {
      server.middlewares.use((request, _response, next) => {
        const previewRequest = request as unknown as {
          method?: string;
          url?: string;
          headers: { accept?: string | string[] };
        };

        if (
          (previewRequest.method === "GET" ||
            previewRequest.method === "HEAD") &&
          previewRequest.url?.startsWith("/testnet/") &&
          previewRequest.headers.accept?.includes("text/html")
        ) {
          const queryIndex = previewRequest.url.indexOf("?");
          const query =
            queryIndex === -1 ? "" : previewRequest.url.slice(queryIndex);
          previewRequest.url = `/testnet/index.html${query}`;
        }

        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [solid(), mode === "pages" && pagesPreviewFallback()],
}));
