export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      ad_metrics: {
        Row: {
          ad_account_id: string | null
          campaign_id: string
          campaign_name: string
          clicks: number
          conversion_value: number
          conversions: number
          cpc: number | null
          created_at: string
          ctr: number | null
          date: string
          id: string
          impressions: number
          integration_id: string
          organization_id: string | null
          platform: string
          reach: number | null
          spend: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_account_id?: string | null
          campaign_id: string
          campaign_name: string
          clicks?: number
          conversion_value?: number
          conversions?: number
          cpc?: number | null
          created_at?: string
          ctr?: number | null
          date: string
          id?: string
          impressions?: number
          integration_id: string
          organization_id?: string | null
          platform: string
          reach?: number | null
          spend?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_account_id?: string | null
          campaign_id?: string
          campaign_name?: string
          clicks?: number
          conversion_value?: number
          conversions?: number
          cpc?: number | null
          created_at?: string
          ctr?: number | null
          date?: string
          id?: string
          impressions?: number
          integration_id?: string
          organization_id?: string | null
          platform?: string
          reach?: number | null
          spend?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_metrics_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          organization_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          organization_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          organization_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          created_at: string
          expires_at: string
          generated_at: string
          id: string
          insights: Json
          organization_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          generated_at?: string
          id?: string
          insights?: Json
          organization_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          generated_at?: string
          id?: string
          insights?: Json
          organization_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          created_at: string | null
          id: string
          month_year: string
          organization_id: string | null
          query_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          month_year: string
          organization_id?: string | null
          query_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          month_year?: string
          organization_id?: string | null
          query_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          created_at: string | null
          key: string
          value: string
        }
        Insert: {
          created_at?: string | null
          key: string
          value: string
        }
        Update: {
          created_at?: string | null
          key?: string
          value?: string
        }
        Relationships: []
      }
      attributed_conversions: {
        Row: {
          attributed_at: string
          attributed_spend: number
          attribution_method: string
          attribution_weight: number
          campaign_id: string
          campaign_name: string | null
          conversion_date: string
          created_at: string
          id: string
          order_id: string | null
          order_value: number
          organization_id: string | null
          platform: string
          product_id: string | null
          quantity: number
          sku: string
          user_id: string
        }
        Insert: {
          attributed_at?: string
          attributed_spend?: number
          attribution_method?: string
          attribution_weight?: number
          campaign_id: string
          campaign_name?: string | null
          conversion_date: string
          created_at?: string
          id?: string
          order_id?: string | null
          order_value?: number
          organization_id?: string | null
          platform: string
          product_id?: string | null
          quantity?: number
          sku: string
          user_id: string
        }
        Update: {
          attributed_at?: string
          attributed_spend?: number
          attribution_method?: string
          attribution_weight?: number
          campaign_id?: string
          campaign_name?: string | null
          conversion_date?: string
          created_at?: string
          id?: string
          order_id?: string | null
          order_value?: number
          organization_id?: string | null
          platform?: string
          product_id?: string | null
          quantity?: number
          sku?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attributed_conversions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributed_conversions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributed_conversions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_roi_metrics"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "attributed_conversions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          action_taken: string
          automation_rule_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          organization_id: string | null
        }
        Insert: {
          action_taken: string
          automation_rule_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          organization_id?: string | null
        }
        Update: {
          action_taken?: string
          automation_rule_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_automation_rule_id_fkey"
            columns: ["automation_rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          config: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          organization_id: string | null
          rule_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          organization_id?: string | null
          rule_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          organization_id?: string | null
          rule_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_product_links: {
        Row: {
          campaign_id: string
          campaign_name: string | null
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          link_type: string
          organization_id: string | null
          platform: string
          product_id: string | null
          sku: string
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          campaign_name?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          link_type?: string
          organization_id?: string | null
          platform: string
          product_id?: string | null
          sku: string
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          campaign_name?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          link_type?: string
          organization_id?: string | null
          platform?: string
          product_id?: string | null
          sku?: string
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_product_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_product_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_roi_metrics"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "campaign_product_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          organization_id: string | null
          recurrence: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          organization_id?: string | null
          recurrence?: string
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          organization_id?: string | null
          recurrence?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          account_name: string | null
          account_nickname: string | null
          created_at: string
          encrypted_access_token: string
          encrypted_refresh_token: string | null
          id: string
          marketplace_id: string | null
          organization_id: string | null
          platform: string
          selling_partner_id: string | null
          shop_domain: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name?: string | null
          account_nickname?: string | null
          created_at?: string
          encrypted_access_token: string
          encrypted_refresh_token?: string | null
          id?: string
          marketplace_id?: string | null
          organization_id?: string | null
          platform: string
          selling_partner_id?: string | null
          shop_domain?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string | null
          account_nickname?: string | null
          created_at?: string
          encrypted_access_token?: string
          encrypted_refresh_token?: string | null
          id?: string
          marketplace_id?: string | null
          organization_id?: string | null
          platform?: string
          selling_partner_id?: string | null
          shop_domain?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_fee_profiles: {
        Row: {
          commission_percent: number
          created_at: string
          fixed_fee_amount: number
          id: string
          is_active: boolean
          notes: string | null
          organization_id: string
          payment_fee_percent: number
          platform: string
          shipping_subsidy: number
          tax_percent: number
          tax_regime: string
          updated_at: string
        }
        Insert: {
          commission_percent?: number
          created_at?: string
          fixed_fee_amount?: number
          id?: string
          is_active?: boolean
          notes?: string | null
          organization_id: string
          payment_fee_percent?: number
          platform: string
          shipping_subsidy?: number
          tax_percent?: number
          tax_regime?: string
          updated_at?: string
        }
        Update: {
          commission_percent?: number
          created_at?: string
          fixed_fee_amount?: number
          id?: string
          is_active?: boolean
          notes?: string | null
          organization_id?: string
          payment_fee_percent?: number
          platform?: string
          shipping_subsidy?: number
          tax_percent?: number
          tax_regime?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_fee_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_financial_history: {
        Row: {
          created_at: string
          gross_profit: number
          id: string
          marketplace_fees: number
          net_profit: number
          organization_id: string | null
          product_costs: number
          total_expenses: number
          total_orders: number
          total_revenue: number
          updated_at: string
          user_id: string
          year_month: string
        }
        Insert: {
          created_at?: string
          gross_profit?: number
          id?: string
          marketplace_fees?: number
          net_profit?: number
          organization_id?: string | null
          product_costs?: number
          total_expenses?: number
          total_orders?: number
          total_revenue?: number
          updated_at?: string
          user_id: string
          year_month: string
        }
        Update: {
          created_at?: string
          gross_profit?: number
          id?: string
          marketplace_fees?: number
          net_profit?: number
          organization_id?: string | null
          product_costs?: number
          total_expenses?: number
          total_orders?: number
          total_revenue?: number
          updated_at?: string
          user_id?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_financial_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          low_stock_alerts: boolean
          organization_id: string | null
          push_enabled: boolean
          sync_error_alerts: boolean
          token_expiring_alerts: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          low_stock_alerts?: boolean
          organization_id?: string | null
          push_enabled?: boolean
          sync_error_alerts?: boolean
          token_expiring_alerts?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          low_stock_alerts?: boolean
          organization_id?: string | null
          push_enabled?: boolean
          sync_error_alerts?: boolean
          token_expiring_alerts?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          organization_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          organization_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          organization_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          carrier: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          id: string
          items: Json
          last_sync_at: string | null
          order_date: string
          order_id_channel: string
          organization_id: string | null
          platform: string
          shipping_address: Json | null
          shipping_history: Json | null
          shipping_status: string | null
          shipping_updated_at: string | null
          status: string | null
          total_value: number
          tracking_code: string | null
          tracking_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          items?: Json
          last_sync_at?: string | null
          order_date?: string
          order_id_channel: string
          organization_id?: string | null
          platform: string
          shipping_address?: Json | null
          shipping_history?: Json | null
          shipping_status?: string | null
          shipping_updated_at?: string | null
          status?: string | null
          total_value: number
          tracking_code?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          carrier?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          items?: Json
          last_sync_at?: string | null
          order_date?: string
          order_id_channel?: string
          organization_id?: string | null
          platform?: string
          shipping_address?: Json | null
          shipping_history?: Json | null
          shipping_status?: string | null
          shipping_updated_at?: string | null
          status?: string | null
          total_value?: number
          tracking_code?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          id: string
          joined_at: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          slug: string
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          slug: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          slug?: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      price_monitoring_jobs: {
        Row: {
          competitor_url: string
          created_at: string
          id: string
          is_active: boolean
          last_price: number | null
          organization_id: string | null
          product_id: string
          trigger_condition: string
          updated_at: string
          user_id: string
        }
        Insert: {
          competitor_url: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_price?: number | null
          organization_id?: string | null
          product_id: string
          trigger_condition?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          competitor_url?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_price?: number | null
          organization_id?: string | null
          product_id?: string
          trigger_condition?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_monitoring_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_monitoring_jobs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_roi_metrics"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "price_monitoring_jobs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_listings: {
        Row: {
          created_at: string | null
          id: string
          integration_id: string
          last_sync_at: string | null
          organization_id: string | null
          platform: string
          platform_metadata: Json | null
          platform_product_id: string
          platform_url: string | null
          platform_variant_id: string | null
          product_id: string
          sync_error: string | null
          sync_status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          integration_id: string
          last_sync_at?: string | null
          organization_id?: string | null
          platform: string
          platform_metadata?: Json | null
          platform_product_id: string
          platform_url?: string | null
          platform_variant_id?: string | null
          product_id: string
          sync_error?: string | null
          sync_status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          integration_id?: string
          last_sync_at?: string | null
          organization_id?: string | null
          platform?: string
          platform_metadata?: Json | null
          platform_product_id?: string
          platform_url?: string | null
          platform_variant_id?: string | null
          product_id?: string
          sync_error?: string | null
          sync_status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_listings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_listings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_roi_metrics"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active_campaign_ids: Json | null
          ad_spend: number | null
          attributed_roas: number | null
          brand: string | null
          category: string | null
          condition: string | null
          cost_price: number | null
          created_at: string
          description: string | null
          dimensions: Json | null
          ean: string | null
          id: string
          image_url: string | null
          images: Json | null
          name: string
          organization_id: string | null
          selling_price: number | null
          sku: string
          stock: number
          supplier_id: string | null
          total_attributed_revenue: number | null
          total_attributed_spend: number | null
          updated_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          active_campaign_ids?: Json | null
          ad_spend?: number | null
          attributed_roas?: number | null
          brand?: string | null
          category?: string | null
          condition?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          dimensions?: Json | null
          ean?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          name: string
          organization_id?: string | null
          selling_price?: number | null
          sku: string
          stock?: number
          supplier_id?: string | null
          total_attributed_revenue?: number | null
          total_attributed_spend?: number | null
          updated_at?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          active_campaign_ids?: Json | null
          ad_spend?: number | null
          attributed_roas?: number | null
          brand?: string | null
          category?: string | null
          condition?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          dimensions?: Json | null
          ean?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          name?: string
          organization_id?: string | null
          selling_price?: number | null
          sku?: string
          stock?: number
          supplier_id?: string | null
          total_attributed_revenue?: number | null
          total_attributed_spend?: number | null
          updated_at?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_name: string | null
          created_at: string
          email: string
          full_name: string | null
          has_completed_onboarding: boolean | null
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"] | null
          role: string
          stripe_customer_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          has_completed_onboarding?: boolean | null
          id: string
          plan?: Database["public"]["Enums"]["subscription_plan"] | null
          role?: string
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          has_completed_onboarding?: boolean | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"] | null
          role?: string
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          created_at: string
          expected_delivery: string | null
          id: string
          items: Json
          notes: string | null
          order_number: string
          organization_id: string | null
          received_at: string | null
          status: string
          supplier_id: string
          total_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expected_delivery?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_number: string
          organization_id?: string | null
          received_at?: string | null
          status?: string
          supplier_id: string
          total_value?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expected_delivery?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_number?: string
          organization_id?: string | null
          received_at?: string | null
          status?: string
          supplier_id?: string
          total_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_reports: {
        Row: {
          created_at: string
          format: string
          frequency: string
          id: string
          is_active: boolean
          last_sent_at: string | null
          next_run_at: string
          organization_id: string | null
          report_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          format?: string
          frequency: string
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          next_run_at: string
          organization_id?: string | null
          report_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          format?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          next_run_at?: string
          organization_id?: string | null
          report_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: Json | null
          cnpj_cpf: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          organization_id: string | null
          payment_terms: string | null
          phone: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: Json | null
          cnpj_cpf?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          organization_id?: string | null
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: Json | null
          cnpj_cpf?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          organization_id?: string | null
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_financial_settings: {
        Row: {
          created_at: string
          id: string
          marketplace_fee_percent: number
          organization_id: string | null
          target_margin_percent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          marketplace_fee_percent?: number
          organization_id?: string | null
          target_margin_percent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          marketplace_fee_percent?: number
          organization_id?: string | null
          target_margin_percent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_financial_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      product_roi_metrics: {
        Row: {
          attributed_orders: number | null
          cost_per_acquisition: number | null
          cost_price: number | null
          organization_id: string | null
          product_id: string | null
          product_name: string | null
          roas: number | null
          selling_price: number | null
          sku: string | null
          total_attributed_revenue: number | null
          total_attributed_spend: number | null
          total_attributed_units: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_write_in_org: { Args: { user_uuid: string }; Returns: boolean }
      decrypt_token: { Args: { encrypted_token: string }; Returns: string }
      delete_user_account: { Args: never; Returns: Json }
      encrypt_token: { Args: { token: string }; Returns: string }
      get_user_org_id: { Args: { user_uuid: string }; Returns: string }
      get_user_org_role: {
        Args: { user_uuid: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_admin: { Args: { user_uuid: string }; Returns: boolean }
      migrate_integration_tokens: {
        Args: never
        Returns: {
          failed_count: number
          migrated_count: number
        }[]
      }
      notify_user: {
        Args: {
          p_message: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      org_role: "admin" | "operator" | "viewer"
      subscription_plan:
        | "iniciante"
        | "profissional"
        | "enterprise"
        | "unlimited"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      org_role: ["admin", "operator", "viewer"],
      subscription_plan: [
        "iniciante",
        "profissional",
        "enterprise",
        "unlimited",
      ],
    },
  },
} as const
