// packages/prumo-coder/src/services/files.ts
// Workspace file system discovery and content loader
import fs from "node:fs/promises";
import path from "node:path";

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "bin",
  ".next",
  ".turbo",
  "build",
  "coverage",
  ".cache",
  "target",
  "vendor",
  "tmp",
  ".idea",
  ".vscode",
  ".venv",
  "__pycache__",
  ".parcel-cache",
  ".output",
]);

const MAX_FILE_READ_SIZE = 1024 * 1024; // 1 MB preview cap

export async function listWorkspaceFiles(rootDir: string, maxFiles = 300): Promise<string[]> {
  const result: string[] = [];

  async function walk(dir: string) {
    if (result.length >= maxFiles) return;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (result.length >= maxFiles) break;

        if (entry.isDirectory()) {
          if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
            await walk(path.join(dir, entry.name));
          }
        } else if (entry.isFile()) {
          const rel = path.relative(rootDir, path.join(dir, entry.name));
          result.push(rel);
        }
      }
    } catch {
      // Permission or missing directory
    }
  }

  await walk(rootDir);
  return result;
}

export async function readWorkspaceFile(rootDir: string, relPath: string): Promise<{
  content: string;
  size: number;
  lines: number;
  extension: string;
  truncated: boolean;
}> {
  const fullPath = path.resolve(rootDir, relPath);
  const stat = await fs.stat(fullPath);
  let content: string;
  let truncated = false;

  if (stat.size > MAX_FILE_READ_SIZE) {
    const fd = await fs.open(fullPath, "r");
    try {
      const buf = Buffer.alloc(MAX_FILE_READ_SIZE);
      const { bytesRead } = await fd.read(buf, 0, MAX_FILE_READ_SIZE, 0);
      content =
        buf.subarray(0, bytesRead).toString("utf-8") +
        `\n\n[... Truncated: file size (${(stat.size / (1024 * 1024)).toFixed(2)} MB) exceeds 1MB preview limit ...]`;
      truncated = true;
    } finally {
      await fd.close();
    }
  } else {
    content = await fs.readFile(fullPath, "utf-8");
  }

  const lines = content.split("\n").length;
  const extension = path.extname(relPath).replace(".", "").toLowerCase();

  return {
    content,
    size: stat.size,
    lines,
    extension,
    truncated,
  };
}
