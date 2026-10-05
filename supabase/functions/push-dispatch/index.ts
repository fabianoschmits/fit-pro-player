import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import webPush from 'npm:web-push@3.6.7';
import { createDispatchHandler } from './handler.mjs';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
let db = null;
let firebase = null;
try {
  const value = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (value && value.length <= 32768) firebase = JSON.parse(value);
} catch {
  // Optional native credentials never prevent configured Web Push delivery.
}
if (supabaseUrl && serviceKey) {
  try {
    db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  } catch {
    // A misconfigured instance serves a generic error without exposing credentials.
  }
}

Deno.serve(createDispatchHandler({
  db,
  config: {
    dispatchSecret: Deno.env.get('PUSH_DISPATCH_SECRET'),
    firebase,
    vapid: {
      publicKey: Deno.env.get('VAPID_PUBLIC_KEY'),
      privateKey: Deno.env.get('VAPID_PRIVATE_KEY'),
      subject: Deno.env.get('VAPID_SUBJECT'),
    },
  },
  generateRequestDetails: webPush.generateRequestDetails.bind(webPush),
}));
