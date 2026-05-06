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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_generation_jobs: {
        Row: {
          created_at: string | null
          id: string
          input: Json | null
          job_type: string | null
          output: Json | null
          product_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          input?: Json | null
          job_type?: string | null
          output?: Json | null
          product_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          input?: Json | null
          job_type?: string | null
          output?: Json | null
          product_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generation_jobs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogue_products: {
        Row: {
          catalogue_id: string
          id: string
          product_id: string
          section: string | null
          sort_order: number | null
        }
        Insert: {
          catalogue_id: string
          id?: string
          product_id: string
          section?: string | null
          sort_order?: number | null
        }
        Update: {
          catalogue_id?: string
          id?: string
          product_id?: string
          section?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "catalogue_products_catalogue_id_fkey"
            columns: ["catalogue_id"]
            isOneToOne: false
            referencedRelation: "catalogues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogue_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogues: {
        Row: {
          catalogue_type: string | null
          client_name: string | null
          cover_image_url: string | null
          created_at: string | null
          created_by: string | null
          expiry_date: string | null
          id: string
          intro_text: string | null
          is_published: boolean | null
          language: string | null
          price_visibility: string | null
          public_slug: string | null
          subtitle: string | null
          theme: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          catalogue_type?: string | null
          client_name?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          intro_text?: string | null
          is_published?: boolean | null
          language?: string | null
          price_visibility?: string | null
          public_slug?: string | null
          subtitle?: string | null
          theme?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          catalogue_type?: string | null
          client_name?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          intro_text?: string | null
          is_published?: boolean | null
          language?: string | null
          price_visibility?: string | null
          public_slug?: string | null
          subtitle?: string | null
          theme?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      hamper_items: {
        Row: {
          child_product_id: string | null
          component_name: string | null
          hamper_id: string
          id: string
          is_customer_visible: boolean | null
          is_packaging_component: boolean | null
          quantity: number | null
          unit: string | null
        }
        Insert: {
          child_product_id?: string | null
          component_name?: string | null
          hamper_id: string
          id?: string
          is_customer_visible?: boolean | null
          is_packaging_component?: boolean | null
          quantity?: number | null
          unit?: string | null
        }
        Update: {
          child_product_id?: string | null
          component_name?: string | null
          hamper_id?: string
          id?: string
          is_customer_visible?: boolean | null
          is_packaging_component?: boolean | null
          quantity?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hamper_items_child_product_id_fkey"
            columns: ["child_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hamper_items_hamper_id_fkey"
            columns: ["hamper_id"]
            isOneToOne: false
            referencedRelation: "hampers"
            referencedColumns: ["id"]
          },
        ]
      }
      hampers: {
        Row: {
          created_at: string | null
          description: string | null
          estimated_cost: number | null
          estimated_weight_g: number | null
          id: string
          name: string
          parent_product_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          estimated_cost?: number | null
          estimated_weight_g?: number | null
          id?: string
          name: string
          parent_product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          estimated_cost?: number | null
          estimated_weight_g?: number | null
          id?: string
          name?: string
          parent_product_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hampers_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          allergen_group: string | null
          id: string
          name: string
          notes: string | null
          veg_status: string | null
        }
        Insert: {
          allergen_group?: string | null
          id?: string
          name: string
          notes?: string | null
          veg_status?: string | null
        }
        Update: {
          allergen_group?: string | null
          id?: string
          name?: string
          notes?: string | null
          veg_status?: string | null
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          id: string
          key: string
          label: string | null
          notes: string | null
          status: string | null
        }
        Insert: {
          id?: string
          key: string
          label?: string | null
          notes?: string | null
          status?: string | null
        }
        Update: {
          id?: string
          key?: string
          label?: string | null
          notes?: string | null
          status?: string | null
        }
        Relationships: []
      }
      labels: {
        Row: {
          barcode: string | null
          batch_no: string | null
          best_before: string | null
          country_of_origin: string | null
          customer_care: string | null
          fssai_license: string | null
          id: string
          manufacturer: string | null
          mfg_date: string | null
          mrp: number | null
          net_quantity: string | null
          product_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          batch_no?: string | null
          best_before?: string | null
          country_of_origin?: string | null
          customer_care?: string | null
          fssai_license?: string | null
          id?: string
          manufacturer?: string | null
          mfg_date?: string | null
          mrp?: number | null
          net_quantity?: string | null
          product_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          batch_no?: string | null
          best_before?: string | null
          country_of_origin?: string | null
          customer_care?: string | null
          fssai_license?: string | null
          id?: string
          manufacturer?: string | null
          mfg_date?: string | null
          mrp?: number | null
          net_quantity?: string | null
          product_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "labels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_panels: {
        Row: {
          added_sugar_g: number | null
          carbohydrate_g: number | null
          energy_kcal: number | null
          id: string
          needs_review: boolean | null
          product_id: string
          protein_g: number | null
          remarks: string | null
          saturated_fat_g: number | null
          serving_size: string | null
          sodium_mg: number | null
          total_fat_g: number | null
          total_sugar_g: number | null
          trans_fat_g: number | null
        }
        Insert: {
          added_sugar_g?: number | null
          carbohydrate_g?: number | null
          energy_kcal?: number | null
          id?: string
          needs_review?: boolean | null
          product_id: string
          protein_g?: number | null
          remarks?: string | null
          saturated_fat_g?: number | null
          serving_size?: string | null
          sodium_mg?: number | null
          total_fat_g?: number | null
          total_sugar_g?: number | null
          trans_fat_g?: number | null
        }
        Update: {
          added_sugar_g?: number | null
          carbohydrate_g?: number | null
          energy_kcal?: number | null
          id?: string
          needs_review?: boolean | null
          product_id?: string
          protein_g?: number | null
          remarks?: string | null
          saturated_fat_g?: number | null
          serving_size?: string | null
          sodium_mg?: number | null
          total_fat_g?: number | null
          total_sugar_g?: number | null
          trans_fat_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_panels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ingredients: {
        Row: {
          display_order: number | null
          id: string
          ingredient_id: string
          percentage: number | null
          product_id: string
        }
        Insert: {
          display_order?: number | null
          id?: string
          ingredient_id: string
          percentage?: number | null
          product_id: string
        }
        Update: {
          display_order?: number | null
          id?: string
          ingredient_id?: string
          percentage?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          alt_text: string | null
          angle: string | null
          created_at: string | null
          file_url: string
          id: string
          product_id: string | null
          status: string | null
          type: string | null
        }
        Insert: {
          alt_text?: string | null
          angle?: string | null
          created_at?: string | null
          file_url: string
          id?: string
          product_id?: string | null
          status?: string | null
          type?: string | null
        }
        Update: {
          alt_text?: string | null
          angle?: string | null
          created_at?: string | null
          file_url?: string
          id?: string
          product_id?: string | null
          status?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tags: {
        Row: {
          product_id: string
          tag_id: string
        }
        Insert: {
          product_id: string
          tag_id: string
        }
        Update: {
          product_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          b2b_price: number | null
          carton_logic: string | null
          category: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          export_price: number | null
          gross_weight_g: number | null
          gst_rate: number | null
          hero_image_url: string | null
          hsn_code: string | null
          id: string
          is_active: boolean | null
          is_catalogue_ready: boolean | null
          is_sample: boolean | null
          label_status: string | null
          media_status: string | null
          moq_text: string | null
          mrp: number | null
          net_weight_g: number | null
          pack_size: string | null
          product_name: string
          product_type: string | null
          shelf_life_days: number | null
          short_description: string | null
          short_name: string | null
          sku: string
          storage_instructions: string | null
          subcategory: string | null
          updated_at: string | null
        }
        Insert: {
          b2b_price?: number | null
          carton_logic?: string | null
          category?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          export_price?: number | null
          gross_weight_g?: number | null
          gst_rate?: number | null
          hero_image_url?: string | null
          hsn_code?: string | null
          id?: string
          is_active?: boolean | null
          is_catalogue_ready?: boolean | null
          is_sample?: boolean | null
          label_status?: string | null
          media_status?: string | null
          moq_text?: string | null
          mrp?: number | null
          net_weight_g?: number | null
          pack_size?: string | null
          product_name: string
          product_type?: string | null
          shelf_life_days?: number | null
          short_description?: string | null
          short_name?: string | null
          sku: string
          storage_instructions?: string | null
          subcategory?: string | null
          updated_at?: string | null
        }
        Update: {
          b2b_price?: number | null
          carton_logic?: string | null
          category?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          export_price?: number | null
          gross_weight_g?: number | null
          gst_rate?: number | null
          hero_image_url?: string | null
          hsn_code?: string | null
          id?: string
          is_active?: boolean | null
          is_catalogue_ready?: boolean | null
          is_sample?: boolean | null
          label_status?: string | null
          media_status?: string | null
          moq_text?: string | null
          mrp?: number | null
          net_weight_g?: number | null
          pack_size?: string | null
          product_name?: string
          product_type?: string | null
          shelf_life_days?: number | null
          short_description?: string | null
          short_name?: string | null
          sku?: string
          storage_instructions?: string | null
          subcategory?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      share_links: {
        Row: {
          catalogue_id: string | null
          channel: string | null
          created_at: string | null
          id: string
          recipient: string | null
          slug: string
        }
        Insert: {
          catalogue_id?: string | null
          channel?: string | null
          created_at?: string | null
          id?: string
          recipient?: string | null
          slug: string
        }
        Update: {
          catalogue_id?: string | null
          channel?: string | null
          created_at?: string | null
          id?: string
          recipient?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_catalogue_id_fkey"
            columns: ["catalogue_id"]
            isOneToOne: false
            referencedRelation: "catalogues"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          group_name: string
          id: string
          name: string
        }
        Insert: {
          group_name: string
          id?: string
          name: string
        }
        Update: {
          group_name?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_team_member: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "owner"
        | "admin"
        | "product_manager"
        | "catalogue_manager"
        | "designer"
        | "sales"
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
      app_role: [
        "owner",
        "admin",
        "product_manager",
        "catalogue_manager",
        "designer",
        "sales",
      ],
    },
  },
} as const
