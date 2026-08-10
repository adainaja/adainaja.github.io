/**
 * AdaAja — Supabase Client Configuration
 * Publishable key aman digunakan di browser selama RLS aktif.
 */
(() => {
  const SUPABASE_URL = "https://fovckdzsqkyxtaurpyxs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_ZNehT7R93g_m1789GYI5xA_e5CGekpF";

  if (!window.supabase?.createClient) {
    throw new Error("Supabase JavaScript SDK belum berhasil dimuat.");
  }

  window.adaajaSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce"
      }
    }
  );

  window.ADAAJA_AUTH_CALLBACK_URL =
    new URL("auth-callback.html", window.location.href).href;

  window.ADAAJA_MIDTRANS_CLIENT_KEY = "Mid-client-xf0ZLafY1ZaMFm3Y";

})();
