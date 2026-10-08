/**
 * Patch moti's SafeAreaView shim.
 *
 * moti's package index evaluates `components/safe-area-view.js`, which does
 * `import { SafeAreaView } from 'react-native'` — and merely *touching* that
 * getter makes React Native 0.86+ log:
 *
 *   WARN  SafeAreaView has been deprecated and will be removed in a future
 *   release. Please use 'react-native-safe-area-context' instead.
 *
 * The app never renders moti's SafeAreaView, but the warning fires on every
 * dev session. This patch swaps the import for `react-native-safe-area-context`
 * (already a dependency), which is what the deprecation message recommends.
 * Idempotent: safe to run on every install.
 *
 * Wired as the package's "postinstall" script.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const targets = [
  join(root, "node_modules/moti/build/components/safe-area-view.js"),
  join(root, "node_modules/moti/lib/module/components/safe-area-view.js"),
];

const OLD_IMPORTS = [
  "import { SafeAreaView as RSafeAreaView } from 'react-native';",
  'import { SafeAreaView as RSafeAreaView } from "react-native";',
];

for (const file of targets) {
  if (!existsSync(file)) continue;

  const source = readFileSync(file, "utf8");
  if (source.includes("react-native-safe-area-context")) continue; // already patched

  let next = source;
  for (const oldImport of OLD_IMPORTS) {
    if (next.includes(oldImport)) {
      next = next.replace(
        oldImport,
        "import { SafeAreaView as RSafeAreaView } from 'react-native-safe-area-context';",
      );
    }
  }

  if (next !== source) {
    writeFileSync(file, next);
    console.log("[patch-moti-safearea] patched", file);
  }
}
