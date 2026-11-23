// Synthetic contract server CLI entrypoint, loopback only.
import { startDemoApiServer } from "../../src/lib/server/demo-api-core.mjs";

const fixturePort = Number(process.env.DRIVECORE_FIXTURE_PORT ?? 4201);
const seed = process.argv.includes("--seed=demo");

await startDemoApiServer({ port: fixturePort, seed });
