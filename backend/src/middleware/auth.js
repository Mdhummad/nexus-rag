/**
 * API Key Authentication Middleware
 *
 * Set API_KEY env var to enable auth.
 * Leave unset for open access (useful for local development).
 *
 * Clients must send one of:
 *   X-API-Key: <key>
 *   Authorization: Bearer <key>
 */
export function apiKeyAuth(req, res, next) {
    const requiredKey = process.env.API_KEY;

    // Dev mode — no API_KEY set, skip auth
    if (!requiredKey) return next();

    // Extract key from header
    const provided =
        req.headers["x-api-key"] ??
        (req.headers["authorization"]?.startsWith("Bearer ")
            ? req.headers["authorization"].slice(7).trim()
            : null);

    if (!provided || provided !== requiredKey) {
        return res.status(401).json({
            error: "Unauthorized — provide a valid API key via X-API-Key header or Authorization: Bearer <key>",
        });
    }

    next();
}
