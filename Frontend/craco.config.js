/**
 * Optional dev-server tweaks. Default `npm start` still uses react-scripts only.
 * Use `npm run start:no-hmr` to turn off webpack HMR entirely (stops .hot-update floods).
 */
module.exports = {
  devServer(devServerConfig) {
    if (process.env.DISABLE_HMR === 'true') {
      devServerConfig.hot = false;
      devServerConfig.liveReload = true;
    }
    return devServerConfig;
  },
};
