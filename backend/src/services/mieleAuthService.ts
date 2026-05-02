import axios from 'axios';
import qs from 'qs';
import pool from '../db';

interface MieleTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

let currentTokens: MieleTokens | null = null;
let refreshTimeout: NodeJS.Timeout | null = null;

export const setTokens = async (tokens: MieleTokens) => {
  currentTokens = tokens;
  console.log('[mieleAuth]: Tokens stored in memory.');

  try {
    await pool.query('DELETE FROM miele_oauth_tokens');
    await pool.query(
      'INSERT INTO miele_oauth_tokens (access_token, refresh_token, expires_in) VALUES ($1, $2, $3)',
      [tokens.access_token, tokens.refresh_token, tokens.expires_in]
    );
    console.log('[mieleAuth]: Tokens persisted to DB.');
  } catch (err) {
    console.error('[mieleAuth]: Failed to persist tokens to DB', err);
  }
  
  // Schedule refresh 5 minutes before expiration
  if (refreshTimeout) clearTimeout(refreshTimeout);
  const refreshInMs = (tokens.expires_in - 300) * 1000;
  if (refreshInMs > 0) {
    refreshTimeout = setTimeout(refreshMieleToken, refreshInMs);
  }
};

export const loadTokensFromDB = async () => {
  try {
    const result = await pool.query('SELECT * FROM miele_oauth_tokens ORDER BY updated_at DESC LIMIT 1');
    if (result.rows.length > 0) {
      const tokens = result.rows[0];
      currentTokens = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in
      };
      console.log('[mieleAuth]: Restored tokens from DB.');
      
      // Verify access token by refreshing it immediately or trying a simple call (or just schedule next refresh)
      // Since we don't know when they expired, let's trigger an early refresh to make sure!
      console.log('[mieleAuth]: Triggering token refresh after DB load...');
      await refreshMieleToken();
    }
  } catch (err) {
    console.error('[mieleAuth]: Failed to load tokens from DB', err);
  }
};

export const getAccessToken = () => currentTokens?.access_token;
export const isConnected = () => !!currentTokens;

export const exchangeCodeForToken = async (code: string) => {
  const tokenUrl = 'https://auth.domestic.miele-iot.com/partner/realms/mcs/protocol/openid-connect/token';
  const clientId = process.env.MIELE_CLIENT_ID;
  const clientSecret = process.env.MIELE_CLIENT_SECRET;
  const { getConfig } = require('./configService');
  const redirectUri = `${getConfig().system.baseUrl}/api/miele/callback`;

  try {
    const response = await axios.post(
      tokenUrl,
      qs.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    await setTokens(response.data);
    return response.data;
  } catch (error: any) {
    console.error('[mieleAuth]: Token exchange failed:', error.response?.data || error.message);
    throw new Error('Failed to exchange code for token');
  }
};

export const refreshMieleToken = async (retryCount = 0) => {
  if (!currentTokens?.refresh_token) return;

  const tokenUrl = 'https://auth.domestic.miele-iot.com/partner/realms/mcs/protocol/openid-connect/token';
  const clientId = process.env.MIELE_CLIENT_ID;
  const clientSecret = process.env.MIELE_CLIENT_SECRET;

  try {
    const response = await axios.post(
      tokenUrl,
      qs.stringify({
        grant_type: 'refresh_token',
        refresh_token: currentTokens.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    await setTokens(response.data);
    console.log('[mieleAuth]: Token refreshed successfully.');
  } catch (error: any) {
    console.error(`[mieleAuth]: Token refresh failed (attempt ${retryCount + 1}):`, error.response?.data || error.message);
    
    if (retryCount < 5) {
      const delay = Math.pow(2, retryCount) * 5000; // 5s, 10s, 20s, 40s, 80s
      console.log(`[mieleAuth]: Retrying refresh in ${delay / 1000}s...`);
      setTimeout(() => refreshMieleToken(retryCount + 1), delay);
    } else {
      console.error('[mieleAuth]: Max retries reached for token refresh.');
    }
  }
};

export const disconnectMiele = async () => {
  const logoutUrl = 'https://auth.domestic.miele-iot.com/partner/realms/mcs/protocol/openid-connect/logout';
  const clientId = process.env.MIELE_CLIENT_ID;
  const clientSecret = process.env.MIELE_CLIENT_SECRET;

  if (currentTokens?.refresh_token) {
    try {
      const qs = require('qs');
      await axios.post(
        logoutUrl,
        qs.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: currentTokens.refresh_token,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      console.log('[mieleAuth]: Cloud logout executed successfully.');
    } catch (logoutError: any) {
      console.error('[mieleAuth]: Cloud logout failed:', logoutError.response?.data || logoutError.message);
    }
  }

  currentTokens = null;
  if (refreshTimeout) clearTimeout(refreshTimeout);
  try {
    await pool.query('DELETE FROM miele_oauth_tokens');
    console.log('[mieleAuth]: Cleared tokens from DB.');
  } catch (err) {
    console.error('[mieleAuth]: Failed to clear tokens from DB', err);
  }
  console.log('[mieleAuth]: Disconnected.');
};
