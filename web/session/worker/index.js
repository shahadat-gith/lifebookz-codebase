// Static assets + SPA fallback. The `not_found_handling =
// "single-page-application"` setting in wrangler.toml makes the assets layer
// serve index.html for every unknown path (React Router deep links like
// /session/:id), so no manual fallback fetch is needed here — fetching
// /index.html manually would itself get redirected to / by the assets layer.
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
