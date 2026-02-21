/**
 * Supabase Database Types
 * Auto-generated from schema — do not edit manually.
 * Regenerate with: npx supabase gen types typescript --project-id <id> > src/types/database.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          stripe_customer_id: string | null;
          organization_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          stripe_customer_id?: string | null;
          organization_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          stripe_customer_id?: string | null;
          organization_id?: string | null;
          updated_at?: string;
        };
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          plan: "free" | "starter" | "pro" | "enterprise";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          plan?: "free" | "starter" | "pro" | "enterprise";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          logo_url?: string | null;
          plan?: "free" | "starter" | "pro" | "enterprise";
          updated_at?: string;
        };
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: "admin" | "member" | "viewer";
          invited_by: string | null;
          joined_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: "admin" | "member" | "viewer";
          invited_by?: string | null;
          joined_at?: string;
        };
        Update: {
          role?: "admin" | "member" | "viewer";
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          status: "active" | "canceled" | "past_due" | "trialing" | "incomplete";
          plan_id: string;
          stripe_customer_id: string;
          current_period_start: string;
          current_period_end: string;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          status: "active" | "canceled" | "past_due" | "trialing" | "incomplete";
          plan_id: string;
          stripe_customer_id: string;
          current_period_start: string;
          current_period_end: string;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "active" | "canceled" | "past_due" | "trialing" | "incomplete";
          plan_id?: string;
          current_period_start?: string;
          current_period_end?: string;
          cancel_at_period_end?: boolean;
          updated_at?: string;
        };
      };
      usage_records: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          feature: string;
          quantity: number;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id: string;
          feature: string;
          quantity: number;
          recorded_at?: string;
        };
        Update: {
          quantity?: number;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_organization_usage: {
        Args: { org_id: string; start_date: string; end_date: string };
        Returns: { feature: string; total_quantity: number }[];
      };
    };
    Enums: {
      user_role: "admin" | "member" | "viewer";
      subscription_status: "active" | "canceled" | "past_due" | "trialing" | "incomplete";
      plan_tier: "free" | "starter" | "pro" | "enterprise";
    };
  };
}

// Helper types
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Insertable<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type Updatable<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// Convenience types
export type Profile = Tables<"profiles">;
export type Organization = Tables<"organizations">;
export type OrganizationMember = Tables<"organization_members">;
export type Subscription = Tables<"subscriptions">;
export type UsageRecord = Tables<"usage_records">;
