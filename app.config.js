// Extra build settings on top of app.json.
// BUILD_NUMBER (set by GitHub Actions) makes every APK a newer version, so it installs over the old one.
// EXPO_BASE_URL lets the web build live under a sub path (GitHub Pages serves it at /<repo-name>/).
const build = parseInt(process.env.BUILD_NUMBER || '1', 10);

module.exports = ({ config }) => ({
  ...config,
  version: `1.0.${build}`,
  android: { ...config.android, versionCode: build },
  ios: { ...config.ios, buildNumber: String(build) },
  experiments: {
    ...config.experiments,
    baseUrl: process.env.EXPO_BASE_URL || undefined,
  },
});
