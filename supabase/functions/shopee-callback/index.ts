import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const shopId = url.searchParams.get("shop_id");
    const userId = url.searchParams.get("state");
    const APP_URL = Deno.env.get("APP_URL") || "https://id-preview--be7c1eba-2174-4e2e-a9f0-aa07602a3be7.lovable.app";

    if (!code || !shopId || !userId) {
      console.error("Missing params:", { code: !!code, shopId: !!shopId, userId: !!userId });
      return Response.redirect(`${APP_URL}/app/integrations?status=error&message=missing_params`, 302);
    }

    const PARTNER_ID = Deno.env.get("SHOPEE_PARTNER_ID")?.trim()?.replace(/[^\d]/g, '') || "";
    const PARTNER_KEY = (Deno.env.get("SHOPEE_PARTNER_KEY")?.trim() || "").replace(/[\s\u200B\u200C\u200D\uFEFF\u00A0]/g, '');
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const partnerId = parseInt(PARTNER_ID);
    const timestamp = Math.floor(Date.now() / 1000);

    // Generate sign for token exchange: HMAC-SHA256(partner_key, partner_id + path + timestamp)
    const path = "/api/v2/auth/token/get";
    const baseString = `${partnerId}${path}${timestamp}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(PARTNER_KEY),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(baseString));
    const sign = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    // Exchange code for tokens
    const tokenUrl = `https://partner.test-stable.shopeemobile.com${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

    console.log("🟠 Exchanging Shopee auth code for tokens...");

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        shop_id: parseInt(shopId),
        partner_id: partnerId,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error || !tokenData.access_token) {
      console.error("Shopee token exchange error:", tokenData);
      return Response.redirect(`${APP_URL}/app/integrations?status=error&message=token_exchange_failed`, 302);
    }

    console.log("✅ Shopee tokens received successfully");

    // Save to database using service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check for existing integration
    const { data: existing } = await supabase
      .from("integrations")
      .select("id")
      .eq("user_id", userId)
      .eq("platform", "shopee")
      .eq("shop_domain", shopId)
      .maybeSingle();

    if (existing) {
      console.log("🔄 Updating existing Shopee integration");
      // Update existing
      const { error: updateError } = await supabase
        .from("integrations")
        .update({
          encrypted_access_token: supabase.rpc("encrypt_token", { token: tokenData.access_token }),
          encrypted_refresh_token: tokenData.refresh_token
            ? supabase.rpc("encrypt_token", { token: tokenData.refresh_token })
            : null,
          token_expires_at: tokenData.expire_in
            ? new Date(Date.now() + tokenData.expire_in * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("Error updating integration:", updateError);
        return Response.redirect(`${APP_URL}/app/integrations?status=error`, 302);
      }

      return Response.redirect(`${APP_URL}/app/integrations?status=success`, 302);
    }

    // Encrypt tokens via DB function
    const { data: encAccessToken } = await supabase.rpc("encrypt_token", { token: tokenData.access_token });
    const { data: encRefreshToken } = tokenData.refresh_token
      ? await supabase.rpc("encrypt_token", { token: tokenData.refresh_token })
      : { data: null };

    // Get user's org
    const { data: orgId } = await supabase.rpc("get_user_org_id", { user_uuid: userId });

    const { error: insertError } = await supabase.from("integrations").insert({
      user_id: userId,
      platform: "shopee",
      encrypted_access_token: encAccessToken,
      encrypted_refresh_token: encRefreshToken,
      shop_domain: shopId,
      account_name: `Shopee Loja ${shopId}`,
      organization_id: orgId,
      token_expires_at: tokenData.expire_in
        ? new Date(Date.now() + tokenData.expire_in * 1000).toISOString()
        : null,
    });

    if (insertError) {
      console.error("Error inserting integration:", insertError);
      return Response.redirect(`${APP_URL}/app/integrations?status=error`, 302);
    }

    console.log("✅ Shopee integration saved successfully");
    return Response.redirect(`${APP_URL}/app/integrations?status=success`, 302);
  } catch (error) {
    console.error("Shopee callback error:", error);
    const APP_URL = Deno.env.get("APP_URL") || "https://id-preview--be7c1eba-2174-4e2e-a9f0-aa07602a3be7.lovable.app";
    return Response.redirect(`${APP_URL}/app/integrations?status=error`, 302);
  }
});
