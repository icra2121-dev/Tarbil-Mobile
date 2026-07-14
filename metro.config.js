const { getDefaultConfig } = require("expo/metro-config");
const exclusionList = require("metro-config/private/defaults/exclusionList").default;
const path = require("path");

const config = getDefaultConfig(__dirname);

function escapeForRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}

function rootEntry(name, includeChildren = false) {
  const entryPath = path.join(__dirname, name);
  const pattern = entryPath.split(/[\\/]/).map(escapeForRegExp).join("[/\\\\]");
  return new RegExp(`^${pattern}${includeChildren ? "([/\\\\].*)?" : ""}$`);
}

config.resolver.blockList = exclusionList([
  rootEntry(".codex-docx-render", true),
  rootEntry(".git", true),
  rootEntry(".idea", true),
  rootEntry(".vscode", true),
  rootEntry("android", true),
  rootEntry("dist", true),
  rootEntry("KOBUDS-v2-debug.apk"),
  rootEntry("KOBUDS-v2.0-release.apk"),
  rootEntry("KOBUDS-v2.1-release.apk"),
  rootEntry("KOBUDS-v2.2-release.apk"),
  rootEntry("app.backup.json"),
  rootEntry("app.before-maps.json"),
  rootEntry("app.json.bak"),
  rootEntry("map.android.before-region-fix.tsx"),
  rootEntry("task_id.txt"),
  rootEntry("task_id_screen.txt"),
]);

module.exports = config;
