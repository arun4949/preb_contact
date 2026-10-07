// Generated from the Supabase project via MCP `generate_typescript_types`
// after migration 0001 (+ email_sends from 0003). Regenerate after every migration.
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      credit_grants: {
        Row: {
          amount: number
          expires_at: string
          granted_at: string
          id: string
          note: string | null
          remaining: number
          source: Database["public"]["Enums"]["grant_source"]
          stripe_invoice_id: string | null
          workspace_id: string
        }
        Insert: {
          amount: number
          expires_at: string
          granted_at?: string
          id?: string
          note?: string | null
          remaining: number
          source: Database["public"]["Enums"]["grant_source"]
          stripe_invoice_id?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          expires_at?: string
          granted_at?: string
          id?: string
          note?: string | null
          remaining?: number
          source?: Database["public"]["Enums"]["grant_source"]
          stripe_invoice_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_grants_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_holds: {
        Row: {
          amount: number
          created_at: string
          id: string
          list_id: string
          released_at: string | null
          workspace_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          list_id: string
          released_at?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          list_id?: string
          released_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_holds_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_holds_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          batch_id: string | null
          created_at: string
          delta: number
          grant_id: string | null
          id: number
          kind: Database["public"]["Enums"]["ledger_kind"]
          list_id: string | null
          note: string | null
          workspace_id: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          delta: number
          grant_id?: string | null
          id?: never
          kind: Database["public"]["Enums"]["ledger_kind"]
          list_id?: string | null
          note?: string | null
          workspace_id: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          delta?: number
          grant_id?: string | null
          id?: never
          kind?: Database["public"]["Enums"]["ledger_kind"]
          list_id?: string | null
          note?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "enrichment_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "credit_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sends: {
        Row: {
          email: string
          id: number
          kind: Database["public"]["Enums"]["email_kind"]
          provider_message_id: string | null
          sent_at: string
          workspace_id: string | null
        }
        Insert: {
          email: string
          id?: never
          kind: Database["public"]["Enums"]["email_kind"]
          provider_message_id?: string | null
          sent_at?: string
          workspace_id?: string | null
        }
        Update: {
          email?: string
          id?: never
          kind?: Database["public"]["Enums"]["email_kind"]
          provider_message_id?: string | null
          sent_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_batches: {
        Row: {
          attempts: number
          contact_count: number
          created_at: string
          credits_cost: number | null
          finished_at: string | null
          id: string
          kind: Database["public"]["Enums"]["list_mode"]
          last_polled_at: string | null
          list_id: string
          provider: string
          provider_enrichment_id: string | null
          raw: Json | null
          settled_at: string | null
          status: Database["public"]["Enums"]["batch_status"]
          submitted_at: string
          workspace_id: string
        }
        Insert: {
          attempts?: number
          contact_count?: number
          created_at?: string
          credits_cost?: number | null
          finished_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["list_mode"]
          last_polled_at?: string | null
          list_id: string
          provider?: string
          provider_enrichment_id?: string | null
          raw?: Json | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          submitted_at?: string
          workspace_id: string
        }
        Update: {
          attempts?: number
          contact_count?: number
          created_at?: string
          credits_cost?: number | null
          finished_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["list_mode"]
          last_polled_at?: string | null
          list_id?: string
          provider?: string
          provider_enrichment_id?: string | null
          raw?: Json | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          submitted_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_batches_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_batches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_cache: {
        Row: {
          fetched_at: string
          fields: string[]
          input_hash: string
          provider: string
          result: Json
          source_workspace_id: string | null
        }
        Insert: {
          fetched_at?: string
          fields?: string[]
          input_hash: string
          provider?: string
          result: Json
          source_workspace_id?: string | null
        }
        Update: {
          fetched_at?: string
          fields?: string[]
          input_hash?: string
          provider?: string
          result?: Json
          source_workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_cache_source_workspace_id_fkey"
            columns: ["source_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      list_contacts: {
        Row: {
          batch_id: string | null
          company: string | null
          company_domain: string | null
          company_logo_url: string | null
          company_name: string | null
          created_at: string
          credits_cost: number
          domain: string | null
          email_input: string | null
          enriched_at: string | null
          first_name: string | null
          full_name: string | null
          id: string
          input_hash: string | null
          job_title: string | null
          last_name: string | null
          linkedin_url: string | null
          list_id: string
          location: string | null
          personal_email: string | null
          personal_email_status: string | null
          phone: string | null
          phone_meta: Json | null
          profile: Json | null
          raw: Json
          result: Json | null
          row_index: number
          skip_reason: string | null
          status: Database["public"]["Enums"]["contact_status"]
          work_email: string | null
          work_email_status: string | null
          workspace_id: string
        }
        Insert: {
          batch_id?: string | null
          company?: string | null
          company_domain?: string | null
          company_logo_url?: string | null
          company_name?: string | null
          created_at?: string
          credits_cost?: number
          domain?: string | null
          email_input?: string | null
          enriched_at?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          input_hash?: string | null
          job_title?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          list_id: string
          location?: string | null
          personal_email?: string | null
          personal_email_status?: string | null
          phone?: string | null
          phone_meta?: Json | null
          profile?: Json | null
          raw?: Json
          result?: Json | null
          row_index: number
          skip_reason?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          work_email?: string | null
          work_email_status?: string | null
          workspace_id: string
        }
        Update: {
          batch_id?: string | null
          company?: string | null
          company_domain?: string | null
          company_logo_url?: string | null
          company_name?: string | null
          created_at?: string
          credits_cost?: number
          domain?: string | null
          email_input?: string | null
          enriched_at?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          input_hash?: string | null
          job_title?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          list_id?: string
          location?: string | null
          personal_email?: string | null
          personal_email_status?: string | null
          phone?: string | null
          phone_meta?: Json | null
          profile?: Json | null
          raw?: Json
          result?: Json | null
          row_index?: number
          skip_reason?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          work_email?: string | null
          work_email_status?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_contacts_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "enrichment_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_contacts_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          cached_rows: number
          column_mapping: Json
          completed_at: string | null
          created_at: string
          created_by: string
          credits_estimated: number
          credits_max: number
          credits_used: number
          duplicates_removed: number
          enrich_fields: string[]
          enrichable_rows: number
          error: string | null
          file_name: string | null
          file_path: string | null
          file_type: string | null
          found_personal_email: number
          found_phone: number
          found_work_email: number
          has_header: boolean
          id: string
          mode: Database["public"]["Enums"]["list_mode"]
          name: string
          not_found: number
          processed_rows: number
          risky_email: number
          row_limit: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["list_status"]
          submitted_rows: number
          total_rows: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          cached_rows?: number
          column_mapping?: Json
          completed_at?: string | null
          created_at?: string
          created_by: string
          credits_estimated?: number
          credits_max?: number
          credits_used?: number
          duplicates_removed?: number
          enrich_fields?: string[]
          enrichable_rows?: number
          error?: string | null
          file_name?: string | null
          file_path?: string | null
          file_type?: string | null
          found_personal_email?: number
          found_phone?: number
          found_work_email?: number
          has_header?: boolean
          id?: string
          mode?: Database["public"]["Enums"]["list_mode"]
          name?: string
          not_found?: number
          processed_rows?: number
          risky_email?: number
          row_limit?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["list_status"]
          submitted_rows?: number
          total_rows?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          cached_rows?: number
          column_mapping?: Json
          completed_at?: string | null
          created_at?: string
          created_by?: string
          credits_estimated?: number
          credits_max?: number
          credits_used?: number
          duplicates_removed?: number
          enrich_fields?: string[]
          enrichable_rows?: number
          error?: string | null
          file_name?: string | null
          file_path?: string | null
          file_type?: string | null
          found_personal_email?: number
          found_phone?: number
          found_work_email?: number
          has_header?: boolean
          id?: string
          mode?: Database["public"]["Enums"]["list_mode"]
          name?: string
          not_found?: number
          processed_rows?: number
          risky_email?: number
          row_limit?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["list_status"]
          submitted_rows?: number
          total_rows?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lists_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_workspace_id: string | null
          email: string
          full_name: string | null
          id: string
          onboarded_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_workspace_id?: string | null
          email: string
          full_name?: string | null
          id: string
          onboarded_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_workspace_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          onboarded_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_workspace_id_fkey"
            columns: ["default_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_rate_limit: {
        Row: {
          get_count: number
          provider: string
          submit_count: number
          window_start: string
        }
        Insert: {
          get_count?: number
          provider: string
          submit_count?: number
          window_start?: string
        }
        Update: {
          get_count?: number
          provider?: string
          submit_count?: number
          window_start?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          error: string | null
          external_id: string
          id: number
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
        }
        Insert: {
          error?: string | null
          external_id: string
          id?: never
          payload: Json
          processed_at?: string | null
          provider: string
          received_at?: string
        }
        Update: {
          error?: string | null
          external_id?: string
          id?: never
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
        }
        Relationships: []
      }
      workspace_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["workspace_role"]
          token_hash: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["workspace_role"]
          token_hash: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          token_hash?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          name: string
          owner_id: string
          plan_key: string | null
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_granted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          name: string
          owner_id: string
          plan_key?: string | null
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_granted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          name?: string
          owner_id?: string
          plan_key?: string | null
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_granted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_credits: {
        Args: {
          amount: number
          p_batch_id: string
          p_list_id: string
          ws: string
        }
        Returns: number
      }
      credits_available: { Args: { ws: string }; Returns: number }
      expire_grants: { Args: never; Returns: number }
      grant_credits: {
        Args: {
          amount: number
          p_expires_at: string
          p_note?: string
          p_source: Database["public"]["Enums"]["grant_source"]
          p_stripe_invoice_id?: string
          ws: string
        }
        Returns: string
      }
      is_workspace_admin: { Args: { ws: string }; Returns: boolean }
      is_workspace_member: { Args: { ws: string }; Returns: boolean }
      recompute_list_counters: {
        Args: { p_list_id: string }
        Returns: undefined
      }
    }
    Enums: {
      batch_status:
        | "submitted"
        | "finished"
        | "credits_insufficient"
        | "canceled"
        | "failed"
      contact_status:
        | "pending"
        | "cached"
        | "submitted"
        | "enriched"
        | "not_found"
        | "skipped"
        | "failed"
      email_kind:
        | "magic_link"
        | "welcome"
        | "invite"
        | "list_finished"
        | "list_paused"
        | "credits_low"
        | "ops_alert"
      grant_source: "trial" | "subscription" | "manual"
      ledger_kind: "grant" | "consume" | "expire" | "adjust"
      list_mode: "enrich" | "reverse"
      list_status:
        | "draft"
        | "queued"
        | "enriching"
        | "paused_credits"
        | "paused_upstream"
        | "stopping"
        | "stopped"
        | "completed"
        | "failed"
      workspace_role: "owner" | "admin" | "member"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      batch_status: [
        "submitted",
        "finished",
        "credits_insufficient",
        "canceled",
        "failed",
      ],
      contact_status: [
        "pending",
        "cached",
        "submitted",
        "enriched",
        "not_found",
        "skipped",
        "failed",
      ],
      email_kind: [
        "magic_link",
        "welcome",
        "invite",
        "list_finished",
        "list_paused",
        "credits_low",
        "ops_alert",
      ],
      grant_source: ["trial", "subscription", "manual"],
      ledger_kind: ["grant", "consume", "expire", "adjust"],
      list_mode: ["enrich", "reverse"],
      list_status: [
        "draft",
        "queued",
        "enriching",
        "paused_credits",
        "paused_upstream",
        "stopping",
        "stopped",
        "completed",
        "failed",
      ],
      workspace_role: ["owner", "admin", "member"],
    },
  },
} as const
