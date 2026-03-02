import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Advanced report types that require Enterprise+ plan
const ADVANCED_REPORT_TYPES = ['marketplace_performance', 'trends', 'stock_forecast', 'roi_by_channel'];
const ADVANCED_PERIODS = ['last_3_months', 'last_6_months', 'current_year', 'custom'];

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
    const { reportType, period, format, customStartDate, customEndDate } = await req.json();
    
    console.log(`📋 Report type: ${reportType}, Period: ${period}, Format: ${format}`);

    // Check if user has access to advanced reports
    const isAdvancedReport = ADVANCED_REPORT_TYPES.includes(reportType);
    const isAdvancedPeriod = ADVANCED_PERIODS.includes(period);
    
    if (isAdvancedReport || isAdvancedPeriod) {
      // Verify user plan includes advanced reports
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', userId)
        .single();

      if (profileError) {
        throw new Error('Error fetching user profile');
      }

      const hasAdvancedAccess = ['enterprise', 'unlimited'].includes(profile?.plan || '');
      
      if (!hasAdvancedAccess) {
        throw new Error('Você precisa do plano Enterprise ou Unlimited para acessar relatórios avançados.');
      }
    }

    // Get date range based on period
    const dateRange = getDateRange(period, customStartDate, customEndDate);
    
    // Generate report data based on type
    let reportData;
    switch (reportType) {
      case 'sales':
        reportData = await generateSalesReport(supabase, userId, dateRange);
        break;
      case 'profitability':
        reportData = await generateProfitabilityReport(supabase, userId, dateRange);
        break;
      case 'marketplace_performance':
        reportData = await generateMarketplacePerformanceReport(supabase, userId, dateRange);
        break;
      case 'trends':
        reportData = await generateTrendsReport(supabase, userId, dateRange);
        break;
      case 'stock_forecast':
        reportData = await generateStockForecastReport(supabase, userId, dateRange);
        break;
      case 'roi_by_channel':
        reportData = await generateROIByChannelReport(supabase, userId, dateRange);
        break;
      default:
        throw new Error('Invalid report type');
    }

    // Generate file based on format
    let fileContent: string;
    let filename: string;
    let contentType: string;
    let isBinary = false;

    if (format === 'CSV') {
      fileContent = generateCSV(reportData);
      filename = `relatorio-${reportType}-${period}-${Date.now()}.csv`;
      contentType = 'text/csv';
    } else if (format === 'XLSX') {
      fileContent = generateXLSX(reportData);
      filename = `relatorio-${reportType}-${period}-${Date.now()}.xlsx`;
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      isBinary = true;
    } else if (format === 'PDF') {
      fileContent = generatePDF(reportData, reportType);
      filename = `relatorio-${reportType}-${period}-${Date.now()}.pdf`;
      contentType = 'application/pdf';
    } else {
      throw new Error('Invalid format');
    }

    console.log(`✅ Report generated successfully: ${filename}`);

    // Return the file as a data URL for immediate download
    const base64Content = isBinary ? fileContent : btoa(fileContent);
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
function getDateRange(period: string, customStartDate?: string, customEndDate?: string): { startDate: Date; endDate: Date } {
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
    case 'last_3_months':
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case 'last_6_months':
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 6);
      break;
    case 'current_year':
      startDate = new Date();
      startDate.setMonth(0);
      startDate.setDate(1);
      break;
    case 'custom':
      if (!customStartDate || !customEndDate) {
        throw new Error('Custom period requires start and end dates');
      }
      startDate = new Date(customStartDate);
      return { startDate, endDate: new Date(customEndDate) };
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

// Generate marketplace performance report (Enterprise+)
async function generateMarketplacePerformanceReport(supabase: any, userId: string, dateRange: any) {
  console.log('🏪 Generating marketplace performance report');
  
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .gte('order_date', dateRange.startDate.toISOString())
    .lte('order_date', dateRange.endDate.toISOString());

  if (error) {
    throw new Error(`Error fetching orders: ${error.message}`);
  }

  // Group by platform
  const platformData: Record<string, { orders: number; revenue: number }> = {};
  
  (orders || []).forEach((order: any) => {
    const platform = order.platform || 'unknown';
    if (!platformData[platform]) {
      platformData[platform] = { orders: 0, revenue: 0 };
    }
    platformData[platform].orders += 1;
    platformData[platform].revenue += order.total_value || 0;
  });

  const platforms = Object.entries(platformData).map(([name, data]) => ({
    platform: name,
    totalOrders: data.orders,
    totalRevenue: data.revenue,
    averageOrderValue: data.orders > 0 ? data.revenue / data.orders : 0
  }));

  return {
    type: 'marketplace_performance',
    period: `${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`,
    summary: {
      totalPlatforms: platforms.length,
      totalOrders: orders?.length || 0,
      totalRevenue: orders?.reduce((sum: number, o: any) => sum + (o.total_value || 0), 0) || 0
    },
    platforms
  };
}

