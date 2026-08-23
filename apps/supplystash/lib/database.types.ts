export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string;
          deleted: boolean;
          description: string | null;
          home_id: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted?: boolean;
          description?: string | null;
          home_id: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted?: boolean;
          description?: string | null;
          home_id?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_home_id_fkey";
            columns: ["home_id"];
            isOneToOne: false;
            referencedRelation: "homes";
            referencedColumns: ["id"];
          },
        ];
      };
      device_tokens: {
        Row: {
          created_at: string;
          id: string;
          platform: string;
          token: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          platform: string;
          token: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          platform?: string;
          token?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      homes: {
        Row: {
          created_at: string;
          created_by_id: string | null;
          description: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by_id?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by_id?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      inventory_transactions: {
        Row: {
          created_at: string;
          deleted: boolean;
          id: string;
          item_id: string;
          notes: string | null;
          quantity_changed: number;
          transaction_type: Database["public"]["Enums"]["inventory_transaction_type"];
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          deleted?: boolean;
          id?: string;
          item_id: string;
          notes?: string | null;
          quantity_changed: number;
          transaction_type: Database["public"]["Enums"]["inventory_transaction_type"];
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          deleted?: boolean;
          id?: string;
          item_id?: string;
          notes?: string | null;
          quantity_changed?: number;
          transaction_type?: Database["public"]["Enums"]["inventory_transaction_type"];
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      item_categories: {
        Row: {
          category_id: string;
          item_id: string;
        };
        Insert: {
          category_id: string;
          item_id: string;
        };
        Update: {
          category_id?: string;
          item_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "item_categories_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "item_categories_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      items: {
        Row: {
          barcode: string | null;
          created_at: string;
          created_by_id: string | null;
          current_inventory: number;
          deleted: boolean;
          description: string | null;
          home_id: string;
          id: string;
          is_archived: boolean;
          photo_url: string | null;
          purchase_link: string | null;
          title: string;
          updated_at: string;
          warning_amount: number;
        };
        Insert: {
          barcode?: string | null;
          created_at?: string;
          created_by_id?: string | null;
          current_inventory?: number;
          deleted?: boolean;
          description?: string | null;
          home_id: string;
          id?: string;
          is_archived?: boolean;
          photo_url?: string | null;
          purchase_link?: string | null;
          title: string;
          updated_at?: string;
          warning_amount?: number;
        };
        Update: {
          barcode?: string | null;
          created_at?: string;
          created_by_id?: string | null;
          current_inventory?: number;
          deleted?: boolean;
          description?: string | null;
          home_id?: string;
          id?: string;
          is_archived?: boolean;
          photo_url?: string | null;
          purchase_link?: string | null;
          title?: string;
          updated_at?: string;
          warning_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "items_home_id_fkey";
            columns: ["home_id"];
            isOneToOne: false;
            referencedRelation: "homes";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          home_id: string | null;
          id: string;
          is_read: boolean;
          item_id: string | null;
          message: string;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          home_id?: string | null;
          id?: string;
          is_read?: boolean;
          item_id?: string | null;
          message: string;
          type: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          home_id?: string | null;
          id?: string;
          is_read?: boolean;
          item_id?: string | null;
          message?: string;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_home_id_fkey";
            columns: ["home_id"];
            isOneToOne: false;
            referencedRelation: "homes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      shopping_list_items: {
        Row: {
          checked_at: string | null;
          checked_by_id: string | null;
          created_at: string;
          deleted: boolean;
          home_id: string;
          id: string;
          is_checked: boolean;
          item_id: string | null;
          quantity: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          checked_at?: string | null;
          checked_by_id?: string | null;
          created_at?: string;
          deleted?: boolean;
          home_id: string;
          id?: string;
          is_checked?: boolean;
          item_id?: string | null;
          quantity?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          checked_at?: string | null;
          checked_by_id?: string | null;
          created_at?: string;
          deleted?: boolean;
          home_id?: string;
          id?: string;
          is_checked?: boolean;
          item_id?: string | null;
          quantity?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shopping_list_items_home_id_fkey";
            columns: ["home_id"];
            isOneToOne: false;
            referencedRelation: "homes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shopping_list_items_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      user_homes: {
        Row: {
          home_id: string;
          joined_at: string;
          role: string;
          user_id: string;
        };
        Insert: {
          home_id: string;
          joined_at?: string;
          role?: string;
          user_id: string;
        };
        Update: {
          home_id?: string;
          joined_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_homes_home_id_fkey";
            columns: ["home_id"];
            isOneToOne: false;
            referencedRelation: "homes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_home: {
        Args: { p_description?: string; p_name: string };
        Returns: string;
      };
      delete_home: { Args: { p_home_id: string }; Returns: undefined };
      delete_own_account: { Args: never; Returns: undefined };
      get_home_role: { Args: { home_uuid: string }; Returns: string };
      invite_member: {
        Args: { p_home_id: string; p_invitee_user_id: string; p_role?: string };
        Returns: undefined;
      };
      is_home_admin_or_above: { Args: { home_uuid: string }; Returns: boolean };
      is_home_member: { Args: { home_uuid: string }; Returns: boolean };
      is_home_owner: { Args: { home_uuid: string }; Returns: boolean };
      leave_home: { Args: { p_home_id: string }; Returns: undefined };
      remove_member: {
        Args: { p_home_id: string; p_target_user_id: string };
        Returns: undefined;
      };
      transfer_ownership: {
        Args: { p_home_id: string; p_new_owner_user_id: string };
        Returns: undefined;
      };
      update_home: {
        Args: { p_description?: string; p_home_id: string; p_name?: string };
        Returns: undefined;
      };
      update_member_role: {
        Args: {
          p_home_id: string;
          p_new_role: string;
          p_target_user_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      inventory_transaction_type:
        | "manual_add"
        | "manual_remove"
        | "purchase"
        | "consume"
        | "correction"
        | "bulk_import";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      inventory_transaction_type: [
        "manual_add",
        "manual_remove",
        "purchase",
        "consume",
        "correction",
        "bulk_import",
      ],
    },
  },
} as const;
