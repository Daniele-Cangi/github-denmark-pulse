import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const engineDirectory = resolve(process.argv[2] ?? '.run/data');
const configPath = resolve(engineDirectory, 'config.json');
const checkpointPath = resolve(engineDirectory, 'checkpoint.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));

const denmarkIndex = config.locations.findIndex(
  (location) => String(location.country).trim().toLowerCase() === 'denmark'
);
if (denmarkIndex < 0) throw new Error('Denmark is absent from the upstream configuration');

config.devMode = 'true';
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
await writeFile(checkpointPath, `${JSON.stringify({ checkpoint: denmarkIndex })}\n`);

console.log(`Prepared upstream engine for Denmark at checkpoint ${denmarkIndex}`);
