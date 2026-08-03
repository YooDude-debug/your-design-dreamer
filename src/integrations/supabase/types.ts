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
      ad_campaigns: {
        Row: {
          budget_cents: number
          clicks: number
          created_at: string
          ends_at: string | null
          id: string
          impressions: number
          kind: Database["public"]["Enums"]["ad_campaign_kind"]
          name: string
          owner_id: string | null
          region: string
          revenue_cents: number
          slang_tag_id: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["ad_campaign_status"]
          updated_at: string
        }
        Insert: {
          budget_cents?: number
          clicks?: number
          created_at?: string
          ends_at?: string | null
          id?: string
          impressions?: number
          kind?: Database["public"]["Enums"]["ad_campaign_kind"]
          name: string
          owner_id?: string | null
          region?: string
          revenue_cents?: number
          slang_tag_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["ad_campaign_status"]
          updated_at?: string
        }
        Update: {
          budget_cents?: number
          clicks?: number
          created_at?: string
          ends_at?: string | null
          id?: string
          impressions?: number
          kind?: Database["public"]["Enums"]["ad_campaign_kind"]
          name?: string
          owner_id?: string | null
          region?: string
          revenue_cents?: number
          slang_tag_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["ad_campaign_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_slang_tag_id_fkey"
            columns: ["slang_tag_id"]
            isOneToOne: false
            referencedRelation: "slang_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_pauses: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          local_date: string
          month_key: string
          timezone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          local_date: string
          month_key: string
          timezone?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          local_date?: string
          month_key?: string
          timezone?: string
          user_id?: string
        }
        Relationships: []
      }
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
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          admin_username: string
          created_at: string
          details: Json
          id: string
          target_id: string | null
          target_label: string
          target_type: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          admin_username?: string
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_label?: string
          target_type?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          admin_username?: string
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_label?: string
          target_type?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      arena_awards: {
        Row: {
          challenge_id: string
          created_at: string
          id: string
          licensed: boolean
          note: string
          place: number
          submission_id: string
          updated_at: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          id?: string
          licensed?: boolean
          note?: string
          place?: number
          submission_id: string
          updated_at?: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          id?: string
          licensed?: boolean
          note?: string
          place?: number
          submission_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_awards_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "arena_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_awards_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "arena_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_challenges: {
        Row: {
          category: string
          company_id: string
          company_name: string
          created_at: string
          description: string
          ends_at: string | null
          id: string
          logo_url: string | null
          prize: string
          region: string
          starts_at: string
          status: Database["public"]["Enums"]["arena_challenge_status"]
          target_audience: string
          terms: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          company_id: string
          company_name?: string
          created_at?: string
          description?: string
          ends_at?: string | null
          id?: string
          logo_url?: string | null
          prize?: string
          region?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["arena_challenge_status"]
          target_audience?: string
          terms?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          company_name?: string
          created_at?: string
          description?: string
          ends_at?: string | null
          id?: string
          logo_url?: string | null
          prize?: string
          region?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["arena_challenge_status"]
          target_audience?: string
          terms?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      arena_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          slang_tag_ids: string[]
          submission_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          slang_tag_ids?: string[]
          submission_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          slang_tag_ids?: string[]
          submission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_comments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "arena_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_likes: {
        Row: {
          created_at: string
          submission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          submission_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          submission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_likes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "arena_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_plays: {
        Row: {
          created_at: string
          id: string
          submission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          submission_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          submission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_plays_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "arena_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_submissions: {
        Row: {
          challenge_id: string
          comments_count: number
          created_at: string
          creator_id: string
          id: string
          likes_count: number
          pitch: string
          plays_count: number
          tag_id: string
          updated_at: string
          votes_count: number
        }
        Insert: {
          challenge_id: string
          comments_count?: number
          created_at?: string
          creator_id: string
          id?: string
          likes_count?: number
          pitch?: string
          plays_count?: number
          tag_id: string
          updated_at?: string
          votes_count?: number
        }
        Update: {
          challenge_id?: string
          comments_count?: number
          created_at?: string
          creator_id?: string
          id?: string
          likes_count?: number
          pitch?: string
          plays_count?: number
          tag_id?: string
          updated_at?: string
          votes_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "arena_submissions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "arena_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_submissions_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "slang_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_votes: {
        Row: {
          created_at: string
          submission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          submission_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          submission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_votes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "arena_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_slang_tags: {
        Row: {
          audio_url: string | null
          conversation_id: string
          created_at: string
          creator_id: string
          duration: string
          id: string
          name: string
        }
        Insert: {
          audio_url?: string | null
          conversation_id: string
          created_at?: string
          creator_id: string
          duration?: string
          id?: string
          name?: string
        }
        Update: {
          audio_url?: string | null
          conversation_id?: string
          created_at?: string
          creator_id?: string
          duration?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_slang_tags_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
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
          owner_id: string
          source: string
          weight: number
        }
        Insert: {
          category_id: string
          content_id: string
          content_type: Database["public"]["Enums"]["interest_content_type"]
          created_at?: string
          id?: string
          owner_id?: string
          source?: string
          weight?: number
        }
        Update: {
          category_id?: string
          content_id?: string
          content_type?: Database["public"]["Enums"]["interest_content_type"]
          created_at?: string
          id?: string
          owner_id?: string
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
      content_moderation_log: {
        Row: {
          ai: Json
          confidence: number
          content_id: string | null
          content_type: string
          created_at: string
          crisis: boolean
          decision: string
          flags: string[]
          id: string
          labels: string[]
          reason: string
          user_id: string | null
        }
        Insert: {
          ai?: Json
          confidence?: number
          content_id?: string | null
          content_type: string
          created_at?: string
          crisis?: boolean
          decision: string
          flags?: string[]
          id?: string
          labels?: string[]
          reason?: string
          user_id?: string | null
        }
        Update: {
          ai?: Json
          confidence?: number
          content_id?: string | null
          content_type?: string
          created_at?: string
          crisis?: boolean
          decision?: string
          flags?: string[]
          id?: string
          labels?: string[]
          reason?: string
          user_id?: string | null
        }
        Relationships: []
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
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          chat_slang_tag_id: string | null
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
          chat_slang_tag_id?: string | null
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
          chat_slang_tag_id?: string | null
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
            foreignKeyName: "messages_chat_slang_tag_id_fkey"
            columns: ["chat_slang_tag_id"]
            isOneToOne: false
            referencedRelation: "chat_slang_tags"
            referencedColumns: ["id"]
          },
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
          hidden_at: string | null
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
          hidden_at?: string | null
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
          hidden_at?: string | null
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
          is_test_bot: boolean
          language: string
          last_seen_at: string
          level: number
          location: string
          location_visibility: Database["public"]["Enums"]["location_visibility"]
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
          is_test_bot?: boolean
          language?: string
          last_seen_at?: string
          level?: number
          location?: string
          location_visibility?: Database["public"]["Enums"]["location_visibility"]
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
          is_test_bot?: boolean
          language?: string
          last_seen_at?: string
          level?: number
          location?: string
          location_visibility?: Database["public"]["Enums"]["location_visibility"]
          updated_at?: string
          username?: string
          verified?: boolean
          xp?: number
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string
          id: string
          reason: string
          reporter_id: string
          review_note: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string
          id?: string
          reason?: string
          reporter_id: string
          review_note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string
          id?: string
          reason?: string
          reporter_id?: string
          review_note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target_type"]
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      slang_tag_grants: {
        Row: {
          created_at: string
          granted_by: string
          grantee_id: string
          id: string
          owner_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          granted_by: string
          grantee_id: string
          id?: string
          owner_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string
          grantee_id?: string
          id?: string
          owner_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slang_tag_grants_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "slang_tags"
            referencedColumns: ["id"]
          },
        ]
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
      slang_tag_moderation_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          actor_username: string
          created_at: string
          details: Json
          from_status: Database["public"]["Enums"]["moderation_status"] | null
          id: string
          reason: string
          tag_id: string
          to_status: Database["public"]["Enums"]["moderation_status"] | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string
          actor_username?: string
          created_at?: string
          details?: Json
          from_status?: Database["public"]["Enums"]["moderation_status"] | null
          id?: string
          reason?: string
          tag_id: string
          to_status?: Database["public"]["Enums"]["moderation_status"] | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          actor_username?: string
          created_at?: string
          details?: Json
          from_status?: Database["public"]["Enums"]["moderation_status"] | null
          id?: string
          reason?: string
          tag_id?: string
          to_status?: Database["public"]["Enums"]["moderation_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "slang_tag_moderation_events_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "slang_tags"
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
      slang_tag_share_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          id: string
          owner_id: string
          requester_id: string
          status: Database["public"]["Enums"]["share_request_status"]
          tag_id: string
          target_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          id?: string
          owner_id: string
          requester_id: string
          status?: Database["public"]["Enums"]["share_request_status"]
          tag_id: string
          target_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          id?: string
          owner_id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["share_request_status"]
          tag_id?: string
          target_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slang_tag_share_requests_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "slang_tags"
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
      slang_tag_votes: {
        Row: {
          created_at: string
          tag_id: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          tag_id: string
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          tag_id?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "slang_tag_votes_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "slang_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      slang_tags: {
        Row: {
          audio_url: string | null
          clicks_count: number
          comments_count: number
          company: string
          company_url: string
          conversion_count: number
          created_at: string
          creator_id: string
          cta_type: string | null
          cta_url: string | null
          deleted_at: string | null
          description: string
          discount_code: string
          drop_expires: string | null
          drop_limit: number | null
          drop_rarity: string | null
          drop_release_date: string | null
          duration: string
          examples: string[]
          follow_required: boolean
          id: string
          kind: Database["public"]["Enums"]["slang_tag_kind"]
          language: string
          likes_count: number
          location: string
          logo_url: string | null
          meaning: string
          moderated_at: string | null
          moderated_by: string | null
          moderation_ai: Json
          moderation_confidence: number
          moderation_is_music: boolean
          moderation_labels: string[]
          moderation_reason: string
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          name: string
          opening_hours: string
          owner_id: string
          owner_type: Database["public"]["Enums"]["slang_tag_owner_type"]
          phone: string
          plays_count: number
          reach_count: number
          region: string
          released_at: string
          saves_count: number
          shares_count: number
          sponsored: boolean
          transcript: string
          unlock_type: Database["public"]["Enums"]["slang_tag_unlock_type"]
          updated_at: string
          uses_count: number
          verification_status: Database["public"]["Enums"]["verification_status"]
          voucher: string
        }
        Insert: {
          audio_url?: string | null
          clicks_count?: number
          comments_count?: number
          company?: string
          company_url?: string
          conversion_count?: number
          created_at?: string
          creator_id: string
          cta_type?: string | null
          cta_url?: string | null
          deleted_at?: string | null
          description?: string
          discount_code?: string
          drop_expires?: string | null
          drop_limit?: number | null
          drop_rarity?: string | null
          drop_release_date?: string | null
          duration?: string
          examples?: string[]
          follow_required?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["slang_tag_kind"]
          language?: string
          likes_count?: number
          location?: string
          logo_url?: string | null
          meaning?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_ai?: Json
          moderation_confidence?: number
          moderation_is_music?: boolean
          moderation_labels?: string[]
          moderation_reason?: string
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          name: string
          opening_hours?: string
          owner_id?: string
          owner_type?: Database["public"]["Enums"]["slang_tag_owner_type"]
          phone?: string
          plays_count?: number
          reach_count?: number
          region?: string
          released_at?: string
          saves_count?: number
          shares_count?: number
          sponsored?: boolean
          transcript?: string
          unlock_type?: Database["public"]["Enums"]["slang_tag_unlock_type"]
          updated_at?: string
          uses_count?: number
          verification_status?: Database["public"]["Enums"]["verification_status"]
          voucher?: string
        }
        Update: {
          audio_url?: string | null
          clicks_count?: number
          comments_count?: number
          company?: string
          company_url?: string
          conversion_count?: number
          created_at?: string
          creator_id?: string
          cta_type?: string | null
          cta_url?: string | null
          deleted_at?: string | null
          description?: string
          discount_code?: string
          drop_expires?: string | null
          drop_limit?: number | null
          drop_rarity?: string | null
          drop_release_date?: string | null
          duration?: string
          examples?: string[]
          follow_required?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["slang_tag_kind"]
          language?: string
          likes_count?: number
          location?: string
          logo_url?: string | null
          meaning?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_ai?: Json
          moderation_confidence?: number
          moderation_is_music?: boolean
          moderation_labels?: string[]
          moderation_reason?: string
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          name?: string
          opening_hours?: string
          owner_id?: string
          owner_type?: Database["public"]["Enums"]["slang_tag_owner_type"]
          phone?: string
          plays_count?: number
          reach_count?: number
          region?: string
          released_at?: string
          saves_count?: number
          shares_count?: number
          sponsored?: boolean
          transcript?: string
          unlock_type?: Database["public"]["Enums"]["slang_tag_unlock_type"]
          updated_at?: string
          uses_count?: number
          verification_status?: Database["public"]["Enums"]["verification_status"]
          voucher?: string
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
          active: boolean
          bot_config: Json
          country: string
          created_at: string
          email: string
          id: string
          initial_password: string
          interests: string[]
          is_bot: boolean
          language: string
          last_activity_at: string | null
          region: string
          registered_at: string
          role: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          active?: boolean
          bot_config?: Json
          country?: string
          created_at?: string
          email: string
          id?: string
          initial_password: string
          interests?: string[]
          is_bot?: boolean
          language?: string
          last_activity_at?: string | null
          region?: string
          registered_at?: string
          role?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          active?: boolean
          bot_config?: Json
          country?: string
          created_at?: string
          email?: string
          id?: string
          initial_password?: string
          interests?: string[]
          is_bot?: boolean
          language?: string
          last_activity_at?: string | null
          region?: string
          registered_at?: string
          role?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      test_bot_settings: {
        Row: {
          bot_count: number
          created_at: string
          enabled: boolean
          id: boolean
          running: boolean
          updated_at: string
        }
        Insert: {
          bot_count?: number
          created_at?: string
          enabled?: boolean
          id?: boolean
          running?: boolean
          updated_at?: string
        }
        Update: {
          bot_count?: number
          created_at?: string
          enabled?: boolean
          id?: boolean
          running?: boolean
          updated_at?: string
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
      user_bans: {
        Row: {
          active: boolean
          admin_id: string
          created_at: string
          expires_at: string | null
          id: string
          reason: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          admin_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          reason?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          admin_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          reason?: string
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
      user_warnings: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          note: string
          reason: string
          user_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          note?: string
          reason?: string
          user_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          note?: string
          reason?: string
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
      can_read_content_category: {
        Args: {
          _content_id: string
          _content_type: Database["public"]["Enums"]["interest_content_type"]
          _owner_id: string
        }
        Returns: boolean
      }
      can_read_media: { Args: { _object_name: string }; Returns: boolean }
      can_use_extended_audio: { Args: { _user_id: string }; Returns: boolean }
      can_use_slang_tag: {
        Args: { _tag_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_post: { Args: { _post_id: string }; Returns: boolean }
      delete_slang_tag: { Args: { _tag_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_slang_tag_grant: {
        Args: { _tag_id: string; _user_id: string }
        Returns: boolean
      }
      is_community_tag: { Args: { _tag_id: string }; Returns: boolean }
      is_conversation_creator: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_following: {
        Args: { _follower: string; _following: string }
        Returns: boolean
      }
      owns_slang_tag: { Args: { _tag_id: string }; Returns: boolean }
      profile_locations: {
        Args: { _ids: string[] }
        Returns: {
          location: string
          location_visibility: Database["public"]["Enums"]["location_visibility"]
          user_id: string
        }[]
      }
      slang_tag_business_info: {
        Args: { _tag_ids: string[] }
        Returns: {
          company_url: string
          discount_code: string
          location: string
          opening_hours: string
          phone: string
          tag_id: string
          voucher: string
        }[]
      }
      slang_tag_vote_stats: {
        Args: { _tag_ids: string[] }
        Returns: {
          down_count: number
          tag_id: string
          up_count: number
        }[]
      }
      test_bots_visible: { Args: never; Returns: boolean }
      track_slang_tag_click: {
        Args: { _conversion?: boolean; _tag_id: string }
        Returns: undefined
      }
      track_slang_tag_reach: { Args: { _tag_id: string }; Returns: undefined }
    }
    Enums: {
      ad_campaign_kind: "campaign" | "company_slang_tag" | "creator_slang_tag"
      ad_campaign_status: "draft" | "active" | "paused" | "ended"
      app_role: "admin" | "user" | "creator" | "business"
      arena_challenge_status: "draft" | "active" | "judging" | "closed"
      connection_status: "pending" | "accepted" | "declined"
      interest_category_kind:
        | "topic"
        | "region"
        | "language"
        | "style"
        | "other"
      interest_content_type: "post" | "slang_tag" | "profile" | "ad"
      location_visibility: "public" | "connections" | "private"
      moderation_status: "pending" | "approved" | "review" | "blocked"
      post_visibility: "public" | "connections" | "private" | "following"
      report_status: "open" | "reviewing" | "resolved" | "dismissed"
      report_target_type:
        | "post"
        | "slang_tag"
        | "comment"
        | "profile"
        | "message"
      share_request_status: "pending" | "approved" | "declined"
      slang_tag_kind: "community" | "creator"
      slang_tag_owner_type: "user" | "creator" | "company"
      slang_tag_unlock_type:
        | "open"
        | "follow"
        | "challenge"
        | "event"
        | "premium"
      verification_status: "none" | "pending" | "verified" | "rejected"
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
      ad_campaign_kind: ["campaign", "company_slang_tag", "creator_slang_tag"],
      ad_campaign_status: ["draft", "active", "paused", "ended"],
      app_role: ["admin", "user", "creator", "business"],
      arena_challenge_status: ["draft", "active", "judging", "closed"],
      connection_status: ["pending", "accepted", "declined"],
      interest_category_kind: ["topic", "region", "language", "style", "other"],
      interest_content_type: ["post", "slang_tag", "profile", "ad"],
      location_visibility: ["public", "connections", "private"],
      moderation_status: ["pending", "approved", "review", "blocked"],
      post_visibility: ["public", "connections", "private", "following"],
      report_status: ["open", "reviewing", "resolved", "dismissed"],
      report_target_type: [
        "post",
        "slang_tag",
        "comment",
        "profile",
        "message",
      ],
      share_request_status: ["pending", "approved", "declined"],
      slang_tag_kind: ["community", "creator"],
      slang_tag_owner_type: ["user", "creator", "company"],
      slang_tag_unlock_type: [
        "open",
        "follow",
        "challenge",
        "event",
        "premium",
      ],
      verification_status: ["none", "pending", "verified", "rejected"],
    },
  },
} as const
