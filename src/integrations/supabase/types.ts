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
      courriers_colis: {
        Row: {
          categorie: Database["public"]["Enums"]["categorie_depot"]
          cree_par: string | null
          created_at: string
          description: string
          destinataire: string
          expediteur: string
          id: string
          recu_at: string
          site_id: string | null
        }
        Insert: {
          categorie: Database["public"]["Enums"]["categorie_depot"]
          cree_par?: string | null
          created_at?: string
          description?: string
          destinataire: string
          expediteur?: string
          id?: string
          recu_at?: string
          site_id?: string | null
        }
        Update: {
          categorie?: Database["public"]["Enums"]["categorie_depot"]
          cree_par?: string | null
          created_at?: string
          description?: string
          destinataire?: string
          expediteur?: string
          id?: string
          recu_at?: string
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courriers_colis_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      objets_trouves: {
        Row: {
          cree_par: string | null
          created_at: string
          emplacement: string
          id: string
          objet: string
          observation: string
          site_id: string | null
          trouve_at: string
        }
        Insert: {
          cree_par?: string | null
          created_at?: string
          emplacement?: string
          id?: string
          objet: string
          observation?: string
          site_id?: string | null
          trouve_at?: string
        }
        Update: {
          cree_par?: string | null
          created_at?: string
          emplacement?: string
          id?: string
          objet?: string
          observation?: string
          site_id?: string | null
          trouve_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "objets_trouves_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      profils: {
        Row: {
          created_at: string
          email: string
          site_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          site_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          site_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profils_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      reglages: {
        Row: {
          email_accueil: string | null
          id: number
          updated_at: string
        }
        Insert: {
          email_accueil?: string | null
          id?: number
          updated_at?: string
        }
        Update: {
          email_accueil?: string | null
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      sites: {
        Row: {
          adresse: string
          code_postal: string
          created_at: string
          email_accueil: string | null
          id: string
          logo_url: string | null
          nom: string
          pays: string
          updated_at: string
          ville: string
        }
        Insert: {
          adresse?: string
          code_postal?: string
          created_at?: string
          email_accueil?: string | null
          id?: string
          logo_url?: string | null
          nom: string
          pays?: string
          updated_at?: string
          ville?: string
        }
        Update: {
          adresse?: string
          code_postal?: string
          created_at?: string
          email_accueil?: string | null
          id?: string
          logo_url?: string | null
          nom?: string
          pays?: string
          updated_at?: string
          ville?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visites: {
        Row: {
          arrivee_at: string
          cree_par: string | null
          created_at: string
          entreprise: string
          entreprise_visitee: string
          id: string
          nom: string
          personne_visitee: string
          prenom: string
          saisie_manuelle: boolean
          site_id: string | null
        }
        Insert: {
          arrivee_at?: string
          cree_par?: string | null
          created_at?: string
          entreprise: string
          entreprise_visitee: string
          id?: string
          nom: string
          personne_visitee: string
          prenom: string
          saisie_manuelle?: boolean
          site_id?: string | null
        }
        Update: {
          arrivee_at?: string
          cree_par?: string | null
          created_at?: string
          entreprise?: string
          entreprise_visitee?: string
          id?: string
          nom?: string
          personne_visitee?: string
          prenom?: string
          saisie_manuelle?: boolean
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visites_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
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
      site_utilisateur: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role: "super_admin" | "hotesse"
      categorie_depot: "courrier" | "colis" | "cles" | "autre"
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
      app_role: ["super_admin", "hotesse"],
      categorie_depot: ["courrier", "colis", "cles", "autre"],
    },
  },
} as const
