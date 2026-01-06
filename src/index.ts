import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { Moodboard3DMCP } from "./server";
import { AuthkitHandler } from "./auth/authkit-handler";
import { handleApiKeyRequest } from "./api-key-handler";
import type { Env } from "./types";
import { logger } from "./shared/logger";

// Export the McpAgent class for Cloudflare Workers
export { Moodboard3DMCP };

/**
 * 3D Abstract Moodboard MCP Server with Dual Authentication Support
 *
 * This MCP server supports TWO authentication methods:
 *
 * 1. OAuth 2.1 (WorkOS AuthKit) - For OAuth-capable clients
 *    - Flow: Client -> /authorize -> WorkOS -> Magic Auth -> /callback -> Tools
 *    - Endpoints: /authorize, /callback, /token, /register
 *
 * 2. API Key Authentication - For non-OAuth clients
 *    - Flow: Client sends Authorization: Bearer wtyk_XXX -> Validate -> Tools
 *    - Endpoints: /mcp (with wtyk_ API key in header)
 *
 * MCP Endpoints (support both auth methods):
 * - /mcp - HTTP transport (JSON-RPC over HTTP)
 *
 * OAuth Endpoints (OAuth only):
 * - /authorize - Initiates OAuth flow, redirects to WorkOS AuthKit
 * - /callback - Handles OAuth callback from WorkOS
 * - /token - Token endpoint for OAuth clients
 * - /register - Dynamic Client Registration endpoint
 */

// Create OAuthProvider instance
const oauthProvider = new OAuthProvider({
    apiHandlers: {
        '/mcp': Moodboard3DMCP.serve('/mcp'),
    },
    defaultHandler: AuthkitHandler as any,
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/token",
    clientRegistrationEndpoint: "/register",
});

/**
 * Custom fetch handler with dual authentication support
 */
export default {
    async fetch(
        request: Request,
        env: Env,
        ctx: ExecutionContext
    ): Promise<Response> {
        try {
            const url = new URL(request.url);
            const authHeader = request.headers.get("Authorization");

            // Check for API key authentication on MCP endpoints
            if (isApiKeyRequest(url.pathname, authHeader)) {
                logger.info({ event: 'transport_request', transport: 'http', method: 'api_key', user_email: '' });
                return await handleApiKeyRequest(request, env, ctx, url.pathname);
            }

            // Otherwise, use OAuth flow
            logger.info({ event: 'transport_request', transport: 'http', method: 'oauth', user_email: '' });
            return await oauthProvider.fetch(request, env, ctx);

        } catch (error) {
            logger.error({ event: 'server_error', error: String(error), context: 'Dual auth handler' });
            return new Response(
                JSON.stringify({
                    error: "Internal server error",
                    message: error instanceof Error ? error.message : String(error),
                }),
                {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }
    },
};

/**
 * Detect if request should use API key authentication
 */
function isApiKeyRequest(pathname: string, authHeader: string | null): boolean {
    if (pathname !== "/mcp") {
        return false;
    }
    if (!authHeader) {
        return false;
    }
    const token = authHeader.replace("Bearer ", "");
    return token.startsWith("wtyk_");
}