// Generate trends report (Enterprise+)
async function generateTrendsReport(supabase: any, userId: string, dateRange: any) {
  console.log('📊 Generating trends report');
  
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .gte('order_date', dateRange.startDate.toISOString())
    .lte('order_date', dateRange.endDate.toISOString())
    .order('order_date', { ascending: true });

  if (error) {
    throw new Error(`Error fetching orders: ${error.message}`);
  }

  // Group by month
  const monthlyData: Record<string, { orders: number; revenue: number }> = {};
  
  (orders || []).forEach((order: any) => {
    const date = new Date(order.order_date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { orders: 0, revenue: 0 };
    }
    monthlyData[monthKey].orders += 1;
    monthlyData[monthKey].revenue += order.total_value || 0;
  });

  const months = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data], index, arr) => {
      const prevMonth = index > 0 ? arr[index - 1][1] : null;
      const revenueGrowth = prevMonth && prevMonth.revenue > 0 
        ? ((data.revenue - prevMonth.revenue) / prevMonth.revenue) * 100 
        : 0;
      
      return {
        month,
        totalOrders: data.orders,
        totalRevenue: data.revenue,
        revenueGrowth: Math.round(revenueGrowth * 100) / 100
      };
    });

  return {
    type: 'trends',
    period: `${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`,
    summary: {
      totalMonths: months.length,
      averageMonthlyRevenue: months.length > 0 
        ? months.reduce((sum, m) => sum + m.totalRevenue, 0) / months.length 
        : 0,
      averageGrowth: months.length > 1 
        ? months.slice(1).reduce((sum, m) => sum + m.revenueGrowth, 0) / (months.length - 1) 
        : 0
    },
    months
  };
}

// Generate stock forecast report (Enterprise+)
async function generateStockForecastReport(supabase: any, userId: string, dateRange: any) {
  console.log('📦 Generating stock forecast report');
  
  // Get products
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', userId);

  if (productsError) {
    throw new Error(`Error fetching products: ${productsError.message}`);
  }

  // Get orders to calculate average sales
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .gte('order_date', dateRange.startDate.toISOString())
    .lte('order_date', dateRange.endDate.toISOString());

  if (ordersError) {
    throw new Error(`Error fetching orders: ${ordersError.message}`);
  }

  // Calculate sales per product
  const productSales: Record<string, number> = {};
  
  (orders || []).forEach((order: any) => {
    const items = Array.isArray(order.items) ? order.items : [];
    items.forEach((item: any) => {
      const productId = item.product_id || item.sku;
      if (productId) {
        productSales[productId] = (productSales[productId] || 0) + (item.quantity || 1);
      }
    });
  });

  // Calculate days in period
  const daysDiff = Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24));

  const forecasts = (products || []).map((product: any) => {
    const totalSold = productSales[product.id] || productSales[product.sku] || 0;
    const dailySalesRate = daysDiff > 0 ? totalSold / daysDiff : 0;
    const currentStock = product.stock || 0;
    const daysUntilStockout = dailySalesRate > 0 ? Math.floor(currentStock / dailySalesRate) : Infinity;
    const recommendedReorder = Math.ceil(dailySalesRate * 30); // 30 days of stock

    return {
      name: product.name,
      sku: product.sku,
      currentStock,
      totalSold,
      dailySalesRate: Math.round(dailySalesRate * 100) / 100,
      daysUntilStockout: daysUntilStockout === Infinity ? 'N/A' : daysUntilStockout,
      recommendedReorder,
      stockStatus: daysUntilStockout <= 7 ? 'CRÍTICO' : daysUntilStockout <= 30 ? 'BAIXO' : 'OK'
    };
  });

  return {
    type: 'stock_forecast',
    period: `${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`,
    summary: {
      totalProducts: forecasts.length,
      criticalStock: forecasts.filter((f: any) => f.stockStatus === 'CRÍTICO').length,
      lowStock: forecasts.filter((f: any) => f.stockStatus === 'BAIXO').length
    },
    forecasts
  };
}

