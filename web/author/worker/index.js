// Static assets + SPA fallback. The `not_found_handling =
// "single-page-application"` setting in wrangler.toml makes the assets layer
// serve index.html for every unknown path (React Router deep links), so no
// manual fallback fetch is needed here — fetching /index.html manually
// redirects to / by the assets layer and would bounce every refresh home.
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
