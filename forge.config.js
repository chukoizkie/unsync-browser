const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    name: 'unsync-browser',
    productName: 'UnSync Browser',
    executableName: 'unsync-browser',
    appVersion: '0.4.0',
    icon: './assets/icon',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux'],
      config: {
        options: {
          name: 'unsync-browser',
          productName: 'UnSync Browser',
          genericName: 'Web Browser',
          description: 'A mesh-native browser — sovereign, private, P2P',
          version: '0.4.0',
          maintainer: 'Dexter T. Brago <dexter@unsync.uk>',
          homepage: 'https://unsync.uk',
          icon: './assets/icon.png',
          categories: ['Network', 'WebBrowser'],
          depends: ['libgtk-3-0', 'libnss3', 'libasound2t64', 'libgbm1', 'libxss1'],
        },
      },
    },
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        name: 'unsync-browser',
        setupExe: 'UnSyncBrowserSetup.exe',
        setupIcon: './assets/icon.ico',
        description: 'A mesh-native browser — sovereign, private, P2P',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux'],
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        mainConfig: './webpack.main.config.js',
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './src/index.html',
              js: './src/renderer.js',
              name: 'main_window',
              preload: {
                js: './src/preload.js',
              },
            },
          ],
        },
      },
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
