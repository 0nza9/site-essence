#!/usr/bin/env node
/**
 * Récupère le flux officiel et écrit une fixture de dev dans
 * public/data/stations.json. Sert juste à bosser sur l'interface sans backend.
 *
 *   npm run fixture              # toute la France
 *   npm run fixture -- --dep 75  # un seul département
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DATASET = "prix-des-carburants-en-france-flux-instantane-v2";
const BASE = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/${DATASET}`;
const PAGE_SIZE = 100;

// juste les champs que le normaliseur sait lire, le flux en balance ~40
const FIELDS = [
  "id",
  "cp",
  "pop",
  "adresse",
  "ville",
  "geom",
  "departement",
  "region",
  "horaires",
  "horaires_automate_24_24",
  "services_service",
  "carburants_rupture_temporaire",
  "carburants_rupture_definitive",
  ...["gazole", "sp95", "sp98", "e10", "e85", "gplc"].flatMap((fuel) => [
    `${fuel}_prix`,
    `${fuel}_maj`,
  ]),
];

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "public/data/stations.json");

function parseArgs(argv) {
  const options = { dep: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dep" && argv[i + 1]) {
      options.dep = argv[i + 1];
      i += 1;
    }
  }
  return options;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "Accept-Encoding": "gzip" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} sur ${url}`);
  }
  return response.json();
}

/** l'API plafonne limit à 100 et offset à 10 000, donc on pagine */
async function fetchPage(offset, where) {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(offset),
    select: FIELDS.join(","),
  });
  if (where) params.set("where", where);
  return fetchJson(`${BASE}/records?${params}`);
}

async function fetchAll(where) {
  const first = await fetchPage(0, where);
  const total = first.total_count ?? 0;
  const records = [...(first.results ?? [])];

  const offsets = [];
  for (let offset = PAGE_SIZE; offset < Math.min(total, 10_000); offset += PAGE_SIZE) {
    offsets.push(offset);
  }

  // quatre à la fois : assez rapide sans se faire limiter
  const CONCURRENCY = 4;
  for (let i = 0; i < offsets.length; i += CONCURRENCY) {
    const batch = offsets.slice(i, i + CONCURRENCY);
    const pages = await Promise.all(batch.map((offset) => fetchPage(offset, where)));
    for (const page of pages) records.push(...(page.results ?? []));
    process.stdout.write(
      `\r  ${Math.min(records.length, total)} / ${total} stations`,
    );
  }
  process.stdout.write("\n");
  return { records, total };
}

async function main() {
  const { dep } = parseArgs(process.argv.slice(2));
  const where = dep ? `code_departement="${dep}"` : null;

  console.log(
    dep
      ? `Téléchargement du flux officiel (département ${dep})...`
      : "Téléchargement du flux officiel (France entière)...",
  );

  const { records, total } = await fetchAll(where);

  if (records.length === 0) {
    throw new Error("Aucun enregistrement reçu — le flux a-t-il changé ?");
  }
  if (total > 10_000) {
    console.warn(
      `Attention : ${total} enregistrements annoncés, l'API en plafonne ` +
        "10 000. Relancez par département avec --dep.",
    );
  }

  await mkdir(dirname(target), { recursive: true });
  // minifié, l'indentation ferait grossir le fichier d'un tiers pour rien
  await writeFile(target, JSON.stringify(records), "utf8");

  const megabytes = (Buffer.byteLength(JSON.stringify(records)) / 1e6).toFixed(1);
  console.log(`${records.length} stations écrites dans ${target} (${megabytes} Mo)`);
}

main().catch((error) => {
  console.error(`\nÉchec : ${error.message}`);
  process.exit(1);
});
