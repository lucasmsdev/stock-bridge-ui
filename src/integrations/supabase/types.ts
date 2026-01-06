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
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          created_at: string | null
          id: string
          month_year: string
          query_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          month_year: string
          query_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          month_year?: string
          query_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
          recurrence?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          access_token: string
          account_name: string | null
          account_nickname: string | null
          created_at: string
          encrypted_access_token: string | null
          encrypted_refresh_token: string | null
          encryption_migrated: boolean | null
          id: string
          marketplace_id: string | null
          platform: string
          refresh_token: string | null
          selling_partner_id: string | null
          shop_domain: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          account_name?: string | null
          account_nickname?: string | null
          created_at?: string
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          encryption_migrated?: boolean | null
          id?: string
          marketplace_id?: string | null
          platform: string
          refresh_token?: string | null
          selling_partner_id?: string | null
          shop_domain?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          account_name?: string | null
          account_nickname?: string | null
          created_at?: string
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          encryption_migrated?: boolean | null
          id?: string
          marketplace_id?: string | null
          platform?: string
          refresh_token?: string | null
          selling_partner_id?: string | null
          shop_domain?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          product_costs?: number
          total_expenses?: number
          total_orders?: number
          total_revenue?: number
          updated_at?: string
          user_id?: string
          year_month?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string | null
          id: string
          items: Json
          last_sync_at: string | null
          order_date: string
          order_id_channel: string
          platform: string
          shipping_address: Json | null
          status: string | null
          total_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          items?: Json
          last_sync_at?: string | null
          order_date?: string
          order_id_channel: string
          platform: string
          shipping_address?: Json | null
          status?: string | null
          total_value: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          items?: Json
          last_sync_at?: string | null
          order_date?: string
          order_id_channel?: string
          platform?: string
          shipping_address?: Json | null
          status?: string | null
          total_value?: number
          updated_at?: string
          user_id?: string
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
          product_id?: string
          trigger_condition?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
          ad_spend: number | null
          brand: string | null
          category: string | null
          condition: string | null
          cost_price: number | null
          created_at: string
          description: string | null
          dimensions: Json | null
          id: string
          image_url: string | null
          images: Json | null
          name: string
          selling_price: number | null
          sku: string
          stock: number
          supplier_id: string | null
          updated_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          ad_spend?: number | null
          brand?: string | null
          category?: string | null
          condition?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          dimensions?: Json | null
          id?: string
          image_url?: string | null
          images?: Json | null
          name: string
          selling_price?: number | null
          sku: string
          stock?: number
          supplier_id?: string | null
          updated_at?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          ad_spend?: number | null
          brand?: string | null
          category?: string | null
          condition?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          dimensions?: Json | null
          id?: string
          image_url?: string | null
          images?: Json | null
          name?: string
          selling_price?: number | null
          sku?: string
          stock?: number
          supplier_id?: string | null
          updated_at?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: [
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
          received_at?: string | null
          status?: string
          supplier_id?: string
          total_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      user_financial_settings: {
        Row: {
          created_at: string
          id: string
          marketplace_fee_percent: number
          target_margin_percent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          marketplace_fee_percent?: number
          target_margin_percent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          marketplace_fee_percent?: number
          target_margin_percent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      [_ in never]: never
    }
    Functions: {
      decrypt_token: { Args: { encrypted_token: string }; Returns: string }
      delete_user_account: { Args: never; Returns: Json }
      encrypt_token: { Args: { token: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      migrate_integration_tokens: {
        Args: never
        Returns: {
          failed_count: number
          migrated_count: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      subscription_plan: [
        "iniciante",
        "profissional",
        "enterprise",
        "unlimited",
      ],
    },
  },
} as const
