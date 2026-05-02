import fs from "fs";
import path from "path";
import util from "util";

const logDir = path.resolve(process.cwd(), "logs");
const logFile = path.join(logDir, "backend.log");

type LogLevel = "debug" | "info" | "warn" | "error";

function ensureLogDir() {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

function serialize(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}\n${value.stack ?? ""}`;
  }
  if (typeof value === "string") {
    return value;
  }
  return util.inspect(value, { depth: 8, colors: false, compact: false });
}

export function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const entry = {
    time: new Date().toISOString(),
    level,
    message,
    ...(meta ?? {})
  };
  const line = `[${entry.time}] ${level.toUpperCase()} ${message}${
    meta ? ` ${serialize(meta)}` : ""
  }`;

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }

  try {
    ensureLogDir();
    fs.appendFileSync(logFile, `${line}\n`, "utf8");
  } catch (error) {
    console.warn("Failed to write log file", error);
  }
}

export function createRequestId(prefix = "req") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getLogFilePath() {
  return logFile;
}

