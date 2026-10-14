// packages/prumo-coder/src/services/git.ts
// Native Git integration for prumo-coder
import { spawn } from "node:child_process";

export interface GitFileEntry {
  path: string;
  status: "M" | "A" | "D" | "?" | "U";
  staged: boolean;
}

export interface GitRepoStatus {
  branch: string;
  isDirty: boolean;
  entries: GitFileEntry[];
}

export function executeGit(
  args: string[],
  cwd: string,
  timeout = 10000,
  maxBufferSize = 2 * 1024 * 1024,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });

    let output = "";
    let errors = "";
    let settled = false;
    let truncated = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill("SIGKILL");
        reject(new Error(`git ${args.join(" ")} timed out after ${timeout}ms`));
      }
    }, timeout);

    child.stdout.on("data", (chunk: Buffer) => {
      if (output.length < maxBufferSize) {
        output += chunk.toString();
        if (output.length >= maxBufferSize) {
          truncated = true;
          output = output.slice(0, maxBufferSize) + "\n\n[... Truncated: git output exceeded 2MB limit ...]";
          child.kill("SIGTERM");
        }
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      if (errors.length < 64 * 1024) {
        errors += chunk.toString();
      }
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (code === 0 || truncated) {
        resolve(output);
      } else {
        reject(new Error(errors.trim() || `git exited with code ${code}`));
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
  });
}

export async function getGitStatus(cwd: string): Promise<GitRepoStatus> {
  try {
    const isRepo = await executeGit(["rev-parse", "--is-inside-work-tree"], cwd).catch(() => "");
    if (!isRepo.trim()) {
      return { branch: "no-git", isDirty: false, entries: [] };
    }

    const [branchRaw, porcelain] = await Promise.all([
      executeGit(["branch", "--show-current"], cwd).catch(() => "detached"),
      executeGit(["status", "--porcelain=v1", "-uall"], cwd).catch(() => ""),
    ]);

    const branch = branchRaw.trim() || "detached";
    const entries: GitFileEntry[] = [];

    const lines = porcelain.split("\n");
    for (const line of lines) {
      if (!line || line.length < 3) continue;
      const x = line[0];
      const y = line[1];
      const filePath = line.slice(3).trim();

      let status: GitFileEntry["status"] = "M";
      if (x === "?" || y === "?") status = "?";
      else if (x === "A" || y === "A") status = "A";
      else if (x === "D" || y === "D") status = "D";
      else if (x === "U" || y === "U") status = "U";
      else status = "M";

      entries.push({
        path: filePath,
        status,
        staged: x !== " " && x !== "?",
      });
    }

    return {
      branch,
      isDirty: entries.length > 0,
      entries,
    };
  } catch {
    return { branch: "detached", isDirty: false, entries: [] };
  }
}

export async function getGitDiff(cwd: string, filePath?: string): Promise<string> {
  try {
    const args = ["diff", "HEAD"];
    if (filePath) {
      args.push("--", filePath);
    }
    const diff = await executeGit(args, cwd);
    if (!diff.trim()) {
      const unstaged = await executeGit(["diff"], cwd);
      return unstaged.trim() || "No changes detected.";
    }
    return diff;
  } catch {
    return "No changes detected or not a git repository.";
  }
}

export async function gitStash(cwd: string): Promise<string> {
  return executeGit(["stash"], cwd);
}

export async function gitCommit(cwd: string, message: string): Promise<string> {
  return executeGit(["commit", "-m", message], cwd);
}
