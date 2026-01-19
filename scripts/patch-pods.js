const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const ROOT = path.basename(cwd) === 'ios' ? path.dirname(cwd) : cwd;
const providerPath = path.join(
  ROOT,
  'ios',
  'Pods',
  'Target Support Files',
  'Pods-recovr',
  'ExpoModulesProvider.swift'
);
const configureScriptPath = path.join(
  ROOT,
  'ios',
  'Pods',
  'Target Support Files',
  'Pods-recovr',
  'expo-configure-project.sh'
);

if (!fs.existsSync(providerPath)) {
  console.warn(`patch-pods: missing ${providerPath}`);
  process.exit(0);
}

const original = fs.readFileSync(providerPath, 'utf8');
let updated = original;

if (!updated.includes('import ExpoHealthKit')) {
  updated = updated.replace(
    'import ExpoWebBrowser',
    'import ExpoWebBrowser\nimport ExpoHealthKit'
  );
}

const addModule = (blockStart, moduleName) => {
  const marker = `${moduleName}.self`;
  if (updated.includes(marker)) return;

  const idx = updated.indexOf(blockStart);
  if (idx === -1) return;

  const insertAt = updated.indexOf('[', idx);
  if (insertAt === -1) return;

  const insertPos = updated.indexOf('\n', insertAt) + 1;
  updated =
    updated.slice(0, insertPos) +
    `      ${moduleName}.self,\n` +
    updated.slice(insertPos);
};

addModule('public override func getModuleClasses()', 'ExpoHealthKitModule');

if (updated !== original) {
  fs.writeFileSync(providerPath, updated);
  console.log(`patch-pods: updated ${providerPath}`);
}

if (fs.existsSync(configureScriptPath)) {
  const configureOriginal = fs.readFileSync(configureScriptPath, 'utf8');
  let configureUpdated = configureOriginal;

  if (!configureUpdated.includes('"expo-health-kit"')) {
    configureUpdated = configureUpdated.replace(
      /--packages ([^\n]+)/,
      (match, packages) => {
        if (packages.includes('"expo-web-browser"')) {
          const updatedPackages = packages.replace(
            '"expo-web-browser"',
            '"expo-health-kit" "expo-web-browser"'
          );
          return `--packages ${updatedPackages}`;
        }
        return `${match} "expo-health-kit"`;
      }
    );
  }

  if (configureUpdated !== configureOriginal) {
    fs.writeFileSync(configureScriptPath, configureUpdated);
    console.log(`patch-pods: updated ${configureScriptPath}`);
  }
} else {
  console.warn(`patch-pods: missing ${configureScriptPath}`);
}
