import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper functions
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min: number, max: number) => Math.random() * (max - min) + min;
const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const brazilianFirstNames = [
  'João', 'Maria', 'Pedro', 'Ana', 'Lucas', 'Juliana', 'Carlos', 'Fernanda', 
  'Rafael', 'Beatriz', 'Gabriel', 'Larissa', 'Matheus', 'Camila', 'Bruno',
  'Amanda', 'Felipe', 'Letícia', 'Gustavo', 'Mariana', 'Leonardo', 'Isabela',
  'Rodrigo', 'Carolina', 'André', 'Natália', 'Thiago', 'Patrícia', 'Diego',
  'Vanessa', 'Eduardo', 'Renata', 'Marcelo', 'Aline', 'Ricardo', 'Priscila',
  'Fernando', 'Débora', 'Vinícius', 'Tatiana', 'Henrique', 'Luciana', 'Fábio'
];

const brazilianLastNames = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves',
  'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho',
  'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha',
  'Dias', 'Nascimento', 'Andrade', 'Moreira', 'Nunes', 'Marques', 'Machado',
  'Mendes', 'Freitas', 'Cardoso', 'Ramos', 'Gonçalves', 'Santana', 'Teixeira'
];

const platforms = ['mercadolivre', 'shopee', 'amazon', 'shopify'];
const platformWeights = [0.40, 0.30, 0.20, 0.10]; // 40% ML, 30% Shopee, 20% Amazon, 10% Shopify

const getWeightedPlatform = () => {
  const rand = Math.random();
  let cumulative = 0;
  for (let i = 0; i < platforms.length; i++) {
    cumulative += platformWeights[i];
    if (rand <= cumulative) return platforms[i];
  }
  return platforms[0];
};

const orderStatuses = ['completed', 'completed', 'completed', 'completed', 'shipped', 'pending'];

const products = [
  { name: 'Monitor Gamer 27" 165Hz IPS', category: 'Tecnologia', price: 1899, cost: 1200, stock: 45 },
  { name: 'iPhone 15 Pro Max 256GB', category: 'Smartphones', price: 8499, cost: 6800, stock: 12 },
  { name: 'Notebook Gamer RTX 4060 16GB', category: 'Tecnologia', price: 5299, cost: 3800, stock: 8 },
  { name: 'Fone Bluetooth ANC Premium', category: 'Áudio', price: 399, cost: 180, stock: 120 },
  { name: 'Cadeira Gamer Ergonômica Pro', category: 'Móveis', price: 1199, cost: 650, stock: 25 },
  { name: 'Teclado Mecânico RGB 60%', category: 'Periféricos', price: 349, cost: 150, stock: 85 },
  { name: 'Mouse Gamer 25000 DPI Wireless', category: 'Periféricos', price: 449, cost: 200, stock: 95 },
  { name: 'Webcam 4K Autofocus Pro', category: 'Tecnologia', price: 599, cost: 280, stock: 55 },
  { name: 'SSD NVMe 1TB Gen4', category: 'Componentes', price: 499, cost: 280, stock: 150 },
  { name: 'Memória RAM DDR5 32GB Kit', category: 'Componentes', price: 899, cost: 550, stock: 40 },
  { name: 'Smartwatch Fitness Premium', category: 'Wearables', price: 699, cost: 350, stock: 70 },
  { name: 'Tablet 11" 128GB WiFi', category: 'Tecnologia', price: 2499, cost: 1700, stock: 18 },
  { name: 'Carregador Turbo 65W GaN', category: 'Acessórios', price: 189, cost: 65, stock: 200 },
  { name: 'Cabo USB-C 100W 2m Premium', category: 'Acessórios', price: 79, cost: 25, stock: 300 },
  { name: 'Suporte Monitor Articulado', category: 'Acessórios', price: 249, cost: 110, stock: 65 },
  { name: 'Ring Light Profissional 18"', category: 'Foto/Vídeo', price: 299, cost: 130, stock: 45 },
  { name: 'Microfone Condensador USB', category: 'Áudio', price: 449, cost: 200, stock: 55 },
  { name: 'Hub USB-C 7 em 1', category: 'Acessórios', price: 199, cost: 75, stock: 130 },
  { name: 'Mousepad XL RGB 90x40cm', category: 'Periféricos', price: 149, cost: 50, stock: 110 },
  { name: 'Headset Gamer 7.1 Wireless', category: 'Áudio', price: 599, cost: 280, stock: 40 },
  { name: 'Power Bank 20000mAh 65W', category: 'Acessórios', price: 299, cost: 130, stock: 90 },
  { name: 'Caixa de Som Bluetooth 40W', category: 'Áudio', price: 349, cost: 150, stock: 60 },
  { name: 'Cooler Notebook RGB', category: 'Acessórios', price: 129, cost: 45, stock: 140 },
  { name: 'Controle Gamer Bluetooth Pro', category: 'Games', price: 299, cost: 140, stock: 75 },
  { name: 'Placa de Captura 4K60 USB', category: 'Streaming', price: 899, cost: 500, stock: 20 }
];

