import { Keypair, PublicKey } from "@synonymdev/pubky";

import { faker } from "@faker-js/faker";
import { client } from "./state";

const SECRET_KEY = new Uint8Array(32).fill(10)
const KEYPAIR = Keypair.fromSecretKey(SECRET_KEY);
const PUBKY = KEYPAIR.publicKey().z32()
const HOMESERVER = PublicKey.from("8pinxxgqs41n4aididenw5apqp1urfmzdztr8jt4abrkdn435ewo")

export const DEMO_PUBKY = PUBKY;

async function doneBefore() {
  let list = await client.list(`pubky://${PUBKY}/pub/airline/`).catch(_ => []);

  return list?.length > 0
}

export async function populate() {
  if (await doneBefore()) {
    return
  }

  await client.signup(KEYPAIR, HOMESERVER);

  let paths: Array<Array<string>> = [];

  let structure = {
    "airline": { "aircraftType": ["airplane"] },
    "animal": {
      mamal: ["bear", "rabbit", "cat", "dog", "horse", "rodent"],
      reptile: ["snake"],
      marine: ["fish"],
    },
    "color": ["human", "rgb"],
    "finance": { "currency": ["iban"] },
    "location": {
      "country": {
        "city": {
          "street": [
            "zipCode"
          ]
        }
      }
    },
    "music": {
      "genre": ["songname"]
    },
    "vehicle": [
      "bicycle",
    ],
    "word": [
      "adverb",
      "adjective",
      "noun"
    ]
  }


  visit(structure, [], paths)

  const morePaths: string[][] = []

  paths.forEach(path => {
    for (let i = 0; i <= 100; i++) {
      let expanded: string[] = []

      path.forEach((p, i) => {
        if (i === 0) {
          return expanded.push(p)
        }

        // @ts-ignore
        let x = faker[path[0]][p]

        x = x?.()

        if (!x) {
          return expanded.push(p)
        } else {
          expanded.push(p)
        }

        if (!(x instanceof Object)) {
          return expanded.push(x.replace(/[^a-zA-Z0-9-_]/g, ''))
        }

        x = x.name

        if (!(x instanceof Object)) {
          return expanded.push(x.replace(/[^a-zA-Z0-9-_]/g, ''))
        }

        x = x.x

        return expanded.push(x.replace(/[^a-zA-Z0-9-_]/g, ''))
      })

      morePaths.push(expanded)
    }

  })

  for (let parts of morePaths) {
    await client.put(`pubky://${PUBKY}/pub/${parts.join('/')}`, new Uint8Array(5).fill(0))
  }
}

function visit(obj: any, acc: string[] = [], paths: string[][]) {
  if (Array.isArray(obj)) {
    for (let i of obj) {
      paths.push([...acc, i])
    }
  } else {
    for (let branch in obj) {
      visit(obj[branch], [...acc, branch], paths)
    }
  }
}
