// Zero-dependency test harness.
//
// The app is TypeScript with `@/` path aliases and Expo/React Native imports that
// cannot be `require`d in plain Node. This harness transpiles source modules on the
// fly with the (already-installed) `typescript` compiler, resolves the `@/` alias,
// and stubs native modules (currently just expo-secure-store) with in-memory shims.
// That lets us unit-test the app's pure logic and storage helpers without pulling in
// jest-expo / react-native, keeping CI fast and dependency-free.

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

// --- In-memory native stubs -------------------------------------------------

const secureStore = new Map();
// Every key ever written, so we can also purge SafeSecureStore's own private
// in-memory fallback (which mirrors writes) between tests.
const touchedKeys = new Set();

async function resetStore() {
  secureStore.clear();
  // SafeSecureStore keeps a second in-memory copy; clear it via the same singleton
  // instance the app modules use so tests start from a clean slate.
  const safe = loadModule('@/services/SafeSecureStore');
  for (const key of touchedKeys) {
    await safe.deleteItemAsync(key);
  }
  touchedKeys.clear();
}

const expoSecureStoreStub = {
  async getItemAsync(key) {
    return secureStore.has(key) ? secureStore.get(key) : null;
  },
  async setItemAsync(key, value) {
    touchedKeys.add(key);
    secureStore.set(key, value);
  },
  async deleteItemAsync(key) {
    secureStore.delete(key);
  },
};

const STUBS = {
  'expo-secure-store': expoSecureStoreStub,
};

// --- Module loader ----------------------------------------------------------

const cache = new Map();

function resolveModule(spec, fromDir) {
  if (STUBS[spec]) return { stub: STUBS[spec] };

  let base;
  if (spec.startsWith('@/')) {
    base = path.join(SRC, spec.slice(2));
  } else if (spec.startsWith('.')) {
    base = path.join(fromDir, spec);
  } else {
    // Node builtins / npm packages: defer to the real require.
    return { external: spec };
  }

  for (const ext of ['', '.ts', '.tsx', '.js', '.json']) {
    const candidate = base + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return { file: candidate };
    }
  }
  throw new Error(`Cannot resolve module "${spec}" from ${fromDir}`);
}

function loadFile(file) {
  const cached = cache.get(file);
  if (cached) return cached.exports;

  const source = fs.readFileSync(file, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
    fileName: file,
  }).outputText;

  const moduleObj = { exports: {} };
  cache.set(file, moduleObj); // cache before executing to tolerate cycles
  const dir = path.dirname(file);

  const localRequire = (spec) => {
    const resolved = resolveModule(spec, dir);
    if (resolved.stub) return resolved.stub;
    if (resolved.external) return require(spec);
    return loadFile(resolved.file);
  };

  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', compiled)(moduleObj, moduleObj.exports, localRequire);
  return moduleObj.exports;
}

function loadModule(spec) {
  const resolved = resolveModule(spec, ROOT);
  if (resolved.stub) return resolved.stub;
  if (resolved.external) return require(spec);
  return loadFile(resolved.file);
}

// --- Tiny test runner -------------------------------------------------------

const suites = [];

function describe(name, fn) {
  suites.push({ name, fn });
}

async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const suite of suites) {
    const cases = [];
    const register = (name, fn) => cases.push({ name, fn });
    suite.fn(register);

    console.log(`\n${suite.name}`);
    for (const testCase of cases) {
      try {
        await resetStore();
        await testCase.fn();
        console.log(`  ✓ ${testCase.name}`);
        passed += 1;
      } catch (error) {
        console.log(`  ✗ ${testCase.name}`);
        failed += 1;
        failures.push({ suite: suite.name, name: testCase.name, error });
      }
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const failure of failures) {
      console.log(`  ✗ ${failure.suite} › ${failure.name}`);
      console.log(`      ${failure.error && failure.error.stack ? failure.error.stack.split('\n').slice(0, 3).join('\n      ') : failure.error}`);
    }
    process.exitCode = 1;
  }
}

module.exports = {
  loadModule,
  resetStore,
  describe,
  run,
};
