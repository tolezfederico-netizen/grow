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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admins: {
        Row: {
          creado_en: string
          id: string
        }
        Insert: {
          creado_en?: string
          id: string
        }
        Update: {
          creado_en?: string
          id?: string
        }
        Relationships: []
      }
      categorias: {
        Row: {
          estado: string
          id: string
          nombre: string
        }
        Insert: {
          estado?: string
          id?: string
          nombre: string
        }
        Update: {
          estado?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          apellido: string
          creado_en: string
          email: string
          id: string
          nombre: string
          telefono: string | null
        }
        Insert: {
          apellido: string
          creado_en?: string
          email: string
          id: string
          nombre: string
          telefono?: string | null
        }
        Update: {
          apellido?: string
          creado_en?: string
          email?: string
          id?: string
          nombre?: string
          telefono?: string | null
        }
        Relationships: []
      }
      configuracion_tienda: {
        Row: {
          direccion: string
          email_contacto: string | null
          horario_apertura: string
          horario_cierre: string
          mensaje_alerta: string | null
          mensaje_alerta_expira_en: string | null
          nombre_tienda: string
          red_social_destacada: string | null
          redes_sociales: Json
          singleton: boolean
          telefono: string
        }
        Insert: {
          direccion: string
          email_contacto?: string | null
          horario_apertura: string
          horario_cierre: string
          mensaje_alerta?: string | null
          mensaje_alerta_expira_en?: string | null
          nombre_tienda: string
          red_social_destacada?: string | null
          redes_sociales?: Json
          singleton?: boolean
          telefono: string
        }
        Update: {
          direccion?: string
          email_contacto?: string | null
          horario_apertura?: string
          horario_cierre?: string
          mensaje_alerta?: string | null
          mensaje_alerta_expira_en?: string | null
          nombre_tienda?: string
          red_social_destacada?: string | null
          redes_sociales?: Json
          singleton?: boolean
          telefono?: string
        }
        Relationships: []
      }
      paneles_categoria: {
        Row: {
          creado_en: string
          descripcion: string | null
          estado: string
          id: string
          orden: number | null
          titulo: string
        }
        Insert: {
          creado_en?: string
          descripcion?: string | null
          estado?: string
          id?: string
          orden?: number | null
          titulo: string
        }
        Update: {
          creado_en?: string
          descripcion?: string | null
          estado?: string
          id?: string
          orden?: number | null
          titulo?: string
        }
        Relationships: []
      }
      paneles_categoria_items: {
        Row: {
          categoria_id: string
          es_card: boolean
          id: string
          nombre_visible: string | null
          orden: number
          panel_id: string
        }
        Insert: {
          categoria_id: string
          es_card?: boolean
          id?: string
          nombre_visible?: string | null
          orden?: number
          panel_id: string
        }
        Update: {
          categoria_id?: string
          es_card?: boolean
          id?: string
          nombre_visible?: string | null
          orden?: number
          panel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paneles_categoria_items_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paneles_categoria_items_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "paneles_categoria"
            referencedColumns: ["id"]
          },
        ]
      }
      paneles_categoria_items_productos: {
        Row: {
          id: string
          item_id: string
          orden: number
          producto_id: string
        }
        Insert: {
          id?: string
          item_id: string
          orden?: number
          producto_id: string
        }
        Update: {
          id?: string
          item_id?: string
          orden?: number
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paneles_categoria_items_productos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "paneles_categoria_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paneles_categoria_items_productos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_items: {
        Row: {
          cantidad: number
          id: string
          nombre_producto: string
          pedido_id: string
          precio_unitario: number
          producto_id: string | null
          variante_id: string | null
        }
        Insert: {
          cantidad: number
          id?: string
          nombre_producto: string
          pedido_id: string
          precio_unitario: number
          producto_id?: string | null
          variante_id?: string | null
        }
        Update: {
          cantidad?: number
          id?: string
          nombre_producto?: string
          pedido_id?: string
          precio_unitario?: number
          producto_id?: string | null
          variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_items_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_items_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "producto_variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          actualizado_en: string
          cliente_email: string
          cliente_nombre: string
          cliente_telefono: string
          creado_en: string
          eliminado: boolean
          estado: string
          id: string
          total: number
          usuario_id: string | null
        }
        Insert: {
          actualizado_en?: string
          cliente_email: string
          cliente_nombre: string
          cliente_telefono: string
          creado_en?: string
          eliminado?: boolean
          estado?: string
          id?: string
          total: number
          usuario_id?: string | null
        }
        Update: {
          actualizado_en?: string
          cliente_email?: string
          cliente_nombre?: string
          cliente_telefono?: string
          creado_en?: string
          eliminado?: boolean
          estado?: string
          id?: string
          total?: number
          usuario_id?: string | null
        }
        Relationships: []
      }
      producto_categorias: {
        Row: {
          categoria_id: string
          producto_id: string
        }
        Insert: {
          categoria_id: string
          producto_id: string
        }
        Update: {
          categoria_id?: string
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "producto_categorias_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_categorias_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      producto_variantes: {
        Row: {
          estado: string
          id: string
          nombre_variante: string
          precio: number
          producto_id: string
        }
        Insert: {
          estado?: string
          id?: string
          nombre_variante: string
          precio: number
          producto_id: string
        }
        Update: {
          estado?: string
          id?: string
          nombre_variante?: string
          precio?: number
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "producto_variantes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          creado_en: string
          descripcion: string | null
          destacado: boolean
          especificaciones: string | null
          estado: string
          id: string
          imagen_url: string | null
          nombre: string
          precio_base: number | null
          tiene_variantes: boolean
        }
        Insert: {
          creado_en?: string
          descripcion?: string | null
          destacado?: boolean
          especificaciones?: string | null
          estado?: string
          id?: string
          imagen_url?: string | null
          nombre: string
          precio_base?: number | null
          tiene_variantes?: boolean
        }
        Update: {
          creado_en?: string
          descripcion?: string | null
          destacado?: boolean
          especificaciones?: string | null
          estado?: string
          id?: string
          imagen_url?: string | null
          nombre?: string
          precio_base?: number | null
          tiene_variantes?: boolean
        }
        Relationships: []
      }
      sucursales: {
        Row: {
          creado_en: string
          direccion: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          creado_en?: string
          direccion: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          creado_en?: string
          direccion?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      crear_pedido_completo:
        | {
            Args: {
              p_cliente_email: string
              p_cliente_nombre: string
              p_cliente_telefono: string
              p_items: Json
            }
            Returns: Json
          }
        | {
            Args: {
              p_cliente_email: string
              p_cliente_nombre: string
              p_cliente_telefono: string
              p_items: Json
              p_usuario_id?: string
            }
            Returns: Json
          }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
