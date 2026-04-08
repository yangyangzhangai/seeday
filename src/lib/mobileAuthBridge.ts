import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { supabase } from '../api/supabase';

const OAUTH_CALLBACK_PATH = '/auth/callback';

let initialized = false;

function parseHashParams(hash: string): URLSearchParams {
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
  return new URLSearchParams(normalized);
}

function isSupportedOAuthCallbackUrl(parsed: URL): boolean {
  if (parsed.pathname.endsWith(OAUTH_CALLBACK_PATH)) return true;
  return parsed.hostname === 'auth' && parsed.pathname === '/callback';
}

async function handleOAuthCallbackUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return;
  }

  if (!isSupportedOAuthCallbackUrl(parsed)) return;

  const code = parsed.searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error && import.meta.env.DEV) {
      console.warn('[mobileAuthBridge] exchangeCodeForSession failed', error);
    }
    return;
  }

  const hashParams = parseHashParams(parsed.hash);
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  if (!accessToken || !refreshToken) return;

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error && import.meta.env.DEV) {
    console.warn('[mobileAuthBridge] setSession failed', error);
  }
}

export async function setupMobileAuthBridge(): Promise<void> {
  if (initialized || !Capacitor.isNativePlatform()) return;
  initialized = true;

  const launch = await App.getLaunchUrl();
  if (launch?.url) {
    await handleOAuthCallbackUrl(launch.url);
  }

  await App.addListener('appUrlOpen', ({ url }) => {
    void handleOAuthCallbackUrl(url);
  });
}
