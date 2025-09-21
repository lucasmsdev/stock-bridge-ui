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

    console.log('🔧 Starting data seeding for admin user:', user.id);

    // Clean existing data
    console.log('🧹 Cleaning existing data...');
    await supabase.from('price_monitoring_jobs').delete().eq('user_id', user.id);
    await supabase.from('orders').delete().eq('user_id', user.id);
    await supabase.from('products').delete().eq('user_id', user.id);

    // Create sample products
    console.log('📦 Creating sample products...');
    const products = [
      {
        user_id: user.id,
        name: 'Monitor Gamer UltraWide 34" LG 144Hz',
        sku: 'LG-UW34-144',
        stock: 15,
        selling_price: 2899.90,
        cost_price: 2100.00,
        ad_spend: 150.00,
        image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400'
      },
      {
        user_id: user.id,
        name: 'Teclado Mecânico RGB TKL Corsair',
        sku: 'CORS-K70-RGB',
        stock: 45,
        selling_price: 549.90,
        cost_price: 380.00,
        ad_spend: 80.00,
        image_url: 'https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=400'
      },
      {
        user_id: user.id,
        name: 'Mouse Gamer Sem Fio Logitech G Pro X',
        sku: 'LOGI-GPROX-WL',
        stock: 30,
        selling_price: 699.00,
        cost_price: 480.00,
        ad_spend: 120.00,
        image_url: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400'
      },
      {
        user_id: user.id,
        name: 'Headset Gamer HyperX Cloud III',
        sku: 'HX-CLOUD3-BK',
        stock: 25,
        selling_price: 899.00,
        cost_price: 620.00,
        ad_spend: 95.00,
        image_url: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400'
      },
      {
        user_id: user.id,
        name: 'Webcam 4K Logitech Brio Stream',
        sku: 'LOGI-BRIO-4K',
        stock: 12,
        selling_price: 1299.00,
        cost_price: 890.00,
        ad_spend: 180.00,
        image_url: 'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=400'
      }
    ];

    const { error: productsError } = await supabase.from('products').insert(products);
    if (productsError) throw productsError;

    // Get inserted products for orders
    const { data: insertedProducts } = await supabase
      .from('products')
      .select('id, name, selling_price')
      .eq('user_id', user.id);

    // Create sample orders
    console.log('📋 Creating sample orders...');
    const platforms = ['mercadolivre', 'amazon', 'shopee'];
    const orders = [];

    for (let i = 0; i < 30; i++) {
      const randomProduct = insertedProducts[Math.floor(Math.random() * insertedProducts.length)];
      const quantity = Math.floor(Math.random() * 3) + 1;
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - i);

      orders.push({
        user_id: user.id,
        order_id_channel: `ORD-${Date.now()}-${i}`,
        platform: platforms[Math.floor(Math.random() * platforms.length)],
        total_value: Number((randomProduct.selling_price * quantity).toFixed(2)),
        order_date: orderDate.toISOString(),
        items: [
          {
            product_id: randomProduct.id,
            product_name: randomProduct.name,
            quantity: quantity,
            unit_price: randomProduct.selling_price,
            total_price: randomProduct.selling_price * quantity
          }
        ]
      });
    }

    const { error: ordersError } = await supabase.from('orders').insert(orders);
    if (ordersError) throw ordersError;

    // Create sample price monitoring jobs
    console.log('📊 Creating sample price monitoring jobs...');
    const monitoringJobs = insertedProducts.slice(0, 3).map((product, index) => ({
      user_id: user.id,
      product_id: product.id,
      competitor_url: `https://mercadolivre.com.br/produto-${index + 1}`,
      trigger_condition: index === 0 ? 'price_decrease' : 'price_increase',
      last_price: Number((product.selling_price * (0.9 + Math.random() * 0.2)).toFixed(2)),
      is_active: true
    }));

    const { error: monitoringError } = await supabase.from('price_monitoring_jobs').insert(monitoringJobs);
    if (monitoringError) throw monitoringError;

    // Create sample notifications
    console.log('🔔 Creating sample notifications...');
    const notifications = [
      {
        user_id: user.id,
        type: 'price_alert',
        title: 'Alerta de Preço',
        message: 'O preço do Monitor Gamer UltraWide diminuiu em 5%',
        is_read: false
      },
      {
        user_id: user.id,
        type: 'stock_alert',
        title: 'Estoque Baixo',
        message: 'Webcam 4K Logitech está com estoque baixo (12 unidades)',
        is_read: false
      },
      {
        user_id: user.id,
        type: 'general',
        title: 'Vendas em Alta',
        message: 'Suas vendas aumentaram 23% esta semana!',
        is_read: true
      }
    ];

    const { error: notificationsError } = await supabase.from('notifications').insert(notifications);
    if (notificationsError) throw notificationsError;

    console.log('✅ Data seeding completed successfully');

    return new Response(
      JSON.stringify({ 
        message: 'Dados de demonstração criados com sucesso!',
        summary: {
          products: products.length,
          orders: orders.length,
          monitoring_jobs: monitoringJobs.length,
          notifications: notifications.length
        }
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error in seed-admin-account:', error);
    return new Response(
      JSON.stringify({ error: `Erro interno: ${error.message}` }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});