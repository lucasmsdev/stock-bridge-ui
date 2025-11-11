import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🛍️ Shopify callback received');
    
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const shop = url.searchParams.get('shop');
    const state = url.searchParams.get('state');
    const hmac = url.searchParams.get('hmac');

    console.log('Callback params:', { shop, state, hasCode: !!code, hasHmac: !!hmac });

    // Validate required parameters
    if (!code || !shop || !state) {
      console.error('Missing required parameters');
      return new Response(
        `<html><body><h1>Erro de Autenticação</h1><p>Parâmetros inválidos recebidos do Shopify.</p><a href="${Deno.env.get('APP_URL') || 'https://fcvwogaqarkuqvumyqqm.supabase.co'}/app/integrations">Voltar</a></body></html>`,
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Clean shop domain (remove .myshopify.com if present)
    const shopDomain = shop.replace('.myshopify.com', '');
    console.log('Shop domain:', shopDomain);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify that the state matches a valid user_id
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(state);
    
    if (userError || !userData.user) {
      console.error('Invalid state/user_id:', userError);
      return new Response(
        `<html><body><h1>Erro de Autenticação</h1><p>Sessão inválida. Por favor, tente conectar novamente.</p><a href="${Deno.env.get('APP_URL') || 'https://fcvwogaqarkuqvumyqqm.supabase.co'}/app/integrations">Voltar</a></body></html>`,
        { status: 401, headers: { 'Content-Type': 'text/html' } }
      );
    }

    const userId = userData.user.id;
    console.log('User ID from state:', userId);

    // Exchange code for access token
    const shopifyClientId = Deno.env.get('SHOPIFY_CLIENT_ID')!;
    const shopifyClientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET')!;

    console.log('Exchanging code for access token...');
    
    const tokenResponse = await fetch(`https://${shopDomain}.myshopify.com/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: shopifyClientId,
        client_secret: shopifyClientSecret,
        code: code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return new Response(
        `<html><body><h1>Erro de Autenticação</h1><p>Não foi possível obter token de acesso do Shopify.</p><a href="${Deno.env.get('APP_URL') || 'https://fcvwogaqarkuqvumyqqm.supabase.co'}/app/integrations">Voltar</a></body></html>`,
        { status: 500, headers: { 'Content-Type': 'text/html' } }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log('✅ Access token obtained');

    // Fetch shop information to get the shop name
    console.log('Fetching shop information...');
    const shopInfoResponse = await fetch(`https://${shopDomain}.myshopify.com/admin/api/2023-10/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
      },
    });

    let accountName = shopDomain;
    if (shopInfoResponse.ok) {
      const shopInfo = await shopInfoResponse.json();
      accountName = shopInfo.shop?.name || shopDomain;
      console.log('Shop name:', accountName);
    }

    // Sempre insere uma nova integração (suporta múltiplas contas)
    // Mas verifica se já não existe o mesmo shop_domain
    console.log('Saving integration to database...');
    
    const { data: existingIntegrations, error: checkError } = await supabase
      .from('integrations')
      .select('id, shop_domain')
      .eq('user_id', userId)
      .eq('platform', 'shopify')
      .eq('shop_domain', shopDomain);

    if (!checkError && existingIntegrations && existingIntegrations.length > 0) {
      console.log('⚠️ Loja Shopify já conectada:', shopDomain);
      const appUrl = Deno.env.get('APP_URL') || 'https://fcvwogaqarkuqvumyqqm.supabase.co';
      const redirectUrl = `${appUrl}/app/integrations?status=duplicate`;
      return Response.redirect(redirectUrl, 302);
    }
    
    const { error: insertError } = await supabase
      .from('integrations')
      .insert({
        user_id: userId,
        platform: 'shopify',
        access_token: accessToken,
        shop_domain: shopDomain,
        account_name: accountName,
      });

    if (insertError) {
      console.error('Database error:', insertError);
      return new Response(
        `<html><body><h1>Erro ao Salvar</h1><p>Não foi possível salvar a integração no banco de dados.</p><a href="${Deno.env.get('APP_URL') || 'https://fcvwogaqarkuqvumyqqm.supabase.co'}/app/integrations">Voltar</a></body></html>`,
        { status: 500, headers: { 'Content-Type': 'text/html' } }
      );
    }

    console.log('✅ Integration saved successfully');

    // Redirect to integrations page with success message
    const appUrl = Deno.env.get('APP_URL') || 'https://preview--stock-bridge-ui.lovable.app';
    const redirectUrl = `${appUrl}/app/integrations?status=success`;
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl,
      },
    });

  } catch (error) {
    console.error('Unexpected error in Shopify callback:', error);
    return new Response(
      `<html><body><h1>Erro Inesperado</h1><p>Ocorreu um erro ao processar o callback do Shopify.</p><a href="${Deno.env.get('APP_URL') || 'https://fcvwogaqarkuqvumyqqm.supabase.co'}/app/integrations">Voltar</a></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
});
