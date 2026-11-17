// Copies the "crons" from vercel.json into the prebuilt Vercel output.
// This app ships .vercel/output (Build Output API), and Vercel reads cron jobs
// from .vercel/output/config.json there. Runs automatically after `npm run build`.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const outputConfig = ".vercel/output/config.json";
if (!existsSync(outputConfig)) {
  console.log("[add-vercel-crons] no .vercel/output/config.json, skipping");
  process.exit(0);
}

const crons = JSON.parse(readFileSync("vercel.json", "utf8")).crons ?? [];
const config = JSON.parse(readFileSync(outputConfig, "utf8"));
const byPath = new Map((config.crons ?? []).map((cron) => [`${cron.path} ${cron.schedule}`, cron]));
for (const cron of crons) byPath.set(`${cron.path} ${cron.schedule}`, cron);
config.crons = [...byPath.values()];
writeFileSync(outputConfig, `${JSON.stringify(config, null, 2)}\n`);
console.log(`[add-vercel-crons] ${config.crons.length} cron job(s) in ${outputConfig}`);