// Generate ROI by channel report (Enterprise+)
async function generateROIByChannelReport(supabase: any, userId: string, dateRange: any) {
  console.log('💵 Generating ROI by channel report');
  
  // Get orders
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .gte('order_date', dateRange.startDate.toISOString())
    .lte('order_date', dateRange.endDate.toISOString());

  if (ordersError) {
    throw new Error(`Error fetching orders: ${ordersError.message}`);
  }

  // Get products for cost calculation
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', userId);

  if (productsError) {
    throw new Error(`Error fetching products: ${productsError.message}`);
  }

  const productCosts: Record<string, number> = {};
  const productAdSpend: Record<string, number> = {};
  
  (products || []).forEach((product: any) => {
    productCosts[product.id] = product.cost_price || 0;
    productCosts[product.sku] = product.cost_price || 0;
    productAdSpend[product.id] = product.ad_spend || 0;
    productAdSpend[product.sku] = product.ad_spend || 0;
  });

  // Calculate ROI per platform
  const platformData: Record<string, { revenue: number; cost: number; adSpend: number }> = {};
  
  (orders || []).forEach((order: any) => {
    const platform = order.platform || 'unknown';
    if (!platformData[platform]) {
      platformData[platform] = { revenue: 0, cost: 0, adSpend: 0 };
    }
    
    platformData[platform].revenue += order.total_value || 0;
    
    // Calculate costs from items
    const items = Array.isArray(order.items) ? order.items : [];
    items.forEach((item: any) => {
      const productId = item.product_id || item.sku;
      const quantity = item.quantity || 1;
      platformData[platform].cost += (productCosts[productId] || 0) * quantity;
      platformData[platform].adSpend += productAdSpend[productId] || 0;
    });
  });

  const channels = Object.entries(platformData).map(([platform, data]) => {
    const profit = data.revenue - data.cost - data.adSpend;
    const roi = data.cost + data.adSpend > 0 
      ? ((profit) / (data.cost + data.adSpend)) * 100 
      : 0;
    
    return {
      platform,
      revenue: data.revenue,
      cost: data.cost,
      adSpend: data.adSpend,
      profit,
      roi: Math.round(roi * 100) / 100
    };
  });

  const totalRevenue = channels.reduce((sum, c) => sum + c.revenue, 0);
  const totalProfit = channels.reduce((sum, c) => sum + c.profit, 0);

  return {
    type: 'roi_by_channel',
    period: `${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`,
    summary: {
      totalChannels: channels.length,
      totalRevenue,
      totalProfit,
      averageROI: channels.length > 0 
        ? channels.reduce((sum, c) => sum + c.roi, 0) / channels.length 
        : 0
    },
    channels
  };
}

// ─── XLSX Generation (XML Spreadsheet) ───────────────────────────

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildXlsxSheet(headers: string[], rows: string[][]): string {
  let sheetData = '';
  
  // Header row
  sheetData += '<Row>';
  for (const h of headers) {
    sheetData += `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`;
  }
  sheetData += '</Row>\n';
  
  // Data rows
  for (const row of rows) {
    sheetData += '<Row>';
    for (const cell of row) {
      // Detect if numeric (for Excel formatting)
      const num = parseFloat(cell.replace(/[R$\s%,]/g, '').replace(',', '.'));
      if (!isNaN(num) && cell.trim() !== '' && !/[a-zA-ZÀ-ú]/.test(cell.replace(/R\$/, ''))) {
        sheetData += `<Cell><Data ss:Type="Number">${num}</Data></Cell>`;
      } else {
        sheetData += `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`;
      }
    }
    sheetData += '</Row>\n';
  }
  
  return sheetData;
}

