import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado - token necessário' }), 
        { status: 401, headers: corsHeaders }
      );
    }

    const userSupabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userSupabase.auth.getUser();
    if (userError || !user) {
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
      return new Response(
        JSON.stringify({ error: 'Acesso negado - apenas administradores' }), 
        { status: 403, headers: corsHeaders }
      );
    }

    console.log('🔧 Starting DASHBOARD data seeding for admin user:', user.id);

    // Clean existing orders and products
    console.log('🧹 Cleaning existing orders and products...');
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
    if (productsError) {
      console.error('Error inserting products:', productsError);
      throw productsError;
    }
    console.log('✅ Products created:', products.length);

    // Get inserted products for orders
    const { data: insertedProducts, error: fetchError } = await supabase
      .from('products')
      .select('id, name, selling_price')
      .eq('user_id', user.id);

    if (fetchError || !insertedProducts || insertedProducts.length === 0) {
      console.error('Error fetching products:', fetchError);
      throw new Error('Falha ao buscar produtos criados');
    }
    console.log('✅ Fetched products:', insertedProducts.length);

    // Create sample orders
    console.log('📋 Creating sample orders...');
    const platforms = ['mercadolivre', 'amazon', 'shopee', 'shopify'];
    const orders = [];

    const now = new Date();
    
    // Create 60 orders spread over 30 days, with 15 orders for TODAY
    for (let i = 0; i < 60; i++) {
      const randomProduct = insertedProducts[Math.floor(Math.random() * insertedProducts.length)];
      const quantity = Math.floor(Math.random() * 4) + 1;
      
      let orderDate: Date;
      
      if (i < 15) {
        // Orders for TODAY - create with current UTC date minus some minutes
        orderDate = new Date(now.getTime() - (i * 30 * 60 * 1000));
      } else if (i < 30) {
        // Orders from last 7 days
        const daysAgo = Math.floor((i - 15) / 2) + 1;
        orderDate = new Date(now);
        orderDate.setDate(orderDate.getDate() - daysAgo);
        orderDate.setHours(10 + (i % 8), i % 60, 0, 0);
      } else {
        // Orders from last 30 days
        const daysAgo = Math.floor((i - 30) / 2) + 8;
        orderDate = new Date(now);
        orderDate.setDate(orderDate.getDate() - daysAgo);
        orderDate.setHours(10 + (i % 8), i % 60, 0, 0);
      }

      orders.push({
        user_id: user.id,
        order_id_channel: `ORD-${Date.now()}-${i}`,
        platform: platforms[i % platforms.length],
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
    
    console.log(`📊 Creating ${orders.length} orders, first 15 are for today`);
    console.log('Sample order dates:', orders.slice(0, 3).map(o => o.order_date));

    const { error: ordersError } = await supabase.from('orders').insert(orders);
    if (ordersError) {
      console.error('Error inserting orders:', ordersError);
      throw ordersError;
    }
    console.log('✅ Orders created successfully');

    return new Response(
      JSON.stringify({ 
        message: 'Dados do Dashboard criados com sucesso!',
        summary: {
          products: products.length,
          orders: orders.length
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error in seed-dashboard-data:', error);
    return new Response(
      JSON.stringify({ error: `Erro interno: ${error.message}` }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
