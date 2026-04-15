function Router() {
  const routes = [];

  function addRoute(method, path, handlers) {
    const paramNames = [];
    const pattern = path.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return "([^/]+)";
    });
    const regex = new RegExp("^" + pattern + "$");
    routes.push({ method: method.toUpperCase(), path, regex, paramNames, handlers });
  }

  const router = {
    get(path, ...handlers) { addRoute("GET", path, handlers); return router; },
    post(path, ...handlers) { addRoute("POST", path, handlers); return router; },
    put(path, ...handlers) { addRoute("PUT", path, handlers); return router; },
    patch(path, ...handlers) { addRoute("PATCH", path, handlers); return router; },
    delete(path, ...handlers) { addRoute("DELETE", path, handlers); return router; },
    routes,
  };

  return router;
}

module.exports = { Router };