function wrapXlsxWorkbook(sheets: { name: string; data: string }[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xml += '  xmlns:o="urn:schemas-microsoft-com:office:office"\n';
  xml += '  xmlns:x="urn:schemas-microsoft-com:office:excel"\n';
  xml += '  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
  xml += '<Styles>\n';
  xml += '  <Style ss:ID="Default" ss:Name="Normal"><Font ss:FontName="Calibri" ss:Size="11"/></Style>\n';
  xml += '  <Style ss:ID="Header"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/><Interior ss:Color="#D9E1F2" ss:Pattern="Solid"/></Style>\n';
  xml += '</Styles>\n';
  
  for (const sheet of sheets) {
    xml += `<Worksheet ss:Name="${escapeXml(sheet.name)}">\n`;
    xml += '<Table>\n';
    xml += sheet.data;
    xml += '</Table>\n';
    xml += '</Worksheet>\n';
  }
  
  xml += '</Workbook>';
  return xml;
}

function generateXLSX(reportData: any): string {
  console.log('📊 Generating XLSX format');
  
  let headers: string[];
  let rows: string[][];
  let summaryHeaders: string[];
  let summaryRows: string[][];
  let sheetName: string;
  
  switch (reportData.type) {
    case 'sales': {
      sheetName = 'Vendas';
      headers = ['Data', 'ID do Pedido', 'Plataforma', 'Valor Total', 'Itens'];
      rows = (reportData.orders || []).map((o: any) => [
        new Date(o.order_date).toLocaleDateString('pt-BR'),
        o.order_id_channel,
        o.platform,
        `R$ ${o.total_value?.toFixed(2) || '0.00'}`,
        String(Array.isArray(o.items) ? o.items.length : 0),
      ]);
      summaryHeaders = ['Métrica', 'Valor'];
      summaryRows = [
        ['Total de Pedidos', String(reportData.summary.totalOrders)],
        ['Receita Total', `R$ ${reportData.summary.totalRevenue?.toFixed(2) || '0.00'}`],
        ['Valor Médio', `R$ ${reportData.summary.averageOrderValue?.toFixed(2) || '0.00'}`],
      ];
      break;
    }
    case 'profitability': {
      sheetName = 'Lucratividade';
      headers = ['Produto', 'SKU', 'Preço de Custo', 'Preço de Venda', 'Lucro', 'Margem (%)'];
      rows = (reportData.products || []).map((p: any) => [
        p.name,
        p.sku,
        `R$ ${p.cost_price?.toFixed(2) || '0.00'}`,
        `R$ ${p.selling_price?.toFixed(2) || '0.00'}`,
        `R$ ${p.profit?.toFixed(2) || '0.00'}`,
        `${p.margin?.toFixed(2) || '0.00'}%`,
      ]);
      summaryHeaders = ['Métrica', 'Valor'];
      summaryRows = [
        ['Total de Produtos', String(reportData.summary.totalProducts)],
        ['Lucro Total', `R$ ${reportData.summary.totalProfit?.toFixed(2) || '0.00'}`],
        ['Margem Média', `${reportData.summary.averageMargin?.toFixed(2) || '0.00'}%`],
      ];
      break;
    }
    case 'marketplace_performance': {
      sheetName = 'Marketplaces';
      headers = ['Plataforma', 'Total de Pedidos', 'Receita Total', 'Valor Médio'];
      rows = (reportData.platforms || []).map((p: any) => [
        p.platform,
        String(p.totalOrders),
        `R$ ${p.totalRevenue?.toFixed(2) || '0.00'}`,
        `R$ ${p.averageOrderValue?.toFixed(2) || '0.00'}`,
      ]);
      summaryHeaders = ['Métrica', 'Valor'];
      summaryRows = [
        ['Total de Plataformas', String(reportData.summary.totalPlatforms)],
        ['Total de Pedidos', String(reportData.summary.totalOrders)],
        ['Receita Total', `R$ ${reportData.summary.totalRevenue?.toFixed(2) || '0.00'}`],
      ];
      break;
    }
    case 'trends': {
      sheetName = 'Tendências';
      headers = ['Mês', 'Total de Pedidos', 'Receita Total', 'Crescimento (%)'];
      rows = (reportData.months || []).map((m: any) => [
        m.month,
        String(m.totalOrders),
        `R$ ${m.totalRevenue?.toFixed(2) || '0.00'}`,
        `${m.revenueGrowth?.toFixed(2) || '0.00'}%`,
      ]);
      summaryHeaders = ['Métrica', 'Valor'];
      summaryRows = [
        ['Total de Meses', String(reportData.summary.totalMonths)],
        ['Receita Média Mensal', `R$ ${reportData.summary.averageMonthlyRevenue?.toFixed(2) || '0.00'}`],
        ['Crescimento Médio', `${reportData.summary.averageGrowth?.toFixed(2) || '0.00'}%`],
      ];
      break;
    }
    case 'stock_forecast': {
      sheetName = 'Previsão Estoque';
      headers = ['Produto', 'SKU', 'Estoque Atual', 'Vendidos', 'Vendas/Dia', 'Dias até Esgotar', 'Reposição Recomendada', 'Status'];
      rows = (reportData.forecasts || []).map((f: any) => [
        f.name,
        f.sku,
        String(f.currentStock),
        String(f.totalSold),
        String(f.dailySalesRate),
        String(f.daysUntilStockout),
        String(f.recommendedReorder),
        f.stockStatus,
      ]);
      summaryHeaders = ['Métrica', 'Valor'];
      summaryRows = [
        ['Total de Produtos', String(reportData.summary.totalProducts)],
        ['Estoque Crítico', String(reportData.summary.criticalStock)],
        ['Estoque Baixo', String(reportData.summary.lowStock)],
      ];
      break;
    }
    case 'roi_by_channel': {
      sheetName = 'ROI por Canal';
      headers = ['Canal', 'Receita', 'Custo', 'Gasto com Ads', 'Lucro', 'ROI (%)'];
      rows = (reportData.channels || []).map((c: any) => [
        c.platform,
        `R$ ${c.revenue?.toFixed(2) || '0.00'}`,
        `R$ ${c.cost?.toFixed(2) || '0.00'}`,
        `R$ ${c.adSpend?.toFixed(2) || '0.00'}`,
        `R$ ${c.profit?.toFixed(2) || '0.00'}`,
        `${c.roi?.toFixed(2) || '0.00'}%`,
      ]);
      summaryHeaders = ['Métrica', 'Valor'];
      summaryRows = [
        ['Total de Canais', String(reportData.summary.totalChannels)],
        ['Receita Total', `R$ ${reportData.summary.totalRevenue?.toFixed(2) || '0.00'}`],
        ['Lucro Total', `R$ ${reportData.summary.totalProfit?.toFixed(2) || '0.00'}`],
        ['ROI Médio', `${reportData.summary.averageROI?.toFixed(2) || '0.00'}%`],
      ];
      break;
    }
    default:
      throw new Error('Unknown report type for XLSX generation');
  }
  
  const dataSheet = buildXlsxSheet(headers, rows);
  const summarySheet = buildXlsxSheet(summaryHeaders, summaryRows);
  
  const xlsxContent = wrapXlsxWorkbook([
    { name: sheetName, data: dataSheet },
    { name: 'Resumo', data: summarySheet },
  ]);
  
  // Encode to base64 (the caller expects base64 for isBinary)
  return btoa(unescape(encodeURIComponent(xlsxContent)));
}

// Generate CSV content
function generateCSV(reportData: any): string {
  console.log('📄 Generating CSV format');
  
  switch (reportData.type) {
    case 'sales':
      return generateSalesCSV(reportData);
    case 'profitability':
      return generateProfitabilityCSV(reportData);
    case 'marketplace_performance':
      return generateMarketplaceCSV(reportData);
    case 'trends':
      return generateTrendsCSV(reportData);
    case 'stock_forecast':
      return generateStockForecastCSV(reportData);
    case 'roi_by_channel':
      return generateROICSV(reportData);
    default:
      throw new Error('Unknown report type for CSV generation');
  }
}

function generateSalesCSV(reportData: any): string {
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
}

function generateProfitabilityCSV(reportData: any): string {
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

function generateMarketplaceCSV(reportData: any): string {
  let csv = 'Plataforma,Total de Pedidos,Receita Total,Valor Médio\n';
  
  reportData.platforms.forEach((platform: any) => {
    csv += `"${platform.platform}","${platform.totalOrders}","R$ ${platform.totalRevenue?.toFixed(2) || '0.00'}","R$ ${platform.averageOrderValue?.toFixed(2) || '0.00'}"\n`;
  });
  
  csv += `\nResumo:\n`;
  csv += `Total de Plataformas,${reportData.summary.totalPlatforms}\n`;
  csv += `Total de Pedidos,${reportData.summary.totalOrders}\n`;
  csv += `Receita Total,"R$ ${reportData.summary.totalRevenue?.toFixed(2) || '0.00'}"\n`;
  
  return csv;
}

function generateTrendsCSV(reportData: any): string {
  let csv = 'Mês,Total de Pedidos,Receita Total,Crescimento (%)\n';
  
  reportData.months.forEach((month: any) => {
    csv += `"${month.month}","${month.totalOrders}","R$ ${month.totalRevenue?.toFixed(2) || '0.00'}","${month.revenueGrowth?.toFixed(2) || '0.00'}%"\n`;
  });
  
  csv += `\nResumo:\n`;
  csv += `Total de Meses,${reportData.summary.totalMonths}\n`;
  csv += `Receita Média Mensal,"R$ ${reportData.summary.averageMonthlyRevenue?.toFixed(2) || '0.00'}"\n`;
  csv += `Crescimento Médio,"${reportData.summary.averageGrowth?.toFixed(2) || '0.00'}%"\n`;
  
  return csv;
}

function generateStockForecastCSV(reportData: any): string {
  let csv = 'Produto,SKU,Estoque Atual,Vendidos,Vendas/Dia,Dias até Esgotar,Reposição Recomendada,Status\n';
  
  reportData.forecasts.forEach((forecast: any) => {
    csv += `"${forecast.name}","${forecast.sku}","${forecast.currentStock}","${forecast.totalSold}","${forecast.dailySalesRate}","${forecast.daysUntilStockout}","${forecast.recommendedReorder}","${forecast.stockStatus}"\n`;
  });
  
  csv += `\nResumo:\n`;
  csv += `Total de Produtos,${reportData.summary.totalProducts}\n`;
  csv += `Estoque Crítico,${reportData.summary.criticalStock}\n`;
  csv += `Estoque Baixo,${reportData.summary.lowStock}\n`;
  
  return csv;
}

function generateROICSV(reportData: any): string {
  let csv = 'Canal,Receita,Custo,Gasto com Ads,Lucro,ROI (%)\n';
  
  reportData.channels.forEach((channel: any) => {
    csv += `"${channel.platform}","R$ ${channel.revenue?.toFixed(2) || '0.00'}","R$ ${channel.cost?.toFixed(2) || '0.00'}","R$ ${channel.adSpend?.toFixed(2) || '0.00'}","R$ ${channel.profit?.toFixed(2) || '0.00'}","${channel.roi?.toFixed(2) || '0.00'}%"\n`;
  });
  
  csv += `\nResumo:\n`;
  csv += `Total de Canais,${reportData.summary.totalChannels}\n`;
  csv += `Receita Total,"R$ ${reportData.summary.totalRevenue?.toFixed(2) || '0.00'}"\n`;
  csv += `Lucro Total,"R$ ${reportData.summary.totalProfit?.toFixed(2) || '0.00'}"\n`;
  csv += `ROI Médio,"${reportData.summary.averageROI?.toFixed(2) || '0.00'}%"\n`;
  
  return csv;
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
  
  switch (reportData.type) {
    case 'sales':
      content += generateSalesPDF(reportData);
      break;
    case 'profitability':
      content += generateProfitabilityPDF(reportData);
      break;
    case 'marketplace_performance':
      content += generateMarketplacePDF(reportData);
      break;
    case 'trends':
      content += generateTrendsPDF(reportData);
      break;
    case 'stock_forecast':
      content += generateStockForecastPDF(reportData);
      break;
    case 'roi_by_channel':
      content += generateROIPDF(reportData);
      break;
  }
  
  return content;
}

function generateSalesPDF(reportData: any): string {
  let content = `RESUMO DE VENDAS\n`;
  content += `Total de Pedidos: ${reportData.summary.totalOrders}\n`;
  content += `Receita Total: R$ ${reportData.summary.totalRevenue?.toFixed(2) || '0.00'}\n`;
  content += `Valor Médio do Pedido: R$ ${reportData.summary.averageOrderValue?.toFixed(2) || '0.00'}\n\n`;
  
  content += `DETALHES DOS PEDIDOS:\n`;
  reportData.orders.forEach((order: any) => {
    const date = new Date(order.order_date).toLocaleDateString('pt-BR');
    content += `${date} - ${order.order_id_channel} (${order.platform}) - R$ ${order.total_value?.toFixed(2) || '0.00'}\n`;
  });
  
  return content;
}

function generateProfitabilityPDF(reportData: any): string {
  let content = `RESUMO DE LUCRATIVIDADE\n`;
  content += `Total de Produtos: ${reportData.summary.totalProducts}\n`;
  content += `Lucro Total: R$ ${reportData.summary.totalProfit?.toFixed(2) || '0.00'}\n`;
  content += `Margem Média: ${reportData.summary.averageMargin?.toFixed(2) || '0.00'}%\n\n`;
  
  content += `DETALHES POR PRODUTO:\n`;
  reportData.products.forEach((product: any) => {
    content += `${product.name} (${product.sku}) - Lucro: R$ ${product.profit?.toFixed(2) || '0.00'} (${product.margin?.toFixed(2) || '0.00'}%)\n`;
  });
  
  return content;
}

function generateMarketplacePDF(reportData: any): string {
  let content = `PERFORMANCE POR MARKETPLACE\n`;
  content += `Total de Plataformas: ${reportData.summary.totalPlatforms}\n`;
  content += `Total de Pedidos: ${reportData.summary.totalOrders}\n`;
  content += `Receita Total: R$ ${reportData.summary.totalRevenue?.toFixed(2) || '0.00'}\n\n`;
  
  content += `DETALHES POR PLATAFORMA:\n`;
  reportData.platforms.forEach((platform: any) => {
    content += `${platform.platform}: ${platform.totalOrders} pedidos - R$ ${platform.totalRevenue?.toFixed(2) || '0.00'} (Média: R$ ${platform.averageOrderValue?.toFixed(2) || '0.00'})\n`;
  });
  
  return content;
}

function generateTrendsPDF(reportData: any): string {
  let content = `ANÁLISE DE TENDÊNCIAS\n`;
  content += `Total de Meses: ${reportData.summary.totalMonths}\n`;
  content += `Receita Média Mensal: R$ ${reportData.summary.averageMonthlyRevenue?.toFixed(2) || '0.00'}\n`;
  content += `Crescimento Médio: ${reportData.summary.averageGrowth?.toFixed(2) || '0.00'}%\n\n`;
  
  content += `EVOLUÇÃO MENSAL:\n`;
  reportData.months.forEach((month: any) => {
    const growthIndicator = month.revenueGrowth >= 0 ? '↑' : '↓';
    content += `${month.month}: ${month.totalOrders} pedidos - R$ ${month.totalRevenue?.toFixed(2) || '0.00'} (${growthIndicator} ${Math.abs(month.revenueGrowth)?.toFixed(2)}%)\n`;
  });
  
  return content;
}

function generateStockForecastPDF(reportData: any): string {
  let content = `PREVISÃO DE ESTOQUE\n`;
  content += `Total de Produtos: ${reportData.summary.totalProducts}\n`;
  content += `Estoque Crítico: ${reportData.summary.criticalStock}\n`;
  content += `Estoque Baixo: ${reportData.summary.lowStock}\n\n`;
  
  content += `PREVISÕES POR PRODUTO:\n`;
  reportData.forecasts.forEach((forecast: any) => {
    content += `[${forecast.stockStatus}] ${forecast.name} (${forecast.sku})\n`;
    content += `  Estoque: ${forecast.currentStock} | Vendas/dia: ${forecast.dailySalesRate} | Dias restantes: ${forecast.daysUntilStockout}\n`;
    content += `  Reposição recomendada: ${forecast.recommendedReorder} unidades\n`;
  });
  
  return content;
}

function generateROIPDF(reportData: any): string {
  let content = `ROI POR CANAL DE VENDA\n`;
  content += `Total de Canais: ${reportData.summary.totalChannels}\n`;
  content += `Receita Total: R$ ${reportData.summary.totalRevenue?.toFixed(2) || '0.00'}\n`;
  content += `Lucro Total: R$ ${reportData.summary.totalProfit?.toFixed(2) || '0.00'}\n`;
  content += `ROI Médio: ${reportData.summary.averageROI?.toFixed(2) || '0.00'}%\n\n`;
  
  content += `DETALHES POR CANAL:\n`;
  reportData.channels.forEach((channel: any) => {
    content += `${channel.platform}:\n`;
    content += `  Receita: R$ ${channel.revenue?.toFixed(2) || '0.00'}\n`;
    content += `  Custo: R$ ${channel.cost?.toFixed(2) || '0.00'} | Ads: R$ ${channel.adSpend?.toFixed(2) || '0.00'}\n`;
    content += `  Lucro: R$ ${channel.profit?.toFixed(2) || '0.00'} | ROI: ${channel.roi?.toFixed(2) || '0.00'}%\n`;
  });
  
  return content;
}
