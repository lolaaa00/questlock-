import { prisma } from "./prisma";

type LogLevel = "info" | "warn" | "error";

export async function log(
  level: LogLevel,
  source: string,
  message: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  console[level](`[${source}] ${message}`, metadata);
  try {
    await prisma.systemLog.create({
      data: {
        level,
        source,
        message,
        metadata_json: metadata as object,
      },
    });
  } catch {
    // Log write failure should not crash the caller
  }
}
