const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const tssrp6aCryptoShim = path.resolve(__dirname, 'shims/tssrp6aCrypto.js');
const cryptoShim = path.resolve(__dirname, 'shims/crypto.js');

// Custom resolveRequest: replace problematic module imports BEFORE Metro
// tries to apply package "exports" / built-in resolution. Used because
// `extraNodeModules` only intercepts top-level bare specifiers, not the
// internal relative imports inside `tssrp6a/dist/...`.
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver = {
  ...config.resolver,
  // Disable strict enforcement of package.json "exports" field.
  // Several nested packages (ethers/viem/@scure/@reown's copies of @noble/hashes,
  // multiformats) import internal subpaths not listed in their "exports", which
  // Metro 0.81+ warns about. Setting this to false tells Metro to fall back to
  // file-based resolution silently (the same resolution that already works).
  unstable_enablePackageExports: false,
  extraNodeModules: {
    ...config.resolver?.extraNodeModules,
    crypto: cryptoShim,
  },
  resolveRequest: (context, moduleName, platform) => {
    // Redirect tssrp6a's WebCrypto-dependent module to our pure-JS replacement.
    // tssrp6a/src/parameters.ts does `import "./crossEnvCrypto"`, which Metro
    // resolves to either the cjs or esm copy depending on package.json fields.
    if (
      moduleName === './crossEnvCrypto' ||
      moduleName === './crossEnvCrypto.js' ||
      moduleName === '../crossEnvCrypto' ||
      moduleName === '../crossEnvCrypto.js'
    ) {
      // Only redirect when the request originates from inside tssrp6a.
      if (context.originModulePath && context.originModulePath.includes('/tssrp6a/')) {
        return {
          type: 'sourceFile',
          filePath: tssrp6aCryptoShim,
        };
      }
    }

    if (defaultResolveRequest) {
      return defaultResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
