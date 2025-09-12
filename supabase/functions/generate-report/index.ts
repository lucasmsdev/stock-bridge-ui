import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('📊 Starting report generation');

  try {
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error('Invalid authentication');
    }

    const userId = userData.user.id;
    console.log(`👤 Generating report for user: ${userId}`);

    // Parse request body
    const { reportType, period, format } = await req.json();
    
    console.log(`📋 Report type: ${reportType}, Period: ${period}, Format: ${format}`);

    // Get date range based on period
    const dateRange = getDateRange(period);
    
    // Generate report data based on type
    let reportData;
    switch (reportType) {
      case 'sales':
        reportData = await generateSalesReport(supabase, userId, dateRange);
        break;
      case 'profitability':
        reportData = await generateProfitabilityReport(supabase, userId, dateRange);
        break;
      default:
        throw new Error('Invalid report type');
    }

    // Generate file based on format
    let fileContent: string;
    let filename: string;
    let contentType: string;

    if (format === 'CSV') {
      fileContent = generateCSV(reportData);
      filename = `relatorio-${reportType}-${period}-${Date.now()}.csv`;
      contentType = 'text/csv';
    } else if (format === 'PDF') {
      fileContent = generatePDF(reportData, reportType);
      filename = `relatorio-${reportType}-${period}-${Date.now()}.pdf`;
      contentType = 'application/pdf';
    } else {
      throw new Error('Invalid format');
    }

    console.log(`✅ Report generated successfully: ${filename}`);

    // Return the file as a data URL for immediate download
    const base64Content = btoa(fileContent);
    const dataUrl = `data:${contentType};base64,${base64Content}`;

    return new Response(JSON.stringify({
      success: true,
      fileUrl: dataUrl,
      filename: filename
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error generating report:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// Get date range based on period
function getDateRange(period: string): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  let startDate: Date;

  switch (period) {
    case 'last_7_days':
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'last_30_days':
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      break;
    case 'last_month':
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      startDate.setDate(1);
      endDate.setDate(0); // Last day of previous month
      break;
    default:
      throw new Error('Invalid period');
  }

  return { startDate, endDate };
}

// Generate sales report
async function generateSalesReport(supabase: any, userId: string, dateRange: any) {
  console.log('📈 Generating sales report');
  
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .gte('order_date', dateRange.startDate.toISOString())
    .lte('order_date', dateRange.endDate.toISOString())
    .order('order_date', { ascending: false });

  if (error) {
    throw new Error(`Error fetching orders: ${error.message}`);
  }

  // Process orders data
  const totalOrders = orders?.length || 0;
  const totalRevenue = orders?.reduce((sum: number, order: any) => sum + (order.total_value || 0), 0) || 0;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return {
    type: 'sales',
    period: `${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`,
    summary: {
      totalOrders,
      totalRevenue,
      averageOrderValue
    },
    orders: orders || []
  };
}

// Generate profitability report
async function generateProfitabilityReport(supabase: any, userId: string, dateRange: any) {
  console.log('💰 Generating profitability report');
  
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Error fetching products: ${error.message}`);
  }

  // Calculate profitability for each product
  const profitabilityData = products?.map((product: any) => {
    const costPrice = product.cost_price || 0;
    const sellingPrice = product.selling_price || 0;
    const profit = sellingPrice - costPrice;
    const margin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

    return {
      ...product,
      profit,
      margin: Math.round(margin * 100) / 100
    };
  }) || [];

  const totalProfit = profitabilityData.reduce((sum: number, p: any) => sum + (p.profit || 0), 0);
  const averageMargin = profitabilityData.length > 0 
    ? profitabilityData.reduce((sum: number, p: any) => sum + (p.margin || 0), 0) / profitabilityData.length 
    : 0;

  return {
    type: 'profitability',
    period: `${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`,
    summary: {
      totalProducts: profitabilityData.length,
      totalProfit,
      averageMargin: Math.round(averageMargin * 100) / 100
    },
    products: profitabilityData
  };
}

// Generate CSV content
function generateCSV(reportData: any): string {
  console.log('📄 Generating CSV format');
  
  if (reportData.type === 'sales') {
    let csv = 'Data,ID do Pedido,Plataforma,Valor Total,Itens\n';
    
    reportData.orders.forEach((order: any) => {
      const date = new Date(order.order_date).toLocaleDateString('pt-BR');
      const items = Array.isArray(order.items) ? order.items.length : 0;
      csv += `"${date}","${order.order_id_channel}","${order.platform}","R$ ${order.total_value?.toFixed(2) || '0.00'}","${items}"\n`;
    });
    
    csv += `\nResumo:\n`;
    csv += `Total de Pedidos,${reportData.summary.totalOrders}\n`;
    csv += `Receita Total,"R$ ${reportData.summary.totalRevenue?.toFixed(2) || '0.00'}"\n`;
    csv += `Valor Médio do Pedido,"R$ ${reportData.summary.averageOrderValue?.toFixed(2) || '0.00'}"\n`;
    
    return csv;
  } else {
    let csv = 'Produto,SKU,Preço de Custo,Preço de Venda,Lucro,Margem (%)\n';
    
    reportData.products.forEach((product: any) => {
      csv += `"${product.name}","${product.sku}","R$ ${product.cost_price?.toFixed(2) || '0.00'}","R$ ${product.selling_price?.toFixed(2) || '0.00'}","R$ ${product.profit?.toFixed(2) || '0.00'}","${product.margin?.toFixed(2) || '0.00'}%"\n`;
    });
    
    csv += `\nResumo:\n`;
    csv += `Total de Produtos,${reportData.summary.totalProducts}\n`;
    csv += `Lucro Total,"R$ ${reportData.summary.totalProfit?.toFixed(2) || '0.00'}"\n`;
    csv += `Margem Média,"${reportData.summary.averageMargin?.toFixed(2) || '0.00'}%"\n`;
    
    return csv;
  }
}

// Generate simple PDF content (text-based)
function generatePDF(reportData: any, reportType: string): string {
  console.log('📄 Generating PDF format');
  
  // For simplicity, we'll return a text-based "PDF" 
  // In a real implementation, you would use a proper PDF library
  let content = `RELATÓRIO - ${reportType.toUpperCase()}\n`;
  content += `Período: ${reportData.period}\n`;
  content += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n`;
  content += `\n${'='.repeat(50)}\n\n`;
  
  if (reportData.type === 'sales') {
    content += `RESUMO DE VENDAS\n`;
    content += `Total de Pedidos: ${reportData.summary.totalOrders}\n`;
    content += `Receita Total: R$ ${reportData.summary.totalRevenue?.toFixed(2) || '0.00'}\n`;
    content += `Valor Médio do Pedido: R$ ${reportData.summary.averageOrderValue?.toFixed(2) || '0.00'}\n\n`;
    
    content += `DETALHES DOS PEDIDOS:\n`;
    reportData.orders.forEach((order: any) => {
      const date = new Date(order.order_date).toLocaleDateString('pt-BR');
      content += `${date} - ${order.order_id_channel} (${order.platform}) - R$ ${order.total_value?.toFixed(2) || '0.00'}\n`;
    });
  } else {
    content += `RESUMO DE LUCRATIVIDADE\n`;
    content += `Total de Produtos: ${reportData.summary.totalProducts}\n`;
    content += `Lucro Total: R$ ${reportData.summary.totalProfit?.toFixed(2) || '0.00'}\n`;
    content += `Margem Média: ${reportData.summary.averageMargin?.toFixed(2) || '0.00'}%\n\n`;
    
    content += `DETALHES POR PRODUTO:\n`;
    reportData.products.forEach((product: any) => {
      content += `${product.name} (${product.sku}) - Lucro: R$ ${product.profit?.toFixed(2) || '0.00'} (${product.margin?.toFixed(2) || '0.00'}%)\n`;
    });
  }
  
  return content;
}