const suppliers = [
  { name: 'TechDistribuidora Brasil', contact_name: 'Roberto Machado', email: 'roberto@techdist.com.br', phone: '(11) 98765-4321', cnpj_cpf: '12.345.678/0001-90', payment_terms: 'Net 30' },
  { name: 'ImportMax Eletrônicos', contact_name: 'Carla Mendes', email: 'carla@importmax.com.br', phone: '(11) 97654-3210', cnpj_cpf: '23.456.789/0001-01', payment_terms: 'Net 45' },
  { name: 'MegaStock Componentes', contact_name: 'Anderson Lima', email: 'anderson@megastock.com.br', phone: '(19) 99876-5432', cnpj_cpf: '34.567.890/0001-12', payment_terms: 'Net 21' },
  { name: 'Flex Supply Chain', contact_name: 'Juliana Costa', email: 'juliana@flexsupply.com.br', phone: '(21) 98765-1234', cnpj_cpf: '45.678.901/0001-23', payment_terms: 'Antecipado' },
  { name: 'Global Tech Imports', contact_name: 'Marcos Oliveira', email: 'marcos@globaltech.com.br', phone: '(11) 96543-2109', cnpj_cpf: '56.789.012/0001-34', payment_terms: 'Net 60' },
  { name: 'Shenzhen Direct BR', contact_name: 'Wei Chen', email: 'wei@szdirect.com.br', phone: '(11) 95432-1098', cnpj_cpf: '67.890.123/0001-45', payment_terms: 'Net 30' },
  { name: 'Nacional Periféricos', contact_name: 'Paula Santos', email: 'paula@nacionalper.com.br', phone: '(31) 99765-4321', cnpj_cpf: '78.901.234/0001-56', payment_terms: 'Net 15' },
  { name: 'Premium Gadgets LTDA', contact_name: 'Fernando Ribeiro', email: 'fernando@premiumgadgets.com.br', phone: '(41) 98654-3210', cnpj_cpf: '89.012.345/0001-67', payment_terms: 'Net 30' }
];

const expenses = [
  { name: 'Aluguel Escritório', category: 'Infraestrutura', amount: 3500, recurrence: 'monthly' },
  { name: 'Contabilidade', category: 'Administrativo', amount: 890, recurrence: 'monthly' },
  { name: 'Internet Fibra 500MB', category: 'Infraestrutura', amount: 199, recurrence: 'monthly' },
  { name: 'Energia Elétrica', category: 'Infraestrutura', amount: 450, recurrence: 'monthly' },
  { name: 'UniStock Pro', category: 'Ferramentas', amount: 297, recurrence: 'monthly' },
  { name: 'Google Ads', category: 'Marketing', amount: 5000, recurrence: 'monthly' },
  { name: 'Meta Ads', category: 'Marketing', amount: 3500, recurrence: 'monthly' },
  { name: 'Embalagens e Materiais', category: 'Operacional', amount: 1200, recurrence: 'monthly' },
  { name: 'Funcionário - Operações', category: 'Pessoal', amount: 2800, recurrence: 'monthly' },
  { name: 'Funcionário - Atendimento', category: 'Pessoal', amount: 2200, recurrence: 'monthly' },
  { name: 'Seguro Empresarial', category: 'Administrativo', amount: 350, recurrence: 'monthly' },
  { name: 'Telefonia/WhatsApp Business', category: 'Operacional', amount: 150, recurrence: 'monthly' }
];

