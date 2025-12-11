import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('❌ No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Não autorizado - token necessário' }), 
        { status: 401, headers: corsHeaders }
      );
    }

    // Create client with user token for auth verification
    const userSupabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: userError } = await userSupabase.auth.getUser();

    if (userError || !user) {
      console.log('❌ User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }), 
        { status: 401, headers: corsHeaders }
      );
    }

    console.log('✅ User authenticated:', user.email);

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      console.log('❌ User is not admin:', profile?.role);
      return new Response(
        JSON.stringify({ error: 'Acesso negado - apenas administradores' }), 
        { status: 403, headers: corsHeaders }
      );
    }

    console.log('🗑️ Starting data reset for admin user:', user.id);

    // Delete all demo data
    console.log('🧹 Deleting expenses...');
    const { count: expensesCount } = await supabase
      .from('expenses')
      .delete({ count: 'exact' })
      .eq('user_id', user.id);

    console.log('🧹 Deleting notifications...');
    const { count: notificationsCount } = await supabase
      .from('notifications')
      .delete({ count: 'exact' })
      .eq('user_id', user.id);

    console.log('🧹 Deleting price monitoring jobs...');
    const { count: monitoringCount } = await supabase
      .from('price_monitoring_jobs')
      .delete({ count: 'exact' })
      .eq('user_id', user.id);

    console.log('🧹 Deleting orders...');
    const { count: ordersCount } = await supabase
      .from('orders')
      .delete({ count: 'exact' })
      .eq('user_id', user.id);

    console.log('🧹 Deleting products...');
    const { count: productsCount } = await supabase
      .from('products')
      .delete({ count: 'exact' })
      .eq('user_id', user.id);

    console.log('✅ Data reset completed successfully');

    return new Response(
      JSON.stringify({ 
        message: 'Todos os dados de demonstração foram removidos!',
        summary: {
          products: productsCount || 0,
          orders: ordersCount || 0,
          monitoring_jobs: monitoringCount || 0,
          notifications: notificationsCount || 0,
          expenses: expensesCount || 0
        }
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error in reset-admin-data:', error);
    return new Response(
      JSON.stringify({ error: `Erro interno: ${error.message}` }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
