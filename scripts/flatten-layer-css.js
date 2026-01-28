import fs from "node:fs";
import path from "node:path";

const shouldRun = process.env.ANDROID_WEBVIEW_COMPAT === "1";
if (!shouldRun) {
  console.log("[flatten-layer-css] 未启用 ANDROID_WEBVIEW_COMPAT=1，跳过处理。");
  process.exit(0);
}

const tauriConfigPath = path.resolve("src-tauri/tauri.conf.json");
let frontendDist = null;

if (fs.existsSync(tauriConfigPath)) {
  try {
    const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, "utf8"));
    frontendDist = tauriConfig?.build?.frontendDist ?? null;
  } catch (error) {
    console.warn(
      `[flatten-layer-css] 读取 tauri.conf.json 失败，将回退默认路径: ${error.message}`
    );
  }
}

const distRootCandidates = [
  frontendDist ? path.resolve("src-tauri", frontendDist) : null,
  frontendDist ? path.resolve(frontendDist) : null,
  path.resolve("build/client"),
].filter(Boolean);

const distRoot = distRootCandidates.find((candidate) =>
  fs.existsSync(candidate)
);

if (!distRoot) {
  console.warn(
    "[flatten-layer-css] 未找到前端产物目录，确认 build/client 或 tauri.conf.json 的 frontendDist 是否存在。"
  );
  process.exit(0);
}

const cssFiles = [];
const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".css")) {
      cssFiles.push(fullPath);
    }
  }
};

walk(distRoot);

if (cssFiles.length === 0) {
  console.warn(`[flatten-layer-css] 未在 ${distRoot} 找到 CSS 文件。`);
  process.exit(0);
}

const isIdentChar = (char) =>
  char && /[A-Za-z0-9_-]/.test(char);

const findMatchingBrace = (input, startIndex) => {
  let depth = 0;
  let inString = null;
  let inComment = false;

  for (let i = startIndex; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (inComment) {
      if (char === "*" && next === "/") {
        inComment = false;
        i += 1;
      }
      continue;
    }

    if (!inString && char === "/" && next === "*") {
      inComment = true;
      i += 1;
      continue;
    }

    if (inString) {
      if (char === "\\") {
        i += 1;
        continue;
      }
      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === "'" || char === "\"") {
      inString = char;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
};

const flattenLayerAtRules = (input) => {
  let output = "";
  let i = 0;
  let inString = null;
  let inComment = false;
  let changed = false;

  while (i < input.length) {
    const char = input[i];
    const next = input[i + 1];

    if (inComment) {
      output += char;
      if (char === "*" && next === "/") {
        output += "/";
        i += 2;
        inComment = false;
        continue;
      }
      i += 1;
      continue;
    }

    if (!inString && char === "/" && next === "*") {
      output += "/*";
      i += 2;
      inComment = true;
      continue;
    }

    if (inString) {
      output += char;
      if (char === "\\") {
        output += next ?? "";
        i += 2;
        continue;
      }
      if (char === inString) {
        inString = null;
      }
      i += 1;
      continue;
    }

    if (char === "'" || char === "\"") {
      inString = char;
      output += char;
      i += 1;
      continue;
    }

    if (
      char === "@" &&
      input.startsWith("@layer", i) &&
      !isIdentChar(input[i - 1])
    ) {
      const directiveStart = i;
      i += "@layer".length;

      while (i < input.length && /\s/.test(input[i])) {
        i += 1;
      }

      const afterNameIndex = i;
      while (i < input.length && input[i] !== "{" && input[i] !== ";") {
        i += 1;
      }

      const endToken = input[i];

      if (endToken === ";") {
        changed = true;
        i += 1;
        continue;
      }

      if (endToken === "{") {
        const blockStart = i;
        const blockEnd = findMatchingBrace(input, blockStart);
        if (blockEnd === -1) {
          output += input.slice(directiveStart, i + 1);
          i = blockStart + 1;
          continue;
        }

        const innerContent = input.slice(blockStart + 1, blockEnd);
        output += innerContent;
        changed = true;
        i = blockEnd + 1;
        continue;
      }

      output += input.slice(directiveStart, i);
      continue;
    }

    output += char;
    i += 1;
  }

  return { output, changed };
};

let changedFiles = 0;

for (const filePath of cssFiles) {
  const original = fs.readFileSync(filePath, "utf8");
  const { output, changed } = flattenLayerAtRules(original);
  if (changed) {
    fs.writeFileSync(filePath, output, "utf8");
    changedFiles += 1;
    console.log(`[flatten-layer-css] 已处理: ${path.relative(process.cwd(), filePath)}`);
  }
}

console.log(
  `[flatten-layer-css] 完成，处理 ${changedFiles}/${cssFiles.length} 个 CSS 文件。`
);