const notifications = [
  { type: 'price_alert', title: '🔥 Concorrente baixou preço!', message: 'O Monitor Gamer 27" está R$150 mais barato na loja XYZ. Considere ajustar seu preço.' },
  { type: 'stock_alert', title: '⚠️ Estoque baixo', message: 'iPhone 15 Pro Max está com apenas 12 unidades. Faça novo pedido ao fornecedor.' },
  { type: 'sales_alert', title: '🚀 Vendas em alta!', message: 'Você vendeu 47 produtos hoje! Seu melhor dia do mês.' },
  { type: 'sync_success', title: '✅ Sincronização concluída', message: 'Todos os produtos foram sincronizados com Mercado Livre com sucesso.' },
  { type: 'price_alert', title: '📈 Oportunidade de preço', message: 'Fone Bluetooth ANC está com demanda alta. Considere aumentar R$30 o preço.' },
  { type: 'order_alert', title: '🎉 Novo pedido grande!', message: 'Pedido de R$4.299 recebido via Amazon. Cliente premium identificado.' },
  { type: 'stock_alert', title: '📦 Produto esgotando', message: 'Notebook Gamer RTX 4060 com apenas 8 unidades. Média de vendas: 3/semana.' },
  { type: 'sync_success', title: '✅ Shopee atualizada', message: '25 produtos tiveram preços atualizados na Shopee automaticamente.' },
  { type: 'sales_alert', title: '💰 Meta batida!', message: 'Parabéns! Você atingiu R$150.000 em vendas este mês, 20% acima da meta.' },
  { type: 'price_alert', title: '🔔 Alerta de margem', message: 'SSD NVMe 1TB está com margem de apenas 18%. Revise o custo ou preço.' }
];

