import { resolveDataSourceName } from "@/lib/data-source/config";

// Runs once when a Next.js server instance starts. An invalid DATA_SOURCE is
// reported in the startup log, and Next.js then fails every request, rather
// than the misconfiguration surfacing later on whichever page needs data.
export function register() {
  resolveDataSourceName(process.env.DATA_SOURCE);
}
