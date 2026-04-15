const http = require("http");
const { URL } = require("url");

function createApp() {
  const mountedRouters = [];

  function use(prefix, router) {
    mountedRouters.push({ prefix, routes: router.routes });
  }

  function listen(port, cb) {
    const server = http.createServer(async (req, res) => {
      try {
        await handleRequest(req, res);
      } catch (err) {
        console.log("Unhandled error:", err.message);
        if (!res.writableEnded) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: "Internal server error" }));
        }
      }
    });
    server.listen(port, cb);
    return server;
  }

  async function handleRequest(req, res) {
    // Parse URL
    const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = parsedUrl.pathname;
    req.query = Object.fromEntries(parsedUrl.searchParams.entries());

    // Parse cookies
    req.cookies = parseCookies(req.headers.cookie || "");

    // Add response helpers
    addResponseHelpers(res);

    // CORS
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    // Handle preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Parse JSON body for methods that typically have a body
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      req.body = await parseBody(req);
    } else {
      req.body = {};
    }

    // Match route
    for (const { prefix, routes } of mountedRouters) {
      if (!pathname.startsWith(prefix)) continue;
      const subPath = pathname.slice(prefix.length) || "/";

      for (const route of routes) {
        if (route.method !== req.method) continue;
        const match = subPath.match(route.regex);
        if (!match) continue;

        // Extract params
        req.params = {};
        route.paramNames.forEach((name, i) => {
          req.params[name] = decodeURIComponent(match[i + 1]);
        });

        // Run middleware chain
        await runHandlers(route.handlers, req, res);
        return;
      }
    }

    // No route matched
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Not found" }));
  }

  return { use, listen };
}

function addResponseHelpers(res) {
  let statusCode = 200;
  const cookieHeaders = [];

  res.status = function (code) {
    statusCode = code;
    return res;
  };

  res.json = function (data) {
    if (res.writableEnded) return;
    const body = JSON.stringify(data);
    if (cookieHeaders.length > 0) {
      // Collect all headers before writeHead
      const headers = {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      };
      // Preserve any headers already set (like CORS)
      res.writeHead(statusCode, headers);
      // Set-Cookie headers were already added via setHeader
    } else {
      res.writeHead(statusCode, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      });
    }
    res.end(body);
  };

  res.send = function (data) {
    if (res.writableEnded) return;
    const body = typeof data === "string" ? data : String(data);
    res.writeHead(statusCode, {
      "Content-Length": Buffer.byteLength(body),
    });
    res.end(body);
  };

  res.cookie = function (name, value, options = {}) {
    const parts = [`${name}=${encodeURIComponent(value)}`];
    if (options.httpOnly) parts.push("HttpOnly");
    if (options.secure) parts.push("Secure");
    if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
    if (options.maxAge != null) parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
    if (options.path) parts.push(`Path=${options.path}`);
    const cookieStr = parts.join("; ");
    cookieHeaders.push(cookieStr);
    // Use append to allow multiple Set-Cookie headers
    res.appendHeader ? res.appendHeader("Set-Cookie", cookieStr) : (() => {
      const existing = res.getHeader("Set-Cookie") || [];
      const arr = Array.isArray(existing) ? existing : [existing];
      arr.push(cookieStr);
      res.setHeader("Set-Cookie", arr);
    })();
  };

  res.clearCookie = function (name, options = {}) {
    res.cookie(name, "", { ...options, maxAge: 0 });
  };
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx < 0) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    try {
      cookies[key] = decodeURIComponent(val);
    } catch {
      cookies[key] = val;
    }
  });
  return cookies;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) return resolve({});
      const contentType = req.headers["content-type"] || "";
      if (contentType.includes("application/json")) {
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve({});
        }
      } else {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

async function runHandlers(handlers, req, res) {
  let idx = 0;
  async function next() {
    if (idx >= handlers.length) return;
    if (res.writableEnded) return;
    const handler = handlers[idx++];
    await handler(req, res, next);
  }
  await next();
}

module.exports = createApp;
