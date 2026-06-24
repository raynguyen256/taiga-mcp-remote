import express, { Router } from 'express';
import { InvalidGrantError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { TaigaOAuthProvider } from '../../oauth/TaigaOAuthProvider.js';
import {
  InvalidTaigaCredentialsError,
  TaigaUpstreamError,
} from '../../session/sessionService.js';

export function createOAuthInteractionRouter(provider: TaigaOAuthProvider): Router {
  const router = Router();

  router.use(express.urlencoded({ extended: false }));

  router.post('/authorize/submit', async (req, res) => {
    const { request_id, username, password } = req.body as {
      request_id?: string;
      username?: string;
      password?: string;
    };

    if (!request_id) {
      res.status(400).send('Missing authorization request.');
      return;
    }

    const pending = provider.getPendingAuthorization(request_id);
    if (!pending) {
      res.status(400).send('Authorization request expired. Restart the login flow from your MCP client.');
      return;
    }

    try {
      const redirectUrl = await provider.completeAuthorization(
        request_id,
        username?.trim() ?? '',
        password ?? '',
      );
      res.redirect(302, redirectUrl);
    } catch (err) {
      if (err instanceof InvalidTaigaCredentialsError) {
        res.status(401).type('html').send(
          provider.renderAuthorizationPage(
            pending,
            'Invalid Taiga username/email or password.',
          ),
        );
        return;
      }

      if (err instanceof TaigaUpstreamError) {
        res.status(502).type('html').send(
          provider.renderAuthorizationPage(
            pending,
            'Taiga is unavailable right now. Try again in a moment.',
          ),
        );
        return;
      }

      if (err instanceof InvalidGrantError) {
        res.status(400).send(err.message);
        return;
      }

      res.status(500).send('Unexpected authorization error.');
    }
  });

  return router;
}
