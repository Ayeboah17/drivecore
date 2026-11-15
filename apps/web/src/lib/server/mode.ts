import { connection } from "next/server";
export async function demoMode() {
  await connection();
  // Explicit isolated demo server only. Never use with a real API configured.
  return (
    process.env.DRIVECORE_MODE === "demo" && !process.env.DRIVECORE_API_ORIGIN
  );
}
