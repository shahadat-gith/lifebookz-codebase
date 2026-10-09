// Demo server for visually verifying the built client UI at /bookings and
// /consult/rate/DEMO without a live backend. Serves dist/ with SPA fallback.
const path = require("path");
const express = require(path.join(process.env.TEMP, "lbh", "node_modules", "express"));

const app = express();
const dist = path.join(__dirname, "..", "dist");

app.use(express.static(dist));
// Express 5 renamed the wildcard route syntax
const handler = (_req, res) => res.sendFile(path.join(dist, "index.html"));
app.get("/", handler);
app.use(handler);

app.listen(5222, "127.0.0.1", () => console.log("demo server up on 5222"));
