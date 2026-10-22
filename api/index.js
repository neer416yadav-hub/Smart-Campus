// Vercel serverless entry point.
//
// server.js builds an Express app for a long-running process (it calls
// app.listen when run directly). Vercel functions are invoked per request, so
// this file creates the app once per function instance and forwards every
// request to it.

const { createApp } = require("../server");

let app = null;
let startupError = null;

try {
    app = createApp({ serverless: true });
} catch (error) {
    startupError = error;
}

function sendJson(response, statusCode, payload) {
    const body = JSON.stringify(payload, null, 2);

    response.statusCode = statusCode;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("cache-control", "no-store");
    response.end(body);
}

module.exports = async function handler(request, response) {
    if (!app) {
        console.error("Smart Campus could not start:", startupError.message);

        return sendJson(response, 500, {
            error: "Smart Campus could not start.",
            detail: startupError.message,
            hint:
                "Add DATABASE_URL, ADMIN_USERNAME and ADMIN_PASSWORD (12+ characters) " +
                "in Vercel → Project → Settings → Environment Variables, then redeploy."
        });
    }

    try {
        await app.locals.ready;
    } catch (error) {
        console.error(error.message || error);

        return sendJson(response, 503, {
            error: "Smart Campus could not connect to the database.",
            detail: error.message
        });
    }

    return app(request, response);
};
