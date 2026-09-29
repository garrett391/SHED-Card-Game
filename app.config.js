/**
 * Build-time layer over app.json.
 *
 * WEB_BASE_URL sets the path prefix for web exports (e.g. "/SHED-Card-Game"
 * for GitHub Pages, which serves project sites from /<repo>/). It is read
 * from the environment rather than kept in app.json because Expo also
 * applies baseUrl to the dev server and native manifests, where the app
 * must stay at the root.
 */
module.exports = ({ config }) => {
  const baseUrl = process.env.WEB_BASE_URL;
  if (!baseUrl) return config;
  return {
    ...config,
    experiments: { ...config.experiments, baseUrl },
  };
};
