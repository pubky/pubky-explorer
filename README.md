# Pubky Explorer

https://explorer.pubky.app

## Local testnet

https://explorer.pubky.app/testnet/ connects to a Pubky testnet running on your machine. Start the
local PKARR relay on port `15411` and at least one homeserver before using it.

## Usage

https://github.com/user-attachments/assets/1a9ac9e6-3d61-445f-8851-59b6f431df18

```bash
$ npm install # or pnpm install or yarn install
```

### Learn more on the [Solid Website](https://solidjs.com) and come chat with us on our [Discord](https://discord.com/invite/solidjs)

## Available Scripts

In the project directory, you can run:

### `npm run dev`

Runs the app in the development mode.<br>
Open [http://localhost:5173](http://localhost:5173) to view it in the browser.

### `npm run build`

Builds the app for production to the `dist` folder.<br>
It correctly bundles Solid in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br>
Your app is ready to be deployed!

### `npm run build:site`

Builds mainnet in `dist` and local testnet in `dist/testnet`.

### `npm run preview:site`

Previews the output of `npm run build:site` locally.<br>
Open [http://localhost:4173](http://localhost:4173) for mainnet or
[http://localhost:4173/testnet/](http://localhost:4173/testnet/) for the local testnet.

## Deployment

`.github/workflows/deploy.yml` builds and deploys the container on pushes to `main`
or manual runs. It replaces the GitHub Pages deployment.

- Cloud Run service and image: `pubky-explorer`
- Region: `europe-west6`
- Registry: `europe-west6-docker.pkg.dev/infra-464608/synonym-private-repo`
- Image tag: the Git commit SHA
- Container port: `8080`

Make the GitHub Actions secrets `GRC_INFRA_READ_WRITE` (Artifact Registry push
credentials) and `CLOUDRUN_INFRA` (Cloud Run deployment credentials) available to
this repository. The deployment account must be able to deploy the service, act
as its runtime service account, and configure unauthenticated invocation.

The container uses unprivileged Nginx to serve mainnet at `/` and local testnet at
`/testnet/`, with separate SPA fallbacks. Cloud Run ingress allows internal traffic
and Cloud Load Balancing; unauthenticated invocation allows the serverless NEG to
reach it. The existing load balancer must route `explorer.pubky.app` to
`pubky-explorer` in `europe-west6`. DNS, TLS, and load-balancer resources are managed
separately. Disable GitHub Pages in the repository settings when cutting traffic
over; deleting its workflow does not unpublish an existing Pages deployment.

To test the production container locally:

```sh
docker build -t pubky-explorer .
docker run --rm -p 8080:8080 pubky-explorer
```

Open `http://localhost:8080/` or `http://localhost:8080/testnet/`.
