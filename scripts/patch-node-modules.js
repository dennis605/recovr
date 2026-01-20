const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function applyReplacements(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    console.warn(`patch-node-modules: missing ${filePath}`);
    return;
  }

  const original = fs.readFileSync(filePath, 'utf8');
  let updated = original;

  for (const { before, after } of replacements) {
    if (updated.includes(after)) {
      continue;
    }
    if (!updated.includes(before)) {
      console.warn(`patch-node-modules: pattern not found in ${filePath}`);
      continue;
    }
    updated = updated.replace(before, after);
  }

  if (updated !== original) {
    fs.writeFileSync(filePath, updated);
    console.log(`patch-node-modules: updated ${filePath}`);
  }
}

function applyRegexReplacements(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    console.warn(`patch-node-modules: missing ${filePath}`);
    return;
  }

  const original = fs.readFileSync(filePath, 'utf8');
  let updated = original;

  for (const { pattern, replacement } of replacements) {
    if (pattern.test(updated)) {
      updated = updated.replace(pattern, replacement);
    } else if (typeof replacement === 'string' && updated.includes(replacement)) {
      continue;
    } else {
      console.warn(`patch-node-modules: regex not matched in ${filePath}`);
    }
  }

  if (updated !== original) {
    fs.writeFileSync(filePath, updated);
    console.log(`patch-node-modules: updated ${filePath}`);
  }
}

function ensureFile(filePath, content) {
  const normalized = `${content.trim()}\n`;
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (existing === normalized) {
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, normalized);
  console.log(`patch-node-modules: wrote ${filePath}`);
}

function ensureIsoFormatter(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`patch-node-modules: missing ${filePath}`);
    return;
  }
  const original = fs.readFileSync(filePath, 'utf8');
  if (original.includes('private static func isoFormatter()')) {
    return;
  }
  const pattern =
    /public class ExpoHealthKitModule: Module \{\n    public static let healthStore = HKHealthStore\(\)\n    private var observers: \[String: HKObserverQuery\] = \[:\]\n/;
  if (!pattern.test(original)) {
    console.warn(`patch-node-modules: isoFormatter anchor not found in ${filePath}`);
    return;
  }
  const updated = original.replace(
    pattern,
    'public class ExpoHealthKitModule: Module {\n' +
      '    public static let healthStore = HKHealthStore()\n' +
      '    private var observers: [String: HKObserverQuery] = [:]\n' +
      '    private static func isoFormatter() -> ISO8601DateFormatter {\n' +
      '        let formatter = ISO8601DateFormatter()\n' +
      '        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]\n' +
      '        return formatter\n' +
      '    }\n'
  );
  fs.writeFileSync(filePath, updated);
  console.log(`patch-node-modules: updated ${filePath}`);
}

applyReplacements(
  path.join(ROOT, 'node_modules', 'expo-health-kit', 'ios', 'ExpoHealthKit.podspec'),
  [
    {
      before: '  s.source_files = "**/*.{h,m,swift}"',
      after: '  s.source_files = "**/*.{swift}"',
    },
  ]
);

ensureFile(
  path.join(ROOT, 'node_modules', 'expo-health-kit', 'expo-module.config.json'),
  JSON.stringify(
    {
      platforms: ['apple'],
      apple: {
        modules: ['ExpoHealthKitModule'],
      },
    },
    null,
    2
  )
);

const expoHealthKitModulePath = path.join(
  ROOT,
  'node_modules',
  'expo-health-kit',
  'ios',
  'ExpoHealthKitModule.swift'
);

ensureIsoFormatter(expoHealthKitModulePath);

applyRegexReplacements(
  expoHealthKitModulePath,
  [
    {
      pattern:
        /if !sample\.metadata\.isEmpty {\n\s+result\["metadata"\] = sample\.metadata\n\s+}/g,
      replacement:
        'if let metadata = sample.metadata, !metadata.isEmpty {\n                            result["metadata"] = metadata\n                        }',
    },
    {
      pattern:
        /if !sample\.metadata\.isEmpty {\n\s+data\["metadata"\] = sample\.metadata\n\s+}/g,
      replacement:
        'if let metadata = sample.metadata, !metadata.isEmpty {\n                        data["metadata"] = metadata\n                    }',
    },
    {
      pattern:
        /private func getHealthKitTypes\(from identifiers: \[String\]\) throws -> \(readTypes: \[HKObjectType\], writeTypes: \[HKObjectType\]\) {/,
      replacement:
        'private func getHealthKitTypes(from identifiers: [String]) throws -> (readTypes: [HKObjectType], writeTypes: [HKSampleType]) {',
    },
    {
      pattern: /var writeTypes: \[HKObjectType\] = \[\]/,
      replacement: 'var writeTypes: [HKSampleType] = []',
    },
    {
      pattern:
        /if type is HKQuantityType {\n\s+writeTypes\.append\(type\)\n\s+}/,
      replacement:
        'if let quantityType = type as? HKQuantityType {\n                writeTypes.append(quantityType)\n            }',
    },
    {
      pattern: /private func getSampleType\(for identifier: String\) -> HKObjectType\?/,
      replacement: 'private func getSampleType(for identifier: String) -> HKSampleType?',
    },
    {
      pattern: /HKObjectType\.categoryType\(forIdentifier:/,
      replacement: 'HKCategoryType.categoryType(forIdentifier:',
    },
    {
      pattern: /try await healthStore\.enableBackgroundDelivery/g,
      replacement: 'try await Self.healthStore.enableBackgroundDelivery',
    },
    {
      pattern: /ISO8601DateFormatter\(\)\.date\(from:/g,
      replacement: 'Self.isoFormatter().date(from:',
    },
    {
      pattern: /ISO8601DateFormatter\(\)\.string\(from:/g,
      replacement: 'Self.isoFormatter().string(from:',
    },
  ]
);

applyReplacements(path.join(ROOT, 'node_modules', 'freeport-async', 'index.js'), [
  {
    before: '    server.listen({ port: port, host: hostname }, function(err) {',
    after:
      '    const listenOptions = hostname == null ? { port: port } : { port: port, host: hostname };' +
      '\n' +
      '    server.listen(listenOptions, function(err) {',
  },
]);
