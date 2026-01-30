import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[MANAGE-ORG] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      logStep("Auth error", { error: userError });
      return new Response(
        JSON.stringify({ success: false, error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action } = body;
    logStep("Processing action", { action, userId: user.id });

    // === JOIN ORGANIZATION ===
    if (action === 'join') {
      const { code } = body;
      
      if (!code || code.length !== 8) {
        return new Response(
          JSON.stringify({ success: false, error: "Código inválido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find the invite
      const { data: invite, error: inviteError } = await supabaseClient
        .from('organization_invites')
        .select('*, organizations(id, name)')
        .eq('code', code.toUpperCase())
        .is('used_by', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (inviteError || !invite) {
        logStep("Invite not found", { code, error: inviteError });
        return new Response(
          JSON.stringify({ success: false, error: "Código inválido ou expirado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      logStep("Invite found", { inviteId: invite.id, orgId: invite.organization_id });

      // Check if user is already in this organization
      const { data: existingMember } = await supabaseClient
        .from('organization_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', invite.organization_id)
        .single();

      if (existingMember) {
        return new Response(
          JSON.stringify({ success: false, error: "Você já faz parte desta organização" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get user's current organization
      const { data: currentMembership } = await supabaseClient
        .from('organization_members')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .single();

      // Start transaction-like operations
      // 1. Remove from current organization if exists
      if (currentMembership) {
        // Check if user is the only admin of current org
        const { data: orgAdmins } = await supabaseClient
          .from('organization_members')
          .select('id')
          .eq('organization_id', currentMembership.organization_id)
          .eq('role', 'admin');

        // If user is the only admin, check if there are other members
        const { data: orgMembers } = await supabaseClient
          .from('organization_members')
          .select('id')
          .eq('organization_id', currentMembership.organization_id);

        if (orgAdmins?.length === 1 && orgMembers && orgMembers.length > 1) {
          // User is only admin but has other members - need to transfer ownership first
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Você é o único admin da sua organização atual. Promova outro membro antes de sair." 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // If user is alone in org, we can delete the org
        if (orgMembers?.length === 1) {
          await supabaseClient
            .from('organizations')
            .delete()
            .eq('id', currentMembership.organization_id);
          logStep("Deleted empty organization", { orgId: currentMembership.organization_id });
        } else {
          // Just remove membership
          await supabaseClient
            .from('organization_members')
            .delete()
            .eq('id', currentMembership.id);
        }
      }

      // 2. Add to new organization
      const { error: addError } = await supabaseClient
        .from('organization_members')
        .insert({
          organization_id: invite.organization_id,
          user_id: user.id,
          role: invite.role,
        });

      if (addError) {
        logStep("Error adding member", { error: addError });
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao adicionar membro" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 3. Mark invite as used
      await supabaseClient
        .from('organization_invites')
        .update({
          used_by: user.id,
          used_at: new Date().toISOString(),
        })
        .eq('id', invite.id);

      // 4. Update user's data to new organization
      const newOrgId = invite.organization_id;
      
      // Update all user's data to the new organization
      const tablesToUpdate = [
        'products', 'orders', 'integrations', 'suppliers', 'expenses',
        'product_listings', 'ai_usage', 'ai_conversations', 'notifications',
        'scheduled_reports', 'purchase_orders', 'price_monitoring_jobs',
        'monthly_financial_history', 'user_financial_settings', 'notification_preferences'
      ];

      for (const table of tablesToUpdate) {
        await supabaseClient
          .from(table)
          .update({ organization_id: newOrgId })
          .eq('user_id', user.id);
      }

      logStep("User joined organization successfully", { userId: user.id, orgId: newOrgId });

      return new Response(
        JSON.stringify({ 
          success: true, 
          organization: invite.organizations,
          role: invite.role,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === GET ORGANIZATION INFO ===
    if (action === 'info') {
      const { data: membership, error: memberError } = await supabaseClient
        .from('organization_members')
        .select(`
          role,
          organizations (
            id, name, slug, plan, owner_id, created_at
          )
        `)
        .eq('user_id', user.id)
        .single();

      if (memberError || !membership) {
        return new Response(
          JSON.stringify({ success: false, error: "Organização não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          organization: membership.organizations,
          role: membership.role,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Ação não reconhecida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
