import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const backendRoot = fileURLToPath(new URL("..", import.meta.url));
const ignoredDirectories = new Set(["node_modules", ".git"]);

function collectJavaScriptFiles(directory) {
    const files = [];

    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (!ignoredDirectories.has(entry.name)) {
                files.push(...collectJavaScriptFiles(join(directory, entry.name)));
            }
            continue;
        }

        if (entry.isFile() && entry.name.endsWith(".js")) {
            files.push(join(directory, entry.name));
        }
    }

    return files;
}

const files = collectJavaScriptFiles(backendRoot);
const failures = files.filter((file) => {
    const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
    return result.status !== 0;
});

if (failures.length > 0) {
    console.error(`Backend build failed for ${failures.length} file(s).`);
    process.exitCode = 1;
} else {
    console.log(`Backend syntax check passed for ${files.length} JavaScript file(s).`);
}
