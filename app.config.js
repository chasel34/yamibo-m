const { expo: baseConfig } = require('./app.json');

const isDevelopment = process.env.APP_VARIANT === 'development';

module.exports = () => ({
  ...baseConfig,
  name: isDevelopment ? `${baseConfig.name} Dev` : baseConfig.name,
  icon: isDevelopment ? './assets/icon-dev.png' : baseConfig.icon,
  android: {
    ...baseConfig.android,
    package: isDevelopment ? 'com.yamibo.reader.dev' : baseConfig.android.package,
    adaptiveIcon: {
      ...baseConfig.android.adaptiveIcon,
      backgroundColor: isDevelopment ? '#e6f4ff' : baseConfig.android.adaptiveIcon.backgroundColor,
      foregroundImage: isDevelopment ? './assets/android-icon-foreground-dev.png' : baseConfig.android.adaptiveIcon.foregroundImage,
      backgroundImage: isDevelopment ? './assets/android-icon-background-dev.png' : baseConfig.android.adaptiveIcon.backgroundImage,
      monochromeImage: isDevelopment ? './assets/android-icon-monochrome-dev.png' : baseConfig.android.adaptiveIcon.monochromeImage,
    },
  },
  extra: {
    ...baseConfig.extra,
    appVariant: process.env.APP_VARIANT || 'production',
  },
});