// Ad campaigns demo data (Meta Ads, Google Ads, TikTok Ads)
const adCampaigns = [
  // Meta Ads campaigns
  { platform: 'meta_ads', name: 'Black Friday 2025', status: 'active', dailyBudget: 280, roas: 4.2 },
  { platform: 'meta_ads', name: 'Remarketing Site', status: 'active', dailyBudget: 180, roas: 3.8 },
  { platform: 'meta_ads', name: 'Stories Verão', status: 'active', dailyBudget: 95, roas: 1.8 },
  { platform: 'meta_ads', name: 'Feed Produtos', status: 'active', dailyBudget: 150, roas: 2.4 },
  { platform: 'meta_ads', name: 'Lookalike Clientes', status: 'paused', dailyBudget: 60, roas: 3.1 },
  // Google Ads campaigns
  { platform: 'google_ads', name: 'Search - Produtos', status: 'active', dailyBudget: 350, roas: 2.9 },
  { platform: 'google_ads', name: 'Display - Marca', status: 'active', dailyBudget: 120, roas: 2.1 },
  { platform: 'google_ads', name: 'Shopping Feed', status: 'active', dailyBudget: 85, roas: 3.5 },
  { platform: 'google_ads', name: 'Performance Max', status: 'paused', dailyBudget: 70, roas: 2.8 },
  // TikTok Ads campaigns
  { platform: 'tiktok_ads', name: 'Spark Ads - Influencers', status: 'active', dailyBudget: 200, roas: 3.6 },
  { platform: 'tiktok_ads', name: 'In-Feed Produtos', status: 'active', dailyBudget: 150, roas: 2.8 },
  { platform: 'tiktok_ads', name: 'TopView Lançamento', status: 'active', dailyBudget: 300, roas: 2.2 },
  { platform: 'tiktok_ads', name: 'Hashtag Challenge', status: 'paused', dailyBudget: 180, roas: 3.0 },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create user client to get user info
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Gerando dados demo para usuário: ${user.id}`);

    // Use service role for data operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar organization_id do usuário
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (orgError || !orgMember?.organization_id) {
      console.error('Erro ao buscar organização:', orgError);
      return new Response(JSON.stringify({ 
        error: 'Usuário não pertence a nenhuma organização' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const organizationId = orgMember.organization_id;
    console.log(`Organization ID: ${organizationId}`);

    // Clean existing data
    console.log('Limpando dados existentes...');
    await supabase.from('attributed_conversions').delete().eq('user_id', user.id);
    await supabase.from('campaign_product_links').delete().eq('user_id', user.id);
    await supabase.from('ad_metrics').delete().eq('user_id', user.id);
    await supabase.from('price_monitoring_jobs').delete().eq('user_id', user.id);
    await supabase.from('notifications').delete().eq('user_id', user.id);
    await supabase.from('orders').delete().eq('user_id', user.id);
    await supabase.from('product_listings').delete().eq('user_id', user.id);
    await supabase.from('products').delete().eq('user_id', user.id);
    await supabase.from('purchase_orders').delete().eq('user_id', user.id);
    await supabase.from('suppliers').delete().eq('user_id', user.id);
    await supabase.from('expenses').delete().eq('user_id', user.id);

    // Insert suppliers
    console.log('Inserindo fornecedores...');
    const supplierInserts = suppliers.map(s => ({
      user_id: user.id,
      organization_id: organizationId,
      name: s.name,
      contact_name: s.contact_name,
      email: s.email,
      phone: s.phone,
      cnpj_cpf: s.cnpj_cpf,
      payment_terms: s.payment_terms,
      is_active: true
    }));
    const { data: insertedSuppliers } = await supabase.from('suppliers').insert(supplierInserts).select();

    // Insert products
    console.log('Inserindo produtos...');
    const productInserts = products.map((p, i) => ({
      user_id: user.id,
      organization_id: organizationId,
      name: p.name,
      sku: `SKU-${String(i + 1).padStart(4, '0')}`,
      category: p.category,
      stock: p.stock + randomInt(-10, 30),
      cost_price: p.cost,
      selling_price: p.price,
      ad_spend: randomInt(50, 500),
      supplier_id: insertedSuppliers ? insertedSuppliers[randomInt(0, insertedSuppliers.length - 1)].id : null,
      condition: 'new',
      weight: randomFloat(0.1, 5).toFixed(2),
      dimensions: { width: randomInt(5, 50), height: randomInt(5, 40), length: randomInt(5, 60) }
    }));
    const { data: insertedProducts } = await supabase.from('products').insert(productInserts).select();

    // Generate orders - 500+ orders over 90 days with concentration on recent days
    console.log('Gerando pedidos...');
    const now = new Date();
    const orders: any[] = [];
    
    // Today: 35-45 orders (high volume day for impressive screenshot)
    const todayOrders = randomInt(35, 45);
    for (let i = 0; i < todayOrders; i++) {
      const product = insertedProducts![randomInt(0, insertedProducts!.length - 1)];
      const quantity = randomInt(1, 3);
      const orderDate = new Date(now);
      orderDate.setHours(randomInt(0, 23), randomInt(0, 59), randomInt(0, 59));
      
      orders.push({
        user_id: user.id,
        organization_id: organizationId,
        order_id_channel: `ORD-${Date.now()}-${randomInt(1000, 9999)}`,
        platform: getWeightedPlatform(),
        status: randomItem(orderStatuses),
        total_value: product.selling_price * quantity,
        order_date: orderDate.toISOString(),
        customer_name: `${randomItem(brazilianFirstNames)} ${randomItem(brazilianLastNames)}`,
        customer_email: `cliente${randomInt(1, 9999)}@email.com`,
        items: [{ product_id: product.id, name: product.name, quantity, price: product.selling_price }]
      });
    }

    // Last 7 days (excluding today): 20-30 orders per day
    for (let day = 1; day <= 7; day++) {
      const ordersPerDay = randomInt(20, 30);
      for (let i = 0; i < ordersPerDay; i++) {
        const product = insertedProducts![randomInt(0, insertedProducts!.length - 1)];
        const quantity = randomInt(1, 4);
        const orderDate = new Date(now);
        orderDate.setDate(orderDate.getDate() - day);
        orderDate.setHours(randomInt(0, 23), randomInt(0, 59), randomInt(0, 59));
        
        orders.push({
          user_id: user.id,
          organization_id: organizationId,
          order_id_channel: `ORD-${Date.now()}-${randomInt(1000, 9999)}-${day}-${i}`,
          platform: getWeightedPlatform(),
          status: randomItem(orderStatuses),
          total_value: product.selling_price * quantity,
          order_date: orderDate.toISOString(),
          customer_name: `${randomItem(brazilianFirstNames)} ${randomItem(brazilianLastNames)}`,
          customer_email: `cliente${randomInt(1, 9999)}@email.com`,
          items: [{ product_id: product.id, name: product.name, quantity, price: product.selling_price }]
        });
      }
    }

    // Days 8-30: 10-20 orders per day
    for (let day = 8; day <= 30; day++) {
      const ordersPerDay = randomInt(10, 20);
      for (let i = 0; i < ordersPerDay; i++) {
        const product = insertedProducts![randomInt(0, insertedProducts!.length - 1)];
        const quantity = randomInt(1, 3);
        const orderDate = new Date(now);
        orderDate.setDate(orderDate.getDate() - day);
        orderDate.setHours(randomInt(0, 23), randomInt(0, 59), randomInt(0, 59));
        
        orders.push({
          user_id: user.id,
          organization_id: organizationId,
          order_id_channel: `ORD-${Date.now()}-${randomInt(1000, 9999)}-${day}-${i}`,
          platform: getWeightedPlatform(),
          status: randomItem(orderStatuses),
          total_value: product.selling_price * quantity,
          order_date: orderDate.toISOString(),
          customer_name: `${randomItem(brazilianFirstNames)} ${randomItem(brazilianLastNames)}`,
          customer_email: `cliente${randomInt(1, 9999)}@email.com`,
          items: [{ product_id: product.id, name: product.name, quantity, price: product.selling_price }]
        });
      }
    }

    // Days 31-90: 5-12 orders per day
    for (let day = 31; day <= 90; day++) {
      const ordersPerDay = randomInt(5, 12);
      for (let i = 0; i < ordersPerDay; i++) {
        const product = insertedProducts![randomInt(0, insertedProducts!.length - 1)];
        const quantity = randomInt(1, 2);
        const orderDate = new Date(now);
        orderDate.setDate(orderDate.getDate() - day);
        orderDate.setHours(randomInt(0, 23), randomInt(0, 59), randomInt(0, 59));
        
        orders.push({
          user_id: user.id,
          organization_id: organizationId,
          order_id_channel: `ORD-${Date.now()}-${randomInt(1000, 9999)}-${day}-${i}`,
          platform: getWeightedPlatform(),
          status: 'completed',
          total_value: product.selling_price * quantity,
          order_date: orderDate.toISOString(),
          customer_name: `${randomItem(brazilianFirstNames)} ${randomItem(brazilianLastNames)}`,
          customer_email: `cliente${randomInt(1, 9999)}@email.com`,
          items: [{ product_id: product.id, name: product.name, quantity, price: product.selling_price }]
        });
      }
    }

    // Insert orders in batches
    console.log(`Inserindo ${orders.length} pedidos...`);
    const batchSize = 100;
    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize);
      await supabase.from('orders').insert(batch);
    }

    // Insert expenses
    console.log('Inserindo despesas...');
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);
    const expenseInserts = expenses.map(e => ({
      user_id: user.id,
      organization_id: organizationId,
      name: e.name,
      category: e.category,
      amount: e.amount,
      recurrence: e.recurrence,
      start_date: startDate.toISOString().split('T')[0],
      is_active: true
    }));
    await supabase.from('expenses').insert(expenseInserts);

    // Insert notifications
    console.log('Inserindo notificações...');
    const notificationInserts = notifications.map((n, i) => {
      const createdAt = new Date();
      createdAt.setHours(createdAt.getHours() - i * 2);
      return {
        user_id: user.id,
        organization_id: organizationId,
        type: n.type,
        title: n.title,
        message: n.message,
        is_read: i > 3,
        created_at: createdAt.toISOString()
      };
    });
    await supabase.from('notifications').insert(notificationInserts);

    // Insert price monitoring jobs
    console.log('Inserindo jobs de monitoramento...');
    const monitoringJobs = insertedProducts!.slice(0, 8).map(p => ({
      user_id: user.id,
      organization_id: organizationId,
      product_id: p.id,
      competitor_url: `https://www.mercadolivre.com.br/produto-similar-${randomInt(1000, 9999)}`,
      trigger_condition: randomItem(['price_decrease', 'price_increase', 'any_change']),
      is_active: true,
      last_price: p.selling_price * randomFloat(0.9, 1.1)
    }));
    await supabase.from('price_monitoring_jobs').insert(monitoringJobs);

    // ============================================
    // ADS DATA: Campanhas, Vínculos e Atribuições
    // ============================================
    console.log('Inserindo dados de ads (campanhas, vínculos, atribuições)...');

    // Generate ad_metrics for each campaign over last 30 days
    const adMetricsInserts: any[] = [];
    const campaignLinks: any[] = [];
    const attributedConversions: any[] = [];
    
    // Create a fake integration ID for demo purposes
    const fakeIntegrationId = crypto.randomUUID();
    
    adCampaigns.forEach((campaign, idx) => {
      const campaignId = `demo-campaign-${idx + 1}`;
      
      // Generate daily metrics for last 30 days
      for (let day = 0; day < 30; day++) {
        const date = new Date(now);
        date.setDate(date.getDate() - day);
        const dateStr = date.toISOString().split('T')[0];
        
        // Add variance based on campaign status and performance
        const isActive = campaign.status === 'active';
        const baseSpend = isActive ? campaign.dailyBudget * randomFloat(0.8, 1.2) : campaign.dailyBudget * randomFloat(0.1, 0.3);
        const spend = Math.round(baseSpend * 100) / 100;
        
        // Calculate metrics based on ROAS and spend
        const conversionValue = spend * campaign.roas * randomFloat(0.85, 1.15);
        const avgOrderValue = 350; // Average order value
        const conversions = Math.max(1, Math.round(conversionValue / avgOrderValue));
        const cpc = randomFloat(1.0, 3.5);
        const clicks = Math.round(spend / cpc);
        const ctr = randomFloat(1.0, 3.0);
        const impressions = Math.round(clicks / (ctr / 100));
        
        adMetricsInserts.push({
          user_id: user.id,
          organization_id: organizationId,
          integration_id: fakeIntegrationId,
          platform: campaign.platform,
          campaign_id: campaignId,
          campaign_name: campaign.name,
          date: dateStr,
          spend,
          impressions,
          clicks,
          conversions,
          conversion_value: Math.round(conversionValue * 100) / 100,
          cpc: Math.round(cpc * 100) / 100,
          ctr: Math.round(ctr * 100) / 100,
          reach: Math.round(impressions * randomFloat(0.7, 0.9))
        });
      }
      
      // Link each campaign to 2-4 products
      const numProducts = randomInt(2, 4);
      const linkedProducts = insertedProducts!.slice(idx % 20, (idx % 20) + numProducts);
      
      linkedProducts.forEach(product => {
        campaignLinks.push({
          user_id: user.id,
          organization_id: organizationId,
          campaign_id: campaignId,
          campaign_name: campaign.name,
          platform: campaign.platform,
          product_id: product.id,
          sku: product.sku,
          is_active: campaign.status === 'active',
          link_type: 'manual',
          start_date: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });
      });
    });

    // Insert ad_metrics in batches
    console.log(`Inserindo ${adMetricsInserts.length} métricas de ads...`);
    for (let i = 0; i < adMetricsInserts.length; i += batchSize) {
      const batch = adMetricsInserts.slice(i, i + batchSize);
      await supabase.from('ad_metrics').insert(batch);
    }

    // Insert campaign_product_links
    console.log(`Inserindo ${campaignLinks.length} vínculos de campanhas...`);
    await supabase.from('campaign_product_links').insert(campaignLinks);

    // Generate attributed conversions based on orders and campaign links
    console.log('Gerando atribuições de conversão...');
    
    // For each order, check if the product has a linked campaign and create attribution
    const ordersWithAttribution = orders.slice(0, Math.floor(orders.length * 0.35)); // ~35% of orders attributed
    
    for (const order of ordersWithAttribution) {
      const orderItems = order.items as { product_id: string; name: string; quantity: number; price: number }[];
      
      for (const item of orderItems) {
        // Find if this product has a linked campaign
        const linkedCampaign = campaignLinks.find(link => link.product_id === item.product_id);
        
        if (linkedCampaign) {
          const orderDate = new Date(order.order_date);
          const orderValue = item.price * item.quantity;
          
          // Calculate attributed spend (proportional to campaign daily spend)
          const campaign = adCampaigns.find(c => `demo-campaign-${adCampaigns.indexOf(c) + 1}` === linkedCampaign.campaign_id);
          const attributedSpend = campaign ? campaign.dailyBudget * randomFloat(0.02, 0.08) : randomFloat(5, 20);
          
          attributedConversions.push({
            user_id: user.id,
            organization_id: organizationId,
            campaign_id: linkedCampaign.campaign_id,
            campaign_name: linkedCampaign.campaign_name,
            platform: linkedCampaign.platform,
            product_id: item.product_id,
            sku: linkedCampaign.sku,
            order_id: null, // We don't have the actual order ID at this point
            order_value: orderValue,
            quantity: item.quantity,
            attributed_spend: Math.round(attributedSpend * 100) / 100,
            conversion_date: orderDate.toISOString().split('T')[0],
            attribution_method: 'time_window',
            attribution_weight: 1.0
          });
        }
      }
    }

    // Insert attributed conversions in batches
    console.log(`Inserindo ${attributedConversions.length} atribuições de conversão...`);
    for (let i = 0; i < attributedConversions.length; i += batchSize) {
      const batch = attributedConversions.slice(i, i + batchSize);
      await supabase.from('attributed_conversions').insert(batch);
    }

    // Update product aggregated metrics
    console.log('Atualizando métricas agregadas dos produtos...');
    for (const link of campaignLinks) {
      const productConversions = attributedConversions.filter(ac => ac.product_id === link.product_id);
      
      if (productConversions.length > 0) {
        const totalRevenue = productConversions.reduce((sum, c) => sum + c.order_value, 0);
        const totalSpend = productConversions.reduce((sum, c) => sum + c.attributed_spend, 0);
        const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
        
        await supabase.from('products').update({
          total_attributed_revenue: Math.round(totalRevenue * 100) / 100,
          total_attributed_spend: Math.round(totalSpend * 100) / 100,
          attributed_roas: Math.round(roas * 100) / 100,
          active_campaign_ids: [link.campaign_id]
        }).eq('id', link.product_id);
      }
    }

    // Calculate summary
    const totalRevenue = orders.reduce((sum, o) => sum + o.total_value, 0);
    const todayRevenue = orders.filter(o => {
      const orderDate = new Date(o.order_date);
      return orderDate.toDateString() === now.toDateString();
    }).reduce((sum, o) => sum + o.total_value, 0);
    
    const totalAdSpend = adMetricsInserts.reduce((sum, m) => sum + m.spend, 0);
    const totalAttributedRevenue = attributedConversions.reduce((sum, c) => sum + c.order_value, 0);

    const summary = {
      produtos: insertedProducts!.length,
      pedidos: orders.length,
      pedidos_hoje: todayOrders,
      fornecedores: insertedSuppliers!.length,
      despesas: expenseInserts.length,
      notificacoes: notificationInserts.length,
      jobs_monitoramento: monitoringJobs.length,
      campanhas_ads: adCampaigns.length,
      metricas_ads: adMetricsInserts.length,
      vinculos_campanhas: campaignLinks.length,
      atribuicoes_conversao: attributedConversions.length,
      gasto_total_ads: totalAdSpend.toFixed(2),
      receita_atribuida: totalAttributedRevenue.toFixed(2),
      faturamento_total: totalRevenue.toFixed(2),
      faturamento_hoje: todayRevenue.toFixed(2)
    };

    console.log('Dados demo gerados com sucesso!', summary);

    return new Response(JSON.stringify({
      success: true,
      message: 'Dados demo gerados com sucesso! Recarregue o dashboard.',
      summary
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro ao gerar dados demo:', error);
    return new Response(JSON.stringify({ 
      error: 'Erro ao gerar dados demo', 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
