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
          archived_at: string | null
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
          last_previewed_at: string | null
          price_visibility: string | null
          proposal_customization_note: string | null
          proposal_footer_note: string | null
          proposal_tax_note: string | null
          proposal_transport_note: string | null
          proposal_validity_note: string | null
          proposal_whatsapp_message: string | null
          public_slug: string | null
          published_at: string | null
          show_discount: boolean | null
          show_mrp: boolean | null
          show_price: boolean | null
          show_price_label: string | null
          status: string
          subtitle: string | null
          target_customer_channel: string | null
          theme: string | null
          title: string
          unpublished_at: string | null
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
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
          last_previewed_at?: string | null
          price_visibility?: string | null
          proposal_customization_note?: string | null
          proposal_footer_note?: string | null
          proposal_tax_note?: string | null
          proposal_transport_note?: string | null
          proposal_validity_note?: string | null
          proposal_whatsapp_message?: string | null
          public_slug?: string | null
          published_at?: string | null
          show_discount?: boolean | null
          show_mrp?: boolean | null
          show_price?: boolean | null
          show_price_label?: string | null
          status?: string
          subtitle?: string | null
          target_customer_channel?: string | null
          theme?: string | null
          title: string
          unpublished_at?: string | null
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
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
          last_previewed_at?: string | null
          price_visibility?: string | null
          proposal_customization_note?: string | null
          proposal_footer_note?: string | null
          proposal_tax_note?: string | null
          proposal_transport_note?: string | null
          proposal_validity_note?: string | null
          proposal_whatsapp_message?: string | null
          public_slug?: string | null
          published_at?: string | null
          show_discount?: boolean | null
          show_mrp?: boolean | null
          show_price?: boolean | null
          show_price_label?: string | null
          status?: string
          subtitle?: string | null
          target_customer_channel?: string | null
          theme?: string | null
          title?: string
          unpublished_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      feature_activation_audit: {
        Row: {
          action: string | null
          created_at: string
          feature_key: string | null
          id: string
          new_status: string | null
          notes: string | null
          old_status: string | null
          performed_by: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string
          feature_key?: string | null
          id?: string
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          performed_by?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string
          feature_key?: string | null
          id?: string
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          performed_by?: string | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          feature_key: string
          feature_name: string
          id: string
          is_enabled: boolean
          is_visible: boolean
          last_test_result: string | null
          last_tested_at: string | null
          required_role: string[]
          setup_notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          feature_key: string
          feature_name: string
          id?: string
          is_enabled?: boolean
          is_visible?: boolean
          last_test_result?: string | null
          last_tested_at?: string | null
          required_role?: string[]
          setup_notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          feature_key?: string
          feature_name?: string
          id?: string
          is_enabled?: boolean
          is_visible?: boolean
          last_test_result?: string | null
          last_tested_at?: string | null
          required_role?: string[]
          setup_notes?: string | null
          status?: string
          updated_at?: string
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
      import_logs: {
        Row: {
          created_at: string
          id: string
          import_status: string | null
          pack_size: string | null
          product_id: string | null
          product_name: string | null
          source_document: string | null
          source_page: number | null
          source_pdf_sku: string | null
          warning_notes: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          import_status?: string | null
          pack_size?: string | null
          product_id?: string | null
          product_name?: string | null
          source_document?: string | null
          source_page?: number | null
          source_pdf_sku?: string | null
          warning_notes?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          import_status?: string | null
          pack_size?: string | null
          product_id?: string | null
          product_name?: string | null
          source_document?: string | null
          source_page?: number | null
          source_pdf_sku?: string | null
          warning_notes?: string | null
        }
        Relationships: []
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
          created_at: string
          display_name: string
          id: string
          integration_key: string
          last_test_result: Json | null
          last_tested_at: string | null
          notes: string | null
          provider: string | null
          public_config: Json
          secret_required: boolean
          secret_status: string
          status: string | null
          test_endpoint: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          integration_key: string
          last_test_result?: Json | null
          last_tested_at?: string | null
          notes?: string | null
          provider?: string | null
          public_config?: Json
          secret_required?: boolean
          secret_status?: string
          status?: string | null
          test_endpoint?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          integration_key?: string
          last_test_result?: Json | null
          last_tested_at?: string | null
          notes?: string | null
          provider?: string | null
          public_config?: Json
          secret_required?: boolean
          secret_status?: string
          status?: string | null
          test_endpoint?: string | null
          updated_at?: string
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
          locked_at: string | null
          locked_by: string | null
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
          locked_at?: string | null
          locked_by?: string | null
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
          locked_at?: string | null
          locked_by?: string | null
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
      product_aliases: {
        Row: {
          alias: string
          alias_type: string
          confidence_score: number
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          language: string | null
          normalized_alias: string | null
          product_id: string
          script: string | null
          source: string
        }
        Insert: {
          alias: string
          alias_type?: string
          confidence_score?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          language?: string | null
          normalized_alias?: string | null
          product_id: string
          script?: string | null
          source?: string
        }
        Update: {
          alias?: string
          alias_type?: string
          confidence_score?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          language?: string | null
          normalized_alias?: string | null
          product_id?: string
          script?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_aliases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_bom_items: {
        Row: {
          child_product_id: string | null
          component_name: string | null
          component_type: string
          cost_per_unit: number | null
          created_at: string
          id: string
          internal_component_only: boolean
          is_individually_saleable: boolean
          is_packaging_component: boolean
          is_private_label_component: boolean
          issue_to_department: string | null
          lead_time_days: number | null
          notes: string | null
          parent_product_id: string
          production_department: string | null
          quantity: number
          required_before_assembly: boolean
          saleable_product_id: string | null
          show_in_pdf_catalogue: boolean
          show_in_public_catalogue: boolean
          show_on_label: boolean
          show_to_customer: boolean
          sort_order: number
          source_department: string | null
          stock_check_required: boolean
          total_cost: number | null
          unit: string
          updated_at: string
          visibility_scope: string
        }
        Insert: {
          child_product_id?: string | null
          component_name?: string | null
          component_type?: string
          cost_per_unit?: number | null
          created_at?: string
          id?: string
          internal_component_only?: boolean
          is_individually_saleable?: boolean
          is_packaging_component?: boolean
          is_private_label_component?: boolean
          issue_to_department?: string | null
          lead_time_days?: number | null
          notes?: string | null
          parent_product_id: string
          production_department?: string | null
          quantity?: number
          required_before_assembly?: boolean
          saleable_product_id?: string | null
          show_in_pdf_catalogue?: boolean
          show_in_public_catalogue?: boolean
          show_on_label?: boolean
          show_to_customer?: boolean
          sort_order?: number
          source_department?: string | null
          stock_check_required?: boolean
          total_cost?: number | null
          unit?: string
          updated_at?: string
          visibility_scope?: string
        }
        Update: {
          child_product_id?: string | null
          component_name?: string | null
          component_type?: string
          cost_per_unit?: number | null
          created_at?: string
          id?: string
          internal_component_only?: boolean
          is_individually_saleable?: boolean
          is_packaging_component?: boolean
          is_private_label_component?: boolean
          issue_to_department?: string | null
          lead_time_days?: number | null
          notes?: string | null
          parent_product_id?: string
          production_department?: string | null
          quantity?: number
          required_before_assembly?: boolean
          saleable_product_id?: string | null
          show_in_pdf_catalogue?: boolean
          show_in_public_catalogue?: boolean
          show_on_label?: boolean
          show_to_customer?: boolean
          sort_order?: number
          source_department?: string | null
          stock_check_required?: boolean
          total_cost?: number | null
          unit?: string
          updated_at?: string
          visibility_scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_bom_items_child_product_id_fkey"
            columns: ["child_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_bom_items_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_bom_items_saleable_product_id_fkey"
            columns: ["saleable_product_id"]
            isOneToOne: false
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
      product_moq_rules: {
        Row: {
          allow_override: boolean
          carton_logic: string | null
          channel: string
          created_at: string
          customer_type: string | null
          id: string
          increment_uom: string | null
          increment_value: number | null
          min_carton_qty: number | null
          moq_applicable: boolean
          moq_uom: string | null
          moq_value: number | null
          notes: string | null
          override_requires_approval: boolean
          product_id: string
          updated_at: string
        }
        Insert: {
          allow_override?: boolean
          carton_logic?: string | null
          channel: string
          created_at?: string
          customer_type?: string | null
          id?: string
          increment_uom?: string | null
          increment_value?: number | null
          min_carton_qty?: number | null
          moq_applicable?: boolean
          moq_uom?: string | null
          moq_value?: number | null
          notes?: string | null
          override_requires_approval?: boolean
          product_id: string
          updated_at?: string
        }
        Update: {
          allow_override?: boolean
          carton_logic?: string | null
          channel?: string
          created_at?: string
          customer_type?: string | null
          id?: string
          increment_uom?: string | null
          increment_value?: number | null
          min_carton_qty?: number | null
          moq_applicable?: boolean
          moq_uom?: string | null
          moq_value?: number | null
          notes?: string | null
          override_requires_approval?: boolean
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_moq_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pricing_rules: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          base_price: number | null
          calculated_price: number | null
          created_at: string
          currency: string
          discount_percent: number | null
          gst_rate: number | null
          id: string
          notes: string | null
          price_channel: string
          price_type: string
          product_id: string
          source: string
          tax_inclusive: boolean
          uom: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          base_price?: number | null
          calculated_price?: number | null
          created_at?: string
          currency?: string
          discount_percent?: number | null
          gst_rate?: number | null
          id?: string
          notes?: string | null
          price_channel: string
          price_type?: string
          product_id: string
          source?: string
          tax_inclusive?: boolean
          uom?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          base_price?: number | null
          calculated_price?: number | null
          created_at?: string
          currency?: string
          discount_percent?: number | null
          gst_rate?: number | null
          id?: string
          notes?: string | null
          price_channel?: string
          price_type?: string
          product_id?: string
          source?: string
          tax_inclusive?: boolean
          uom?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_pricing_rules_product_id_fkey"
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
          approximate_piece_weight_g: number | null
          avg_qty_per_tray_g: number | null
          b2b_price: number | null
          b2b_price_basis: string | null
          b2b_price_inr: number | null
          b2b_uom: string | null
          bom_required: boolean | null
          carton_dimensions_cm: string | null
          carton_logic: string | null
          carton_qty: number | null
          carton_uom: string | null
          category: string | null
          category_code: string | null
          cbm: number | null
          color_finish_notes: string | null
          created_at: string | null
          currency: string | null
          customization_allowed: boolean | null
          customization_caution: string | null
          customization_note: string | null
          description: string | null
          dimension_h_cm: number | null
          dimension_l_cm: number | null
          dimension_w_cm: number | null
          division_code: string | null
          export_price: number | null
          export_price_usd: number | null
          external_reference_code: string | null
          fixed_carton_required: boolean | null
          frozen_shelf_life_days: number | null
          grammage_g: number | null
          gross_weight_g: number | null
          gross_weight_kg: number | null
          gst_rate: number | null
          hero_image_url: string | null
          hsn_code: string | null
          id: string
          import_confidence: string | null
          increment_uom: string | null
          increment_value: number | null
          is_active: boolean | null
          is_catalogue_ready: boolean | null
          is_sample: boolean | null
          label_status: string | null
          legacy_sku: string | null
          main_department: string | null
          master_carton_qty: number | null
          master_carton_uom: string | null
          material_type: string | null
          media_status: string | null
          moq_rule_type: string | null
          moq_text: string | null
          moq_uom: string | null
          moq_value: number | null
          mrp: number | null
          net_weight_g: number | null
          operational_notes: string | null
          pack_size: string | null
          packaging_code: string | null
          pcs_per_carton: number | null
          pcs_per_pack: number | null
          pdf_primary_packaging: string | null
          pdf_secondary_packaging: string | null
          pdf_shelf_life: string | null
          pdf_status: string | null
          pdf_storage_condition: string | null
          pieces_per_kg: number | null
          post_processing_shelf_life_days: number | null
          price_basis: string | null
          pricing_notes: string | null
          primary_uom: string | null
          private_label_allowed: boolean | null
          private_label_cost_per_unit: number | null
          private_label_moq: number | null
          private_label_moq_uom: string | null
          private_label_upfront_cost: number | null
          product_class: string | null
          product_dimensions_cm: string | null
          product_name: string
          product_type: string | null
          production_department: string | null
          qty_per_carton_kg: number | null
          retail_price_basis: string | null
          retail_uom: string | null
          serial_no: number | null
          shelf_life_days: number | null
          short_description: string | null
          short_name: string | null
          sku: string
          sku_generated_at: string | null
          sku_locked: boolean
          sku_version: number
          source_collection: string | null
          source_document: string | null
          source_notes: string | null
          source_page: number | null
          source_pdf_sku: string | null
          storage_instructions: string | null
          subcategory: string | null
          subcategory_code: string | null
          temperature_requirement: string | null
          thawing_instruction: string | null
          unit_conversion_note: string | null
          updated_at: string | null
        }
        Insert: {
          approximate_piece_weight_g?: number | null
          avg_qty_per_tray_g?: number | null
          b2b_price?: number | null
          b2b_price_basis?: string | null
          b2b_price_inr?: number | null
          b2b_uom?: string | null
          bom_required?: boolean | null
          carton_dimensions_cm?: string | null
          carton_logic?: string | null
          carton_qty?: number | null
          carton_uom?: string | null
          category?: string | null
          category_code?: string | null
          cbm?: number | null
          color_finish_notes?: string | null
          created_at?: string | null
          currency?: string | null
          customization_allowed?: boolean | null
          customization_caution?: string | null
          customization_note?: string | null
          description?: string | null
          dimension_h_cm?: number | null
          dimension_l_cm?: number | null
          dimension_w_cm?: number | null
          division_code?: string | null
          export_price?: number | null
          export_price_usd?: number | null
          external_reference_code?: string | null
          fixed_carton_required?: boolean | null
          frozen_shelf_life_days?: number | null
          grammage_g?: number | null
          gross_weight_g?: number | null
          gross_weight_kg?: number | null
          gst_rate?: number | null
          hero_image_url?: string | null
          hsn_code?: string | null
          id?: string
          import_confidence?: string | null
          increment_uom?: string | null
          increment_value?: number | null
          is_active?: boolean | null
          is_catalogue_ready?: boolean | null
          is_sample?: boolean | null
          label_status?: string | null
          legacy_sku?: string | null
          main_department?: string | null
          master_carton_qty?: number | null
          master_carton_uom?: string | null
          material_type?: string | null
          media_status?: string | null
          moq_rule_type?: string | null
          moq_text?: string | null
          moq_uom?: string | null
          moq_value?: number | null
          mrp?: number | null
          net_weight_g?: number | null
          operational_notes?: string | null
          pack_size?: string | null
          packaging_code?: string | null
          pcs_per_carton?: number | null
          pcs_per_pack?: number | null
          pdf_primary_packaging?: string | null
          pdf_secondary_packaging?: string | null
          pdf_shelf_life?: string | null
          pdf_status?: string | null
          pdf_storage_condition?: string | null
          pieces_per_kg?: number | null
          post_processing_shelf_life_days?: number | null
          price_basis?: string | null
          pricing_notes?: string | null
          primary_uom?: string | null
          private_label_allowed?: boolean | null
          private_label_cost_per_unit?: number | null
          private_label_moq?: number | null
          private_label_moq_uom?: string | null
          private_label_upfront_cost?: number | null
          product_class?: string | null
          product_dimensions_cm?: string | null
          product_name: string
          product_type?: string | null
          production_department?: string | null
          qty_per_carton_kg?: number | null
          retail_price_basis?: string | null
          retail_uom?: string | null
          serial_no?: number | null
          shelf_life_days?: number | null
          short_description?: string | null
          short_name?: string | null
          sku: string
          sku_generated_at?: string | null
          sku_locked?: boolean
          sku_version?: number
          source_collection?: string | null
          source_document?: string | null
          source_notes?: string | null
          source_page?: number | null
          source_pdf_sku?: string | null
          storage_instructions?: string | null
          subcategory?: string | null
          subcategory_code?: string | null
          temperature_requirement?: string | null
          thawing_instruction?: string | null
          unit_conversion_note?: string | null
          updated_at?: string | null
        }
        Update: {
          approximate_piece_weight_g?: number | null
          avg_qty_per_tray_g?: number | null
          b2b_price?: number | null
          b2b_price_basis?: string | null
          b2b_price_inr?: number | null
          b2b_uom?: string | null
          bom_required?: boolean | null
          carton_dimensions_cm?: string | null
          carton_logic?: string | null
          carton_qty?: number | null
          carton_uom?: string | null
          category?: string | null
          category_code?: string | null
          cbm?: number | null
          color_finish_notes?: string | null
          created_at?: string | null
          currency?: string | null
          customization_allowed?: boolean | null
          customization_caution?: string | null
          customization_note?: string | null
          description?: string | null
          dimension_h_cm?: number | null
          dimension_l_cm?: number | null
          dimension_w_cm?: number | null
          division_code?: string | null
          export_price?: number | null
          export_price_usd?: number | null
          external_reference_code?: string | null
          fixed_carton_required?: boolean | null
          frozen_shelf_life_days?: number | null
          grammage_g?: number | null
          gross_weight_g?: number | null
          gross_weight_kg?: number | null
          gst_rate?: number | null
          hero_image_url?: string | null
          hsn_code?: string | null
          id?: string
          import_confidence?: string | null
          increment_uom?: string | null
          increment_value?: number | null
          is_active?: boolean | null
          is_catalogue_ready?: boolean | null
          is_sample?: boolean | null
          label_status?: string | null
          legacy_sku?: string | null
          main_department?: string | null
          master_carton_qty?: number | null
          master_carton_uom?: string | null
          material_type?: string | null
          media_status?: string | null
          moq_rule_type?: string | null
          moq_text?: string | null
          moq_uom?: string | null
          moq_value?: number | null
          mrp?: number | null
          net_weight_g?: number | null
          operational_notes?: string | null
          pack_size?: string | null
          packaging_code?: string | null
          pcs_per_carton?: number | null
          pcs_per_pack?: number | null
          pdf_primary_packaging?: string | null
          pdf_secondary_packaging?: string | null
          pdf_shelf_life?: string | null
          pdf_status?: string | null
          pdf_storage_condition?: string | null
          pieces_per_kg?: number | null
          post_processing_shelf_life_days?: number | null
          price_basis?: string | null
          pricing_notes?: string | null
          primary_uom?: string | null
          private_label_allowed?: boolean | null
          private_label_cost_per_unit?: number | null
          private_label_moq?: number | null
          private_label_moq_uom?: string | null
          private_label_upfront_cost?: number | null
          product_class?: string | null
          product_dimensions_cm?: string | null
          product_name?: string
          product_type?: string | null
          production_department?: string | null
          qty_per_carton_kg?: number | null
          retail_price_basis?: string | null
          retail_uom?: string | null
          serial_no?: number | null
          shelf_life_days?: number | null
          short_description?: string | null
          short_name?: string | null
          sku?: string
          sku_generated_at?: string | null
          sku_locked?: boolean
          sku_version?: number
          source_collection?: string | null
          source_document?: string | null
          source_notes?: string | null
          source_page?: number | null
          source_pdf_sku?: string | null
          storage_instructions?: string | null
          subcategory?: string | null
          subcategory_code?: string | null
          temperature_requirement?: string | null
          thawing_instruction?: string | null
          unit_conversion_note?: string | null
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
      sku_code_rules: {
        Row: {
          code: string
          code_type: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          code_type: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          code_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      sku_sequences: {
        Row: {
          category_code: string
          division_code: string
          id: string
          last_serial: number
          packaging_code: string
          subcategory_code: string
        }
        Insert: {
          category_code: string
          division_code: string
          id?: string
          last_serial?: number
          packaging_code: string
          subcategory_code: string
        }
        Update: {
          category_code?: string
          division_code?: string
          id?: string
          last_serial?: number
          packaging_code?: string
          subcategory_code?: string
        }
        Relationships: []
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
      bootstrap_current_user: {
        Args: never
        Returns: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "user_roles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      generate_oasis_sku: {
        Args: {
          _category_code: string
          _division_code: string
          _packaging_code: string
          _subcategory_code: string
        }
        Returns: string
      }
      get_current_user_roles: { Args: never; Returns: string[] }
      get_public_catalogue_channel_data: {
        Args: { _slug: string }
        Returns: {
          catalogue_id: string
          currency: string
          discount_percent: number
          moq_display_text: string
          mrp: number
          price_display_text: string
          price_label: string
          product_id: string
          public_price: number
          sku: string
          target_customer_channel: string
          uom: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_team_member: { Args: { _user_id: string }; Returns: boolean }
      normalize_alias: { Args: { _text: string }; Returns: string }
      search_products_with_aliases: {
        Args: { _q: string }
        Returns: {
          category: string
          hero_image_url: string
          id: string
          match_score: number
          matched_alias: string
          product_name: string
          short_name: string
          sku: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
