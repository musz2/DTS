const http = require("http");
const fs = require("fs");
const path = require("path");

const root = process.cwd();

const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".otf": "font/otf",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
  ".ktx2": "image/ktx2",
  ".exr": "image/x-exr"
};

function firstExisting(candidates) {
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    } catch (e) {}
  }
  return null;
}

http.createServer((req, res) => {
  const rawUrl = req.url;

  // App pings this auth endpoint; the static mirror has no backend.
  if (rawUrl.startsWith("/api/_auth/session")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end("{}");
  }

  const decoded = decodeURIComponent(rawUrl);
  const noQuery = decoded.split("?")[0];
  let urlPath = noQuery === "/" ? "/index.html" : noQuery;

  const candidates = [
    path.join(root, decoded),                       // exact, incl. "_payload.json?<hash>" filenames
    path.join(root, urlPath),                        // normal asset
    path.join(root, urlPath, "index.html"),          // directory index
    path.join(root, urlPath.replace(/\/$/, "") + ".html") // clean URL -> page.html (/about -> about.html)
  ];

  // Nuxt fetches "/about/_payload.json?<hash>"; the mirror stores it with the
  // query in the filename, so also try the dir's "_payload.json*" sibling.
  if (noQuery.endsWith("_payload.json")) {
    const dir = path.join(root, path.dirname(noQuery));
    try {
      const match = fs.readdirSync(dir).find(f => f.startsWith("_payload.json"));
      if (match) candidates.unshift(path.join(dir, match));
    } catch (e) {}
  }

  const filePath = firstExisting(candidates);

  if (!filePath) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("Not found");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    const ext = path.extname(noQuery) || path.extname(filePath.split("?")[0]);
    res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
    res.end(data);
  });
}).listen(8080, () => {
  console.log("Debug Techstudio site running at http://localhost:8080");
});
