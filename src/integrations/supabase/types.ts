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
      ad_preferences: {
        Row: {
          created_at: string
          interests: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          interests?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          interests?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          slang_tag_ids: string[]
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          slang_tag_ids?: string[]
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          slang_tag_ids?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_influence: {
        Row: {
          calculated_at: string
          comment_count: number
          created_at: string
          last_interaction_at: string | null
          like_count: number
          message_count: number
          peer_id: string
          shared_interests: number
          shared_slang_tags: number
          strength: number
          updated_at: string
          user_id: string
        }
        Insert: {
          calculated_at?: string
          comment_count?: number
          created_at?: string
          last_interaction_at?: string | null
          like_count?: number
          message_count?: number
          peer_id: string
          shared_interests?: number
          shared_slang_tags?: number
          strength?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          calculated_at?: string
          comment_count?: number
          created_at?: string
          last_interaction_at?: string | null
          like_count?: number
          message_count?: number
          peer_id?: string
          shared_interests?: number
          shared_slang_tags?: number
          strength?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      connections: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["connection_status"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
        }
        Relationships: []
      }
      content_categories: {
        Row: {
          category_id: string
          content_id: string
          content_type: Database["public"]["Enums"]["interest_content_type"]
          created_at: string
          id: string
          owner_id: string | null
          source: string
          weight: number
        }
        Insert: {
          category_id: string
          content_id: string
          content_type: Database["public"]["Enums"]["interest_content_type"]
          created_at?: string
          id?: string
          owner_id?: string | null
          source?: string
          weight?: number
        }
        Update: {
          category_id?: string
          content_id?: string
          content_type?: Database["public"]["Enums"]["interest_content_type"]
          created_at?: string
          id?: string
          owner_id?: string | null
          source?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "interest_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          created_at: string
          last_read_at: string
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          last_read_at?: string
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          last_read_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          kind: string
          last_message_at: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          kind?: string
          last_message_at?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          last_message_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      interaction_events: {
        Row: {
          action: string
          category_id: string | null
          content_id: string | null
          content_type:
            | Database["public"]["Enums"]["interest_content_type"]
            | null
          created_at: string
          dwell_ms: number
          id: string
          peer_id: string | null
          user_id: string
          weight: number
        }
        Insert: {
          action: string
          category_id?: string | null
          content_id?: string | null
          content_type?:
            | Database["public"]["Enums"]["interest_content_type"]
            | null
          created_at?: string
          dwell_ms?: number
          id?: string
          peer_id?: string | null
          user_id: string
          weight?: number
        }
        Update: {
          action?: string
          category_id?: string | null
          content_id?: string | null
          content_type?:
            | Database["public"]["Enums"]["interest_content_type"]
            | null
          created_at?: string
          dwell_ms?: number
          id?: string
          peer_id?: string | null
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "interaction_events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "interest_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      interest_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["interest_category_kind"]
          name: string
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["interest_category_kind"]
          name: string
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["interest_category_kind"]
          name?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interest_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "interest_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      interest_confidence: {
        Row: {
          category_id: string
          confidence: number
          created_at: string
          distinct_days: number
          engage_count: number
          first_event_at: string | null
          last_event_at: string | null
          promoted: boolean
          promoted_at: string | null
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          category_id: string
          confidence?: number
          created_at?: string
          distinct_days?: number
          engage_count?: number
          first_event_at?: string | null
          last_event_at?: string | null
          promoted?: boolean
          promoted_at?: string | null
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          category_id?: string
          confidence?: number
          created_at?: string
          distinct_days?: number
          engage_count?: number
          first_event_at?: string | null
          last_event_at?: string | null
          promoted?: boolean
          promoted_at?: string | null
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "interest_confidence_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "interest_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      interest_engine_config: {
        Row: {
          created_at: string
          description: string
          key: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          description?: string
          key: string
          updated_at?: string
          value: number
        }
        Update: {
          created_at?: string
          description?: string
          key?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          delivered_at: string | null
          id: string
          kind: string
          media_url: string | null
          read_at: string | null
          sender_id: string
          slang_tag_id: string | null
          slang_tag_ids: string[]
        }
        Insert: {
          body?: string
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          kind?: string
          media_url?: string | null
          read_at?: string | null
          sender_id: string
          slang_tag_id?: string | null
          slang_tag_ids?: string[]
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          kind?: string
          media_url?: string | null
          read_at?: string | null
          sender_id?: string
          slang_tag_id?: string | null
          slang_tag_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          confirm_token: string | null
          confirmed_at: string | null
          consent_at: string | null
          created_at: string
          email: string
          id: string
          language: string | null
          last_sent_at: string | null
          status: string
          token_expires_at: string | null
        }
        Insert: {
          confirm_token?: string | null
          confirmed_at?: string | null
          consent_at?: string | null
          created_at?: string
          email: string
          id?: string
          language?: string | null
          last_sent_at?: string | null
          status?: string
          token_expires_at?: string | null
        }
        Update: {
          confirm_token?: string | null
          confirmed_at?: string | null
          consent_at?: string | null
          created_at?: string
          email?: string
          id?: string
          language?: string | null
          last_sent_at?: string | null
          status?: string
          token_expires_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string
          created_at: string
          entity_id: string | null
          id: string
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string
          created_at?: string
          entity_id?: string | null
          id?: string
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string
          created_at?: string
          entity_id?: string | null
          id?: string
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_saves: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_shares: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_views: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          audio_url: string | null
          comments_count: number
          created_at: string
          description: string
          duration: string
          hashtags: string[]
          id: string
          image_url: string | null
          likes_count: number
          placements: Json
          region: string
          saves_count: number
          shares_count: number
          slang_tag_ids: string[]
          title: string
          updated_at: string
          user_id: string
          views_count: number
          visibility: Database["public"]["Enums"]["post_visibility"]
        }
        Insert: {
          audio_url?: string | null
          comments_count?: number
          created_at?: string
          description?: string
          duration?: string
          hashtags?: string[]
          id?: string
          image_url?: string | null
          likes_count?: number
          placements?: Json
          region?: string
          saves_count?: number
          shares_count?: number
          slang_tag_ids?: string[]
          title?: string
          updated_at?: string
          user_id: string
          views_count?: number
          visibility?: Database["public"]["Enums"]["post_visibility"]
        }
        Update: {
          audio_url?: string | null
          comments_count?: number
          created_at?: string
          description?: string
          duration?: string
          hashtags?: string[]
          id?: string
          image_url?: string | null
          likes_count?: number
          placements?: Json
          region?: string
          saves_count?: number
          shares_count?: number
          slang_tag_ids?: string[]
          title?: string
          updated_at?: string
          user_id?: string
          views_count?: number
          visibility?: Database["public"]["Enums"]["post_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
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
          bio: string
          cover_url: string | null
          created_at: string
          display_name: string
          id: string
          language: string
          last_seen_at: string
          level: number
          location: string
          updated_at: string
          username: string
          verified: boolean
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          bio?: string
          cover_url?: string | null
          created_at?: string
          display_name?: string
          id: string
          language?: string
          last_seen_at?: string
          level?: number
          location?: string
          updated_at?: string
          username: string
          verified?: boolean
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          bio?: string
          cover_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          language?: string
          last_seen_at?: string
          level?: number
          location?: string
          updated_at?: string
          username?: string
          verified?: boolean
          xp?: number
        }
        Relationships: []
      }
      slang_tag_likes: {
        Row: {
          created_at: string
          tag_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          tag_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slang_tag_likes_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "slang_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slang_tag_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      slang_tag_plays: {
        Row: {
          created_at: string
          id: string
          tag_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tag_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slang_tag_plays_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "slang_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slang_tag_plays_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      slang_tag_saves: {
        Row: {
          created_at: string
          tag_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          tag_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slang_tag_saves_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "slang_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slang_tag_saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      slang_tag_shares: {
        Row: {
          created_at: string
          tag_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          tag_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slang_tag_shares_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "slang_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slang_tag_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      slang_tags: {
        Row: {
          audio_url: string | null
          comments_count: number
          created_at: string
          creator_id: string
          duration: string
          examples: string[]
          id: string
          language: string
          likes_count: number
          meaning: string
          name: string
          plays_count: number
          region: string
          saves_count: number
          shares_count: number
          updated_at: string
          uses_count: number
        }
        Insert: {
          audio_url?: string | null
          comments_count?: number
          created_at?: string
          creator_id: string
          duration?: string
          examples?: string[]
          id?: string
          language?: string
          likes_count?: number
          meaning?: string
          name: string
          plays_count?: number
          region?: string
          saves_count?: number
          shares_count?: number
          updated_at?: string
          uses_count?: number
        }
        Update: {
          audio_url?: string | null
          comments_count?: number
          created_at?: string
          creator_id?: string
          duration?: string
          examples?: string[]
          id?: string
          language?: string
          likes_count?: number
          meaning?: string
          name?: string
          plays_count?: number
          region?: string
          saves_count?: number
          shares_count?: number
          updated_at?: string
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "slang_tags_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      test_accounts: {
        Row: {
          created_at: string
          email: string
          id: string
          initial_password: string
          language: string
          region: string
          registered_at: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          initial_password: string
          language?: string
          region?: string
          registered_at?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          initial_password?: string
          language?: string
          region?: string
          registered_at?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      travel_plans: {
        Row: {
          city: string
          country: string
          created_at: string
          end_date: string | null
          id: string
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string
          country?: string
          created_at?: string
          end_date?: string | null
          id?: string
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          end_date?: string | null
          id?: string
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_interest_scores: {
        Row: {
          category_id: string
          created_at: string
          dynamic_score: number
          events_count: number
          last_decay_at: string
          last_event_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          dynamic_score?: number
          events_count?: number
          last_decay_at?: string
          last_event_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          dynamic_score?: number
          events_count?: number
          last_decay_at?: string
          last_event_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_interest_scores_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "interest_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_interests: {
        Row: {
          base_score: number
          category_id: string
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_score?: number
          category_id: string
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_score?: number
          category_id?: string
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_interests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "interest_categories"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      are_connected: { Args: { _a: string; _b: string }; Returns: boolean }
      can_notify: { Args: { _target: string }; Returns: boolean }
      can_read_media: { Args: { _object_name: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      connection_status: "pending" | "accepted" | "declined"
      interest_category_kind:
        | "topic"
        | "region"
        | "language"
        | "style"
        | "other"
      interest_content_type: "post" | "slang_tag" | "profile" | "ad"
      post_visibility: "public" | "connections" | "private"
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
      connection_status: ["pending", "accepted", "declined"],
      interest_category_kind: ["topic", "region", "language", "style", "other"],
      interest_content_type: ["post", "slang_tag", "profile", "ad"],
      post_visibility: ["public", "connections", "private"],
    },
  },
} as const
