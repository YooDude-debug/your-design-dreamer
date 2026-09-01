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
      account_security_events: {
        Row: {
          action: string
          created_at: string
          detail: string
          id: string
          outcome: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          detail?: string
          id?: string
          outcome?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          detail?: string
          id?: string
          outcome?: string
          user_id?: string
        }
        Relationships: []
      }
      ad_campaign_event_guard: {
        Row: {
          bucket: string
          campaign_id: string
          kind: string
          user_id: string
        }
        Insert: {
          bucket: string
          campaign_id: string
          kind: string
          user_id: string
        }
        Update: {
          bucket?: string
          campaign_id?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaign_event_guard_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_campaigns: {
        Row: {
          budget_cents: number
          caption: string
          clicks: number
          created_at: string
          cta: string | null
          ends_at: string | null
          environment: string
          hashtags: string[]
          id: string
          impressions: number
          kind: Database["public"]["Enums"]["ad_campaign_kind"]
          name: string
          owner_id: string | null
          region: string
          revenue_cents: number
          slang_tag_drop_id: string | null
          slang_tag_id: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["ad_campaign_status"]
          updated_at: string
        }
        Insert: {
          budget_cents?: number
          caption?: string
          clicks?: number
          created_at?: string
          cta?: string | null
          ends_at?: string | null
          environment?: string
          hashtags?: string[]
          id?: string
          impressions?: number
          kind?: Database["public"]["Enums"]["ad_campaign_kind"]
          name: string
          owner_id?: string | null
          region?: string
          revenue_cents?: number
          slang_tag_drop_id?: string | null
          slang_tag_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["ad_campaign_status"]
          updated_at?: string
        }
        Update: {
          budget_cents?: number
          caption?: string
          clicks?: number
          created_at?: string
          cta?: string | null
          ends_at?: string | null
          environment?: string
          hashtags?: string[]
          id?: string
          impressions?: number
          kind?: Database["public"]["Enums"]["ad_campaign_kind"]
          name?: string
          owner_id?: string | null
          region?: string
          revenue_cents?: number
          slang_tag_drop_id?: string | null
          slang_tag_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["ad_campaign_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_slang_tag_drop_id_fkey"
            columns: ["slang_tag_drop_id"]
            isOneToOne: false
            referencedRelation: "slang_tag_drops"
            referencedColumns: ["tag_id"]
          },
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
      ad_test_events: {
        Row: {
          ad_id: string
          created_at: string
          details: Json
          feed_position: number
          id: string
          interactions: number
          kind: string
          user_id: string
        }
        Insert: {
          ad_id?: string
          created_at?: string
          details?: Json
          feed_position?: number
          id?: string
          interactions?: number
          kind: string
          user_id: string
        }
        Update: {
          ad_id?: string
          created_at?: string
          details?: Json
          feed_position?: number
          id?: string
          interactions?: number
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      ad_test_settings: {
        Row: {
          ad_frequency: number
          created_at: string
          enabled: boolean
          id: boolean
          updated_at: string
        }
        Insert: {
          ad_frequency?: number
          created_at?: string
          enabled?: boolean
          id?: boolean
          updated_at?: string
        }
        Update: {
          ad_frequency?: number
          created_at?: string
          enabled?: boolean
          id?: boolean
          updated_at?: string
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
      admin_owners: {
        Row: {
          created_at: string
          note: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          note?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          note?: string
          updated_at?: string
          user_id?: string
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
      beta_launch_notifications: {
        Row: {
          created_at: string
          dispatch_id: string
          email: string
          id: string
          reason: string
          sent_at: string
          status: string
          subscriber_id: string
        }
        Insert: {
          created_at?: string
          dispatch_id: string
          email: string
          id?: string
          reason?: string
          sent_at?: string
          status?: string
          subscriber_id: string
        }
        Update: {
          created_at?: string
          dispatch_id?: string
          email?: string
          id?: string
          reason?: string
          sent_at?: string
          status?: string
          subscriber_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beta_launch_notifications_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: true
            referencedRelation: "newsletter_subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_launch_state: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          created_at: string
          dispatch_id: string | null
          id: boolean
          open_beta_enabled: boolean
          scheduled_send_at: string | null
          send_completed_at: string | null
          send_started_at: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          created_at?: string
          dispatch_id?: string | null
          id?: boolean
          open_beta_enabled?: boolean
          scheduled_send_at?: string | null
          send_completed_at?: string | null
          send_started_at?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          created_at?: string
          dispatch_id?: string | null
          id?: boolean
          open_beta_enabled?: boolean
          scheduled_send_at?: string | null
          send_completed_at?: string | null
          send_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      channel_bans: {
        Row: {
          channel_id: string
          created_at: string
          created_by: string | null
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_bans_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          name_el: string | null
          name_en: string | null
          parent_category_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_el?: string | null
          name_en?: string | null
          parent_category_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_el?: string | null
          name_en?: string | null
          parent_category_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "channel_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_follows: {
        Row: {
          channel_id: string
          created_at: string
          tier: string
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          tier?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          tier?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_follows_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_members: {
        Row: {
          channel_id: string
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["channel_role"]
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["channel_role"]
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["channel_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          followers_count: number
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_public: boolean
          name: string
          owner_id: string | null
          posts_count: number
          region: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          followers_count?: number
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_public?: boolean
          name: string
          owner_id?: string | null
          posts_count?: number
          region?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          followers_count?: number
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_public?: boolean
          name?: string
          owner_id?: string | null
          posts_count?: number
          region?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "channel_categories"
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
      comment_translations: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          source_language: string | null
          status: string
          target_language: string
          translated_body: string
          updated_at: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          source_language?: string | null
          status?: string
          target_language: string
          translated_body?: string
          updated_at?: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          source_language?: string | null
          status?: string
          target_language?: string
          translated_body?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_translations_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          body: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          slang_tag_ids: string[]
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          slang_tag_ids?: string[]
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          slang_tag_ids?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
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
      connection_suggestions: {
        Row: {
          computed_at: string
          mutual_count: number
          reasons: string[]
          score: number
          suggested_id: string
          user_id: string
        }
        Insert: {
          computed_at?: string
          mutual_count?: number
          reasons?: string[]
          score?: number
          suggested_id: string
          user_id: string
        }
        Update: {
          computed_at?: string
          mutual_count?: number
          reasons?: string[]
          score?: number
          suggested_id?: string
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
      counter_events: {
        Row: {
          created_at: string
          delta: number
          entity: string
          entity_id: string
          field: string
          id: number
        }
        Insert: {
          created_at?: string
          delta?: number
          entity: string
          entity_id: string
          field: string
          id?: number
        }
        Update: {
          created_at?: string
          delta?: number
          entity?: string
          entity_id?: string
          field?: string
          id?: number
        }
        Relationships: []
      }
      creator_subscription_prices: {
        Row: {
          active: boolean
          created_at: string
          creator_id: string
          currency: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          creator_id: string
          currency?: string
          price_cents: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          creator_id?: string
          currency?: string
          price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_subscription_prices_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          creator_id: string
          currency: string
          current_period_end: string | null
          environment: string
          id: string
          price_cents: number | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscriber_id: string
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          creator_id: string
          currency?: string
          current_period_end?: string | null
          environment: string
          id?: string
          price_cents?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscriber_id: string
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          creator_id?: string
          currency?: string
          current_period_end?: string | null
          environment?: string
          id?: string
          price_cents?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscriber_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_subscriptions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_subscriptions_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      easter_eggs: {
        Row: {
          audio_base64: string | null
          audio_mime: string
          audio_url: string | null
          created_at: string
          id: string
          is_active: boolean
          key: string
          title: string
          transcript: string
        }
        Insert: {
          audio_base64?: string | null
          audio_mime?: string
          audio_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          title: string
          transcript: string
        }
        Update: {
          audio_base64?: string | null
          audio_mime?: string
          audio_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          title?: string
          transcript?: string
        }
        Relationships: []
      }
      feed_learned_weights: {
        Row: {
          created_at: string
          events_count: number
          key: string
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          events_count?: number
          key: string
          updated_at?: string
          user_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          events_count?: number
          key?: string
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      feed_score_cache: {
        Row: {
          breakdown: Json
          computed_at: string
          post_id: string
          score: number
          user_id: string
        }
        Insert: {
          breakdown?: Json
          computed_at?: string
          post_id: string
          score?: number
          user_id: string
        }
        Update: {
          breakdown?: Json
          computed_at?: string
          post_id?: string
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      feed_signals: {
        Row: {
          author_id: string | null
          created_at: string
          dwell_ms: number
          id: string
          post_id: string | null
          signal: string
          user_id: string
          value: number
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          dwell_ms?: number
          id?: string
          post_id?: string | null
          signal: string
          user_id: string
          value?: number
        }
        Update: {
          author_id?: string | null
          created_at?: string
          dwell_ms?: number
          id?: string
          post_id?: string | null
          signal?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      feedback: {
        Row: {
          admin_note: string
          area: string
          browser: string
          category: Database["public"]["Enums"]["feedback_category"]
          created_at: string
          device: string
          handled_at: string | null
          handled_by: string | null
          id: string
          message: string
          os: string
          status: Database["public"]["Enums"]["feedback_status"]
          updated_at: string
          user_id: string
          user_roles: string[]
          username: string
        }
        Insert: {
          admin_note?: string
          area?: string
          browser?: string
          category: Database["public"]["Enums"]["feedback_category"]
          created_at?: string
          device?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message: string
          os?: string
          status?: Database["public"]["Enums"]["feedback_status"]
          updated_at?: string
          user_id: string
          user_roles?: string[]
          username?: string
        }
        Update: {
          admin_note?: string
          area?: string
          browser?: string
          category?: Database["public"]["Enums"]["feedback_category"]
          created_at?: string
          device?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string
          os?: string
          status?: Database["public"]["Enums"]["feedback_status"]
          updated_at?: string
          user_id?: string
          user_roles?: string[]
          username?: string
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
      globe_entries: {
        Row: {
          created_at: string
          down_count: number
          id: string
          language: string
          normalized_name: string
          ratio: number
          region: string
          round_id: string | null
          tag_id: string
          up_count: number
        }
        Insert: {
          created_at?: string
          down_count?: number
          id?: string
          language?: string
          normalized_name: string
          ratio?: number
          region?: string
          round_id?: string | null
          tag_id: string
          up_count?: number
        }
        Update: {
          created_at?: string
          down_count?: number
          id?: string
          language?: string
          normalized_name?: string
          ratio?: number
          region?: string
          round_id?: string | null
          tag_id?: string
          up_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "globe_entries_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "globe_vote_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "globe_entries_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: true
            referencedRelation: "slang_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      globe_vote_entries: {
        Row: {
          created_at: string
          id: string
          round_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          round_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          round_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "globe_vote_entries_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "globe_vote_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "globe_vote_entries_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "slang_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      globe_vote_results: {
        Row: {
          created_at: string
          down_count: number
          id: string
          ratio: number
          round_id: string
          tag_id: string
          tag_name: string
          up_count: number
          winner: boolean
        }
        Insert: {
          created_at?: string
          down_count?: number
          id?: string
          ratio?: number
          round_id: string
          tag_id: string
          tag_name?: string
          up_count?: number
          winner?: boolean
        }
        Update: {
          created_at?: string
          down_count?: number
          id?: string
          ratio?: number
          round_id?: string
          tag_id?: string
          tag_name?: string
          up_count?: number
          winner?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "globe_vote_results_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "globe_vote_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      globe_vote_rounds: {
        Row: {
          closed_at: string | null
          created_at: string
          ends_at: string
          id: string
          round_no: number
          starts_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          ends_at: string
          id?: string
          round_no: number
          starts_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          round_no?: number
          starts_at?: string
        }
        Relationships: []
      }
      hashtag_follows: {
        Row: {
          created_at: string
          hashtag_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hashtag_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          hashtag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hashtag_follows_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
        ]
      }
      hashtags: {
        Row: {
          created_at: string
          id: string
          label: string
          last_used_at: string | null
          posts_count: number
          tag: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          posts_count?: number
          tag: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          posts_count?: number
          tag?: string
        }
        Relationships: []
      }
      identity_policy: {
        Row: {
          created_at: string
          display_mode_change_cooldown_days: number
          id: boolean
          updated_at: string
          username_change_cooldown_days: number
        }
        Insert: {
          created_at?: string
          display_mode_change_cooldown_days?: number
          id?: boolean
          updated_at?: string
          username_change_cooldown_days?: number
        }
        Update: {
          created_at?: string
          display_mode_change_cooldown_days?: number
          id?: boolean
          updated_at?: string
          username_change_cooldown_days?: number
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
      market_ad_campaigns: {
        Row: {
          advertiser_id: string
          budget_cents: number | null
          created_at: string
          currency: string
          ends_at: string | null
          id: string
          slang_tag_id: string | null
          starts_at: string | null
          status: string
          target_channel_id: string | null
          target_lat: number | null
          target_lon: number | null
          target_radius_km: number | null
          title: string
          updated_at: string
        }
        Insert: {
          advertiser_id: string
          budget_cents?: number | null
          created_at?: string
          currency?: string
          ends_at?: string | null
          id?: string
          slang_tag_id?: string | null
          starts_at?: string | null
          status?: string
          target_channel_id?: string | null
          target_lat?: number | null
          target_lon?: number | null
          target_radius_km?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          advertiser_id?: string
          budget_cents?: number | null
          created_at?: string
          currency?: string
          ends_at?: string | null
          id?: string
          slang_tag_id?: string | null
          starts_at?: string | null
          status?: string
          target_channel_id?: string | null
          target_lat?: number | null
          target_lon?: number | null
          target_radius_km?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      market_analytics_events: {
        Row: {
          actor_id: string | null
          category_id: string | null
          created_at: string
          event: string
          id: number
          item_id: string | null
          meta: Json
          seller_id: string | null
        }
        Insert: {
          actor_id?: string | null
          category_id?: string | null
          created_at?: string
          event: string
          id?: number
          item_id?: string | null
          meta?: Json
          seller_id?: string | null
        }
        Update: {
          actor_id?: string | null
          category_id?: string | null
          created_at?: string
          event?: string
          id?: number
          item_id?: string | null
          meta?: Json
          seller_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_analytics_events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "market_items"
            referencedColumns: ["id"]
          },
        ]
      }
      market_categories: {
        Row: {
          active: boolean
          created_at: string
          icon: string | null
          id: string
          name: string
          name_el: string | null
          name_en: string | null
          parent_id: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          name_el?: string | null
          name_en?: string | null
          parent_id?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          name_el?: string | null
          name_en?: string | null
          parent_id?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "market_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      market_disputes: {
        Row: {
          created_at: string
          details: string | null
          id: string
          opened_by: string
          reason_code: string
          resolution: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["market_dispute_status"]
          transaction_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          opened_by: string
          reason_code: string
          resolution?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["market_dispute_status"]
          transaction_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          opened_by?: string
          reason_code?: string
          resolution?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["market_dispute_status"]
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_disputes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "market_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      market_favorites: {
        Row: {
          created_at: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_favorites_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "market_items"
            referencedColumns: ["id"]
          },
        ]
      }
      market_fee_settings: {
        Row: {
          created_at: string
          id: boolean
          platform_fee_bps: number
          platform_fee_fixed_cents: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: boolean
          platform_fee_bps?: number
          platform_fee_fixed_cents?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: boolean
          platform_fee_bps?: number
          platform_fee_fixed_cents?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      market_images: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          item_id: string
          path: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          item_id: string
          path: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          item_id?: string
          path?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_images_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "market_items"
            referencedColumns: ["id"]
          },
        ]
      }
      market_item_channels: {
        Row: {
          channel_id: string
          created_at: string
          item_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          item_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_item_channels_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_item_channels_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "market_items"
            referencedColumns: ["id"]
          },
        ]
      }
      market_item_slang_tags: {
        Row: {
          item_id: string
          sort_order: number
          tag_id: string
        }
        Insert: {
          item_id: string
          sort_order?: number
          tag_id: string
        }
        Update: {
          item_id?: string
          sort_order?: number
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_item_slang_tags_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "market_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_item_slang_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "slang_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      market_items: {
        Row: {
          attributes: Json
          buy_now_enabled: boolean
          category_id: string | null
          condition: Database["public"]["Enums"]["market_item_condition"]
          created_at: string
          currency: string
          delivery: Database["public"]["Enums"]["market_delivery"]
          description: string
          favorites_count: number
          id: string
          lat: number | null
          lon: number | null
          negotiable: boolean
          place: string | null
          postal_code: string | null
          price_cents: number
          promoted_until: string | null
          promotion_created_at: string | null
          promotion_disabled_at: string | null
          promotion_disabled_by: string | null
          promotion_radius_km: number | null
          promotion_type: Database["public"]["Enums"]["market_promotion_type"]
          quantity: number
          search_tsv: unknown
          seller_id: string
          shipping_price_cents: number
          status: Database["public"]["Enums"]["market_item_status"]
          title: string
          updated_at: string
          views_count: number
        }
        Insert: {
          attributes?: Json
          buy_now_enabled?: boolean
          category_id?: string | null
          condition?: Database["public"]["Enums"]["market_item_condition"]
          created_at?: string
          currency?: string
          delivery?: Database["public"]["Enums"]["market_delivery"]
          description?: string
          favorites_count?: number
          id?: string
          lat?: number | null
          lon?: number | null
          negotiable?: boolean
          place?: string | null
          postal_code?: string | null
          price_cents?: number
          promoted_until?: string | null
          promotion_created_at?: string | null
          promotion_disabled_at?: string | null
          promotion_disabled_by?: string | null
          promotion_radius_km?: number | null
          promotion_type?: Database["public"]["Enums"]["market_promotion_type"]
          quantity?: number
          search_tsv?: unknown
          seller_id: string
          shipping_price_cents?: number
          status?: Database["public"]["Enums"]["market_item_status"]
          title: string
          updated_at?: string
          views_count?: number
        }
        Update: {
          attributes?: Json
          buy_now_enabled?: boolean
          category_id?: string | null
          condition?: Database["public"]["Enums"]["market_item_condition"]
          created_at?: string
          currency?: string
          delivery?: Database["public"]["Enums"]["market_delivery"]
          description?: string
          favorites_count?: number
          id?: string
          lat?: number | null
          lon?: number | null
          negotiable?: boolean
          place?: string | null
          postal_code?: string | null
          price_cents?: number
          promoted_until?: string | null
          promotion_created_at?: string | null
          promotion_disabled_at?: string | null
          promotion_disabled_by?: string | null
          promotion_radius_km?: number | null
          promotion_type?: Database["public"]["Enums"]["market_promotion_type"]
          quantity?: number
          search_tsv?: unknown
          seller_id?: string
          shipping_price_cents?: number
          status?: Database["public"]["Enums"]["market_item_status"]
          title?: string
          updated_at?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "market_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      market_offers: {
        Row: {
          amount_cents: number
          buyer_id: string
          conversation_id: string | null
          created_at: string
          id: string
          item_id: string
          seller_id: string
          status: Database["public"]["Enums"]["market_offer_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          buyer_id: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          item_id: string
          seller_id: string
          status?: Database["public"]["Enums"]["market_offer_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          buyer_id?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          item_id?: string
          seller_id?: string
          status?: Database["public"]["Enums"]["market_offer_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_offers_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_offers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "market_items"
            referencedColumns: ["id"]
          },
        ]
      }
      market_payment_records: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          environment: string
          id: string
          provider: string
          provider_payment_intent_id: string | null
          provider_session_id: string | null
          status: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          provider?: string
          provider_payment_intent_id?: string | null
          provider_session_id?: string | null
          status?: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          provider?: string
          provider_payment_intent_id?: string | null
          provider_session_id?: string | null
          status?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_payment_records_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "market_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      market_payment_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          id: string
          processed_at: string
          provider: string
          transaction_id: string | null
        }
        Insert: {
          event_id: string
          event_type: string
          id?: string
          processed_at?: string
          provider?: string
          transaction_id?: string | null
        }
        Update: {
          event_id?: string
          event_type?: string
          id?: string
          processed_at?: string
          provider?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_payment_webhook_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "market_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      market_promotion_plans: {
        Row: {
          active: boolean
          code: string
          created_at: string
          currency: string
          duration_days: number
          price_cents: number
          promotion_type: Database["public"]["Enums"]["market_promotion_type"]
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          currency?: string
          duration_days: number
          price_cents: number
          promotion_type?: Database["public"]["Enums"]["market_promotion_type"]
          sort_order?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          currency?: string
          duration_days?: number
          price_cents?: number
          promotion_type?: Database["public"]["Enums"]["market_promotion_type"]
          sort_order?: number
        }
        Relationships: []
      }
      market_promotions: {
        Row: {
          created_at: string
          currency: string
          duration_days: number
          ends_at: string | null
          environment: string | null
          id: string
          item_id: string
          note: string | null
          paid_amount_cents: number | null
          paid_at: string | null
          payment_status: Database["public"]["Enums"]["market_payment_status"]
          plan_code: string | null
          price_cents: number
          promotion_type: Database["public"]["Enums"]["market_promotion_type"]
          provider_payment_intent_id: string | null
          provider_session_id: string | null
          radius_km: number | null
          seller_id: string
          starts_at: string | null
          status: Database["public"]["Enums"]["market_promotion_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          duration_days?: number
          ends_at?: string | null
          environment?: string | null
          id?: string
          item_id: string
          note?: string | null
          paid_amount_cents?: number | null
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["market_payment_status"]
          plan_code?: string | null
          price_cents?: number
          promotion_type?: Database["public"]["Enums"]["market_promotion_type"]
          provider_payment_intent_id?: string | null
          provider_session_id?: string | null
          radius_km?: number | null
          seller_id: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["market_promotion_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          duration_days?: number
          ends_at?: string | null
          environment?: string | null
          id?: string
          item_id?: string
          note?: string | null
          paid_amount_cents?: number | null
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["market_payment_status"]
          plan_code?: string | null
          price_cents?: number
          promotion_type?: Database["public"]["Enums"]["market_promotion_type"]
          provider_payment_intent_id?: string | null
          provider_session_id?: string | null
          radius_km?: number | null
          seller_id?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["market_promotion_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_promotions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "market_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_promotions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "market_promotion_plans"
            referencedColumns: ["code"]
          },
        ]
      }
      market_refunds: {
        Row: {
          amount_cents: number
          created_at: string
          decided_by: string | null
          id: string
          provider_refund_id: string | null
          reason: string | null
          requested_by: string
          status: Database["public"]["Enums"]["market_refund_status"]
          transaction_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          decided_by?: string | null
          id?: string
          provider_refund_id?: string | null
          reason?: string | null
          requested_by: string
          status?: Database["public"]["Enums"]["market_refund_status"]
          transaction_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          decided_by?: string | null
          id?: string
          provider_refund_id?: string | null
          reason?: string | null
          requested_by?: string
          status?: Database["public"]["Enums"]["market_refund_status"]
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_refunds_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "market_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      market_searches: {
        Row: {
          created_at: string
          id: string
          label: string
          notify: boolean
          query: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          notify?: boolean
          query?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          notify?: boolean
          query?: Json
          user_id?: string
        }
        Relationships: []
      }
      market_seller_profiles: {
        Row: {
          business_name: string | null
          created_at: string
          description: string | null
          logo_path: string | null
          seller_type: string
          updated_at: string
          user_id: string
          verified_business: boolean
          website: string | null
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          description?: string | null
          logo_path?: string | null
          seller_type?: string
          updated_at?: string
          user_id: string
          verified_business?: boolean
          website?: string | null
        }
        Update: {
          business_name?: string | null
          created_at?: string
          description?: string | null
          logo_path?: string | null
          seller_type?: string
          updated_at?: string
          user_id?: string
          verified_business?: boolean
          website?: string | null
        }
        Relationships: []
      }
      market_shipping: {
        Row: {
          address: Json | null
          carrier: string | null
          cost_cents: number
          created_at: string
          delivered_at: string | null
          method: string | null
          shipped_at: string | null
          tracking_number: string | null
          transaction_id: string
          updated_at: string
        }
        Insert: {
          address?: Json | null
          carrier?: string | null
          cost_cents?: number
          created_at?: string
          delivered_at?: string | null
          method?: string | null
          shipped_at?: string | null
          tracking_number?: string | null
          transaction_id: string
          updated_at?: string
        }
        Update: {
          address?: Json | null
          carrier?: string | null
          cost_cents?: number
          created_at?: string
          delivered_at?: string | null
          method?: string | null
          shipped_at?: string | null
          tracking_number?: string | null
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_shipping_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "market_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      market_transaction_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          meta: Json
          transaction_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          meta?: Json
          transaction_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          meta?: Json
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_transaction_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "market_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      market_transaction_secrets: {
        Row: {
          created_at: string
          pickup_code: string
          transaction_id: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          pickup_code: string
          transaction_id: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          pickup_code?: string
          transaction_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_transaction_secrets_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "market_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      market_transactions: {
        Row: {
          buyer_id: string
          cancel_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          conversation_id: string | null
          created_at: string
          currency: string
          fulfillment_type: Database["public"]["Enums"]["market_fulfillment_type"]
          id: string
          item_id: string
          item_price_cents: number
          offer_id: string | null
          paid_at: string | null
          payment_fee_cents: number
          payment_status: Database["public"]["Enums"]["market_payment_status"]
          platform_fee_cents: number
          quantity: number
          reference: string
          seller_amount_cents: number
          seller_id: string
          shipping_price_cents: number
          shipping_status: Database["public"]["Enums"]["market_shipping_status"]
          status: Database["public"]["Enums"]["market_transaction_status"]
          total_cents: number
          updated_at: string
        }
        Insert: {
          buyer_id: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          currency?: string
          fulfillment_type: Database["public"]["Enums"]["market_fulfillment_type"]
          id?: string
          item_id: string
          item_price_cents: number
          offer_id?: string | null
          paid_at?: string | null
          payment_fee_cents?: number
          payment_status?: Database["public"]["Enums"]["market_payment_status"]
          platform_fee_cents?: number
          quantity?: number
          reference: string
          seller_amount_cents?: number
          seller_id: string
          shipping_price_cents?: number
          shipping_status?: Database["public"]["Enums"]["market_shipping_status"]
          status?: Database["public"]["Enums"]["market_transaction_status"]
          total_cents: number
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          currency?: string
          fulfillment_type?: Database["public"]["Enums"]["market_fulfillment_type"]
          id?: string
          item_id?: string
          item_price_cents?: number
          offer_id?: string | null
          paid_at?: string | null
          payment_fee_cents?: number
          payment_status?: Database["public"]["Enums"]["market_payment_status"]
          platform_fee_cents?: number
          quantity?: number
          reference?: string
          seller_amount_cents?: number
          seller_id?: string
          shipping_price_cents?: number
          shipping_status?: Database["public"]["Enums"]["market_shipping_status"]
          status?: Database["public"]["Enums"]["market_transaction_status"]
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_transactions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "market_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_transactions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "market_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      media_variant_jobs: {
        Row: {
          attempts: number
          created_at: string
          last_error: string | null
          needs_medium: boolean
          needs_thumb: boolean
          owner_id: string
          path: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          last_error?: string | null
          needs_medium?: boolean
          needs_thumb?: boolean
          owner_id: string
          path: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          last_error?: string | null
          needs_medium?: boolean
          needs_thumb?: boolean
          owner_id?: string
          path?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_translations: {
        Row: {
          audio_path: string | null
          created_at: string
          id: string
          message_id: string
          source_language: string | null
          status: string
          target_language: string
          transcript: string | null
          translated_text: string
        }
        Insert: {
          audio_path?: string | null
          created_at?: string
          id?: string
          message_id: string
          source_language?: string | null
          status?: string
          target_language: string
          transcript?: string | null
          translated_text?: string
        }
        Update: {
          audio_path?: string | null
          created_at?: string
          id?: string
          message_id?: string
          source_language?: string | null
          status?: string
          target_language?: string
          transcript?: string | null
          translated_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_translations_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
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
          market_item_id: string | null
          market_offer_id: string | null
          media_placement: Json | null
          media_url: string | null
          read_at: string | null
          sender_id: string
          slang_tag_id: string | null
          slang_tag_ids: string[]
          source_language: string | null
          transcript: string | null
        }
        Insert: {
          body?: string
          chat_slang_tag_id?: string | null
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          kind?: string
          market_item_id?: string | null
          market_offer_id?: string | null
          media_placement?: Json | null
          media_url?: string | null
          read_at?: string | null
          sender_id: string
          slang_tag_id?: string | null
          slang_tag_ids?: string[]
          source_language?: string | null
          transcript?: string | null
        }
        Update: {
          body?: string
          chat_slang_tag_id?: string | null
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          kind?: string
          market_item_id?: string | null
          market_offer_id?: string | null
          media_placement?: Json | null
          media_url?: string | null
          read_at?: string | null
          sender_id?: string
          slang_tag_id?: string | null
          slang_tag_ids?: string[]
          source_language?: string | null
          transcript?: string | null
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
          {
            foreignKeyName: "messages_market_item_id_fkey"
            columns: ["market_item_id"]
            isOneToOne: false
            referencedRelation: "market_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_market_offer_id_fkey"
            columns: ["market_offer_id"]
            isOneToOne: false
            referencedRelation: "market_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action_kind: Database["public"]["Enums"]["moderation_action_kind"]
          admin_id: string | null
          appeal_deadline: string | null
          automated: boolean
          created_at: string
          id: string
          internal_note: string
          public_reason: string
          reason_code: Database["public"]["Enums"]["moderation_reason_code"]
          report_id: string | null
          target_id: string | null
          target_label: string
          target_type: string
          target_user_id: string | null
          updated_at: string
          user_informed_at: string | null
        }
        Insert: {
          action_kind: Database["public"]["Enums"]["moderation_action_kind"]
          admin_id?: string | null
          appeal_deadline?: string | null
          automated?: boolean
          created_at?: string
          id?: string
          internal_note?: string
          public_reason?: string
          reason_code?: Database["public"]["Enums"]["moderation_reason_code"]
          report_id?: string | null
          target_id?: string | null
          target_label?: string
          target_type: string
          target_user_id?: string | null
          updated_at?: string
          user_informed_at?: string | null
        }
        Update: {
          action_kind?: Database["public"]["Enums"]["moderation_action_kind"]
          admin_id?: string | null
          appeal_deadline?: string | null
          automated?: boolean
          created_at?: string
          id?: string
          internal_note?: string
          public_reason?: string
          reason_code?: Database["public"]["Enums"]["moderation_reason_code"]
          report_id?: string | null
          target_id?: string | null
          target_label?: string
          target_type?: string
          target_user_id?: string | null
          updated_at?: string
          user_informed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_appeals: {
        Row: {
          action_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string
          id: string
          message: string
          status: Database["public"]["Enums"]["moderation_appeal_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          action_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string
          id?: string
          message?: string
          status?: Database["public"]["Enums"]["moderation_appeal_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          action_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string
          id?: string
          message?: string
          status?: Database["public"]["Enums"]["moderation_appeal_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_appeals_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: true
            referencedRelation: "moderation_actions"
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
      notification_jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          next_attempt_at: string
          notification_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          notification_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          notification_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_jobs_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: true
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          group_count: number
          id: string
          last_push_at: string | null
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          group_count?: number
          id?: string
          last_push_at?: string | null
          link?: string | null
          read?: boolean
          title?: string
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          group_count?: number
          id?: string
          last_push_at?: string | null
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      ops_events: {
        Row: {
          area: string
          context: Json
          created_at: string
          duration_ms: number | null
          environment: string
          event: string
          fingerprint: string
          fn: string | null
          id: string
          message: string | null
          service: string | null
          severity: string
        }
        Insert: {
          area: string
          context?: Json
          created_at?: string
          duration_ms?: number | null
          environment?: string
          event: string
          fingerprint: string
          fn?: string | null
          id?: string
          message?: string | null
          service?: string | null
          severity?: string
        }
        Update: {
          area?: string
          context?: Json
          created_at?: string
          duration_ms?: number | null
          environment?: string
          event?: string
          fingerprint?: string
          fn?: string | null
          id?: string
          message?: string | null
          service?: string | null
          severity?: string
        }
        Relationships: []
      }
      ops_incidents: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_count: number
          alerted_at: string | null
          area: string
          created_at: string
          environment: string
          event_count: number
          fingerprint: string
          first_seen_at: string
          id: string
          last_seen_at: string
          note: string | null
          resolved_at: string | null
          severity: string
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_count?: number
          alerted_at?: string | null
          area: string
          created_at?: string
          environment?: string
          event_count?: number
          fingerprint: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          note?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_count?: number
          alerted_at?: string | null
          area?: string
          created_at?: string
          environment?: string
          event_count?: number
          fingerprint?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          note?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      post_hashtags: {
        Row: {
          created_at: string
          hashtag_id: string
          post_id: string
        }
        Insert: {
          created_at?: string
          hashtag_id: string
          post_id: string
        }
        Update: {
          created_at?: string
          hashtag_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_hashtags_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hashtags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
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
      post_moderation_jobs: {
        Row: {
          attempts: number
          created_at: string
          duration_ms: number | null
          finished_at: string | null
          id: string
          kind: string
          last_error: string
          next_attempt_at: string
          post_id: string
          result: string
          skip_image: boolean
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          kind?: string
          last_error?: string
          next_attempt_at?: string
          post_id: string
          result?: string
          skip_image?: boolean
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          kind?: string
          last_error?: string
          next_attempt_at?: string
          post_id?: string
          result?: string
          skip_image?: boolean
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_moderation_jobs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_originals: {
        Row: {
          created_at: string
          owner_id: string
          post_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          owner_id: string
          post_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          owner_id?: string
          post_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_originals_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
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
      post_translations: {
        Row: {
          created_at: string
          id: string
          post_id: string
          source_language: string | null
          status: string
          target_language: string
          translated_description: string
          translated_title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          source_language?: string | null
          status?: string
          target_language: string
          translated_description?: string
          translated_title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          source_language?: string | null
          status?: string
          target_language?: string
          translated_description?: string
          translated_title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_translations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_video_views: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_video_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_video_views_user_id_fkey"
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
          channel_approved_at: string | null
          channel_category_id: string | null
          channel_id: string | null
          channel_pinned: boolean
          comments_count: number
          created_at: string
          description: string
          duration: string
          hashtags: string[]
          hidden_at: string | null
          id: string
          image_url: string | null
          likes_count: number
          moderated_at: string | null
          moderation_reason: string
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          placements: Json
          region: string
          saves_count: number
          shares_count: number
          slang_tag_ids: string[]
          slangtag_order_locked: boolean
          source_language: string | null
          title: string
          updated_at: string
          user_id: string
          video_duration_ms: number | null
          video_url: string | null
          video_views_count: number
          views_count: number
          visibility: Database["public"]["Enums"]["post_visibility"]
        }
        Insert: {
          audio_url?: string | null
          channel_approved_at?: string | null
          channel_category_id?: string | null
          channel_id?: string | null
          channel_pinned?: boolean
          comments_count?: number
          created_at?: string
          description?: string
          duration?: string
          hashtags?: string[]
          hidden_at?: string | null
          id?: string
          image_url?: string | null
          likes_count?: number
          moderated_at?: string | null
          moderation_reason?: string
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          placements?: Json
          region?: string
          saves_count?: number
          shares_count?: number
          slang_tag_ids?: string[]
          slangtag_order_locked?: boolean
          source_language?: string | null
          title?: string
          updated_at?: string
          user_id: string
          video_duration_ms?: number | null
          video_url?: string | null
          video_views_count?: number
          views_count?: number
          visibility?: Database["public"]["Enums"]["post_visibility"]
        }
        Update: {
          audio_url?: string | null
          channel_approved_at?: string | null
          channel_category_id?: string | null
          channel_id?: string | null
          channel_pinned?: boolean
          comments_count?: number
          created_at?: string
          description?: string
          duration?: string
          hashtags?: string[]
          hidden_at?: string | null
          id?: string
          image_url?: string | null
          likes_count?: number
          moderated_at?: string | null
          moderation_reason?: string
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          placements?: Json
          region?: string
          saves_count?: number
          shares_count?: number
          slang_tag_ids?: string[]
          slangtag_order_locked?: boolean
          source_language?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          video_duration_ms?: number | null
          video_url?: string | null
          video_views_count?: number
          views_count?: number
          visibility?: Database["public"]["Enums"]["post_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "posts_channel_category_id_fkey"
            columns: ["channel_category_id"]
            isOneToOne: false
            referencedRelation: "channel_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
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
          ads_enabled: boolean
          avatar_url: string | null
          bio: string
          birthday: string | null
          cover_url: string | null
          created_at: string
          discord: string
          display_name: string
          display_name_mode: Database["public"]["Enums"]["display_name_mode"]
          display_name_mode_changed_at: string | null
          fav_games: string[]
          fav_movies: string[]
          fav_music: string[]
          fav_sports: string[]
          field_visibility: Json
          first_name: string
          hobbies: string[]
          id: string
          instagram: string
          interest_tags: string[]
          is_test_user: boolean
          language: string
          languages: string[]
          last_name: string
          last_seen_at: string
          level: number
          likes_private: boolean
          location: string
          location_visibility: Database["public"]["Enums"]["location_visibility"]
          origin: string
          presence_status: Database["public"]["Enums"]["presence_status"]
          profile_visibility: Database["public"]["Enums"]["profile_visibility"]
          pronouns: string
          push_enabled: boolean
          real_name: string
          real_name_hidden: boolean
          swipe_hint_seen: boolean
          theme: string
          tiktok: string
          twitch: string
          ui_language: string | null
          updated_at: string
          username: string
          username_changed_at: string | null
          verified: boolean
          website: string
          xp: number
          youtube: string
        }
        Insert: {
          ads_enabled?: boolean
          avatar_url?: string | null
          bio?: string
          birthday?: string | null
          cover_url?: string | null
          created_at?: string
          discord?: string
          display_name?: string
          display_name_mode?: Database["public"]["Enums"]["display_name_mode"]
          display_name_mode_changed_at?: string | null
          fav_games?: string[]
          fav_movies?: string[]
          fav_music?: string[]
          fav_sports?: string[]
          field_visibility?: Json
          first_name?: string
          hobbies?: string[]
          id: string
          instagram?: string
          interest_tags?: string[]
          is_test_user?: boolean
          language?: string
          languages?: string[]
          last_name?: string
          last_seen_at?: string
          level?: number
          likes_private?: boolean
          location?: string
          location_visibility?: Database["public"]["Enums"]["location_visibility"]
          origin?: string
          presence_status?: Database["public"]["Enums"]["presence_status"]
          profile_visibility?: Database["public"]["Enums"]["profile_visibility"]
          pronouns?: string
          push_enabled?: boolean
          real_name?: string
          real_name_hidden?: boolean
          swipe_hint_seen?: boolean
          theme?: string
          tiktok?: string
          twitch?: string
          ui_language?: string | null
          updated_at?: string
          username: string
          username_changed_at?: string | null
          verified?: boolean
          website?: string
          xp?: number
          youtube?: string
        }
        Update: {
          ads_enabled?: boolean
          avatar_url?: string | null
          bio?: string
          birthday?: string | null
          cover_url?: string | null
          created_at?: string
          discord?: string
          display_name?: string
          display_name_mode?: Database["public"]["Enums"]["display_name_mode"]
          display_name_mode_changed_at?: string | null
          fav_games?: string[]
          fav_movies?: string[]
          fav_music?: string[]
          fav_sports?: string[]
          field_visibility?: Json
          first_name?: string
          hobbies?: string[]
          id?: string
          instagram?: string
          interest_tags?: string[]
          is_test_user?: boolean
          language?: string
          languages?: string[]
          last_name?: string
          last_seen_at?: string
          level?: number
          likes_private?: boolean
          location?: string
          location_visibility?: Database["public"]["Enums"]["location_visibility"]
          origin?: string
          presence_status?: Database["public"]["Enums"]["presence_status"]
          profile_visibility?: Database["public"]["Enums"]["profile_visibility"]
          pronouns?: string
          push_enabled?: boolean
          real_name?: string
          real_name_hidden?: boolean
          swipe_hint_seen?: boolean
          theme?: string
          tiktok?: string
          twitch?: string
          ui_language?: string | null
          updated_at?: string
          username?: string
          username_changed_at?: string | null
          verified?: boolean
          website?: string
          xp?: number
          youtube?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          failure_count: number
          id: string
          last_seen_at: string
          p256dh: string
          updated_at: string
          user_agent: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          failure_count?: number
          id?: string
          last_seen_at?: string
          p256dh: string
          updated_at?: string
          user_agent?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          failure_count?: number
          id?: string
          last_seen_at?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          decided_at: string | null
          decision_code:
            | Database["public"]["Enums"]["moderation_reason_code"]
            | null
          details: string
          id: string
          reason: string
          reporter_id: string
          reporter_informed_at: string | null
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
          decided_at?: string | null
          decision_code?:
            | Database["public"]["Enums"]["moderation_reason_code"]
            | null
          details?: string
          id?: string
          reason?: string
          reporter_id: string
          reporter_informed_at?: string | null
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
          decided_at?: string | null
          decision_code?:
            | Database["public"]["Enums"]["moderation_reason_code"]
            | null
          details?: string
          id?: string
          reason?: string
          reporter_id?: string
          reporter_informed_at?: string | null
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
      reserved_usernames: {
        Row: {
          category: Database["public"]["Enums"]["reserved_username_category"]
          created_at: string
          id: string
          is_active: boolean
          normalized_username: string
          reason: string
          updated_at: string
          username: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["reserved_username_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          normalized_username: string
          reason?: string
          updated_at?: string
          username: string
        }
        Update: {
          category?: Database["public"]["Enums"]["reserved_username_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          normalized_username?: string
          reason?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      slang_definition_translations: {
        Row: {
          created_at: string
          definition_id: string
          example: string
          id: string
          lang: string
          meaning: string
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          definition_id: string
          example?: string
          id?: string
          lang: string
          meaning?: string
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          definition_id?: string
          example?: string
          id?: string
          lang?: string
          meaning?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slang_definition_translations_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "slang_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      slang_definitions: {
        Row: {
          city: string
          country: string
          created_at: string
          created_by: string | null
          display_name: string
          example: string
          geo_updated_at: string | null
          geo_updated_by: string | null
          id: string
          latitude: number | null
          longitude: number | null
          meaning: string
          normalized_name: string
          place_detail: string
          region: string
          region_name: string
          source_language: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          city?: string
          country?: string
          created_at?: string
          created_by?: string | null
          display_name?: string
          example?: string
          geo_updated_at?: string | null
          geo_updated_by?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          meaning?: string
          normalized_name: string
          place_detail?: string
          region?: string
          region_name?: string
          source_language?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          created_by?: string | null
          display_name?: string
          example?: string
          geo_updated_at?: string | null
          geo_updated_by?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          meaning?: string
          normalized_name?: string
          place_detail?: string
          region?: string
          region_name?: string
          source_language?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      slang_tag_drops: {
        Row: {
          active: boolean
          claims_count: number
          created_at: string
          creator_id: string
          ends_at: string | null
          max_claims: number | null
          starts_at: string | null
          tag_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          claims_count?: number
          created_at?: string
          creator_id: string
          ends_at?: string | null
          max_claims?: number | null
          starts_at?: string | null
          tag_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          claims_count?: number
          created_at?: string
          creator_id?: string
          ends_at?: string | null
          max_claims?: number | null
          starts_at?: string | null
          tag_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slang_tag_drops_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: true
            referencedRelation: "slang_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      slang_tag_grants: {
        Row: {
          created_at: string
          granted_by: string
          grantee_id: string
          id: string
          owner_id: string
          requires_follow: boolean
          tag_id: string
        }
        Insert: {
          created_at?: string
          granted_by: string
          grantee_id: string
          id?: string
          owner_id: string
          requires_follow?: boolean
          tag_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string
          grantee_id?: string
          id?: string
          owner_id?: string
          requires_follow?: boolean
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
      slang_tag_library: {
        Row: {
          acquired_at: string
          creator_id: string
          id: string
          is_permanent: boolean
          lapsed_at: string | null
          permanent_after: string | null
          revoked_at: string | null
          revoked_reason: string | null
          source: string
          tag_id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          creator_id: string
          id?: string
          is_permanent?: boolean
          lapsed_at?: string | null
          permanent_after?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          source?: string
          tag_id: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          creator_id?: string
          id?: string
          is_permanent?: boolean
          lapsed_at?: string | null
          permanent_after?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          source?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slang_tag_library_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "slang_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slang_tag_library_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      slang_tag_track_dedup: {
        Row: {
          kind: string
          tag_id: string
          user_id: string
          window_start: string
        }
        Insert: {
          kind: string
          tag_id: string
          user_id: string
          window_start: string
        }
        Update: {
          kind?: string
          tag_id?: string
          user_id?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "slang_tag_track_dedup_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "slang_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      slang_tag_video_uses: {
        Row: {
          created_at: string
          id: string
          media_type: string
          post_id: string
          region: string
          tag_id: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          media_type?: string
          post_id: string
          region?: string
          tag_id: string
          user_id: string
          year?: number
        }
        Update: {
          created_at?: string
          id?: string
          media_type?: string
          post_id?: string
          region?: string
          tag_id?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "slang_tag_video_uses_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slang_tag_video_uses_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "slang_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slang_tag_video_uses_user_id_fkey"
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
          community_shared: boolean
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
          normalized_name: string | null
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
          video_uses_count: number
          voucher: string
        }
        Insert: {
          audio_url?: string | null
          clicks_count?: number
          comments_count?: number
          community_shared?: boolean
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
          normalized_name?: string | null
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
          video_uses_count?: number
          voucher?: string
        }
        Update: {
          audio_url?: string | null
          clicks_count?: number
          comments_count?: number
          community_shared?: boolean
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
          normalized_name?: string | null
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
          video_uses_count?: number
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
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id?: string | null
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string | null
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
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
      activate_ad_pause: { Args: { _timezone?: string }; Returns: Json }
      are_connected: { Args: { _a: string; _b: string }; Returns: boolean }
      bootstrap_user_state: { Args: never; Returns: Json }
      business_campaign_limit: { Args: { _tier: string }; Returns: number }
      business_plan_tier: {
        Args: { _environment: string; _user_id: string }
        Returns: string
      }
      can_create_arena_challenge: {
        Args: { _user_id: string }
        Returns: boolean
      }
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
      can_see_arena_engagement: {
        Args: { _submission_id: string }
        Returns: boolean
      }
      can_see_arena_submission: {
        Args: { _submission_id: string }
        Returns: boolean
      }
      can_see_profile_field: {
        Args: { _owner: string; _vis: string }
        Returns: boolean
      }
      can_use_extended_audio: { Args: { _user_id: string }; Returns: boolean }
      can_use_slang_tag: {
        Args: { _tag_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_post: { Args: { _post_id: string }; Returns: boolean }
      can_view_profile: { Args: { _profile_id: string }; Returns: boolean }
      can_view_test_users: { Args: never; Returns: boolean }
      channel_moderate_post: {
        Args: { _action: string; _post_id: string }
        Returns: undefined
      }
      claim_creator_slang_tag: {
        Args: { _environment: string; _tag_id: string }
        Returns: boolean
      }
      cleanup_push_data: { Args: never; Returns: undefined }
      compute_connection_suggestions: {
        Args: { _limit?: number; _user: string }
        Returns: number
      }
      compute_public_display_name: {
        Args: {
          _first: string
          _last: string
          _mode: Database["public"]["Enums"]["display_name_mode"]
          _username: string
        }
        Returns: string
      }
      delete_slang_tag: { Args: { _tag_id: string }; Returns: boolean }
      feed_viewer_context: { Args: never; Returns: Json }
      flush_counter_events: { Args: { _max?: number }; Returns: number }
      globe_vote_close_round: {
        Args: { _round_id: string }
        Returns: undefined
      }
      globe_vote_current_round: {
        Args: never
        Returns: {
          ends_at: string
          entries: number
          id: string
          round_no: number
          server_now: string
          starts_at: string
        }[]
      }
      globe_vote_ensure_round: {
        Args: never
        Returns: {
          closed_at: string | null
          created_at: string
          ends_at: string
          id: string
          round_no: number
          starts_at: string
        }
        SetofOptions: {
          from: "*"
          to: "globe_vote_rounds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      globe_vote_week_end: { Args: { _at?: string }; Returns: string }
      has_active_creator_subscription: {
        Args: { _creator: string; _environment: string; _subscriber: string }
        Returns: boolean
      }
      has_active_subscription: {
        Args: { _environment: string; _user_id: string }
        Returns: boolean
      }
      has_pending_drop_entitlement: {
        Args: { _tag_id: string; _user_id: string }
        Returns: boolean
      }
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
      increment_campaign_metric: {
        Args: {
          _actor: string
          _environment?: string
          _id: string
          _kind: string
        }
        Returns: boolean
      }
      is_admin_owner: { Args: { _user_id: string }; Returns: boolean }
      is_arena_challenge_visible: {
        Args: { _challenge_id: string }
        Returns: boolean
      }
      is_channel_banned: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_channel_moderator: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_channel_owner: {
        Args: { _channel_id: string; _user_id: string }
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
      is_slang_tag_grant_active: {
        Args: { _grant_id: string }
        Returns: boolean
      }
      is_test_profile: { Args: { _id: string }; Returns: boolean }
      is_username_reserved: { Args: { _username: string }; Returns: boolean }
      mark_conversation_read: {
        Args: { _conversation_id: string }
        Returns: Json
      }
      market_accept_offer: { Args: { _offer_id: string }; Returns: Json }
      market_event_refs_valid: {
        Args: { _category_id: string; _item_id: string; _seller_id: string }
        Returns: boolean
      }
      market_expire_promotions: { Args: never; Returns: number }
      market_public_seller_profile: {
        Args: { _user_id: string }
        Returns: {
          business_name: string
          description: string
          logo_path: string
          seller_type: string
          user_id: string
          verified_business: boolean
          website: string
        }[]
      }
      market_seller_stats: { Args: { _seller: string }; Returns: Json }
      market_start_transaction: {
        Args: {
          _buyer_id: string
          _fulfillment: Database["public"]["Enums"]["market_fulfillment_type"]
          _item_id: string
          _offer_id?: string
        }
        Returns: string
      }
      normalize_username: { Args: { _username: string }; Returns: string }
      ops_rpc_probe: {
        Args: never
        Returns: {
          probe_rows: number
          reachable: boolean
          server_now: string
        }[]
      }
      owner_set_admin_role: {
        Args: { _actor: string; _grant: boolean; _target: string }
        Returns: boolean
      }
      owns_moderation_action: {
        Args: { _action_id: string; _user_id: string }
        Returns: boolean
      }
      owns_slang_name: { Args: { _normalized_name: string }; Returns: boolean }
      owns_slang_tag: { Args: { _tag_id: string }; Returns: boolean }
      owns_slang_tag_permanently: {
        Args: { _tag_id: string; _user_id: string }
        Returns: boolean
      }
      profile_details: {
        Args: { _ids: string[] }
        Returns: {
          details: Json
          user_id: string
        }[]
      }
      profile_locations: {
        Args: { _ids: string[] }
        Returns: {
          location: string
          location_visibility: Database["public"]["Enums"]["location_visibility"]
          user_id: string
        }[]
      }
      profile_stats: {
        Args: { _ids: string[] }
        Returns: {
          stats: Json
          user_id: string
        }[]
      }
      promote_exclusive_drops: { Args: { _user_id: string }; Returns: number }
      push_notify: {
        Args: {
          p_actor: string
          p_body: string
          p_entity_id: string
          p_entity_type: string
          p_link: string
          p_title: string
          p_type: string
          p_user: string
        }
        Returns: undefined
      }
      refresh_connection_suggestions: {
        Args: { _force?: boolean }
        Returns: number
      }
      refresh_stale_connection_suggestions: {
        Args: { _max_users?: number }
        Returns: number
      }
      run_exclusive_drop_maturation: {
        Args: never
        Returns: {
          lapsed: number
          promoted: number
        }[]
      }
      search_channels: {
        Args: { _limit?: number; _q?: string }
        Returns: {
          category_id: string
          category_name: string
          category_name_el: string
          category_name_en: string
          category_slug: string
          followers_count: number
          icon: string
          id: string
          name: string
          posts_count: number
          slug: string
        }[]
      }
      search_hashtags: {
        Args: { _limit?: number; _q?: string }
        Returns: {
          posts_count: number
          tag: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
      slang_tag_definitions: {
        Args: { _lang?: string; _tag_ids: string[] }
        Returns: {
          city: string
          country: string
          definition_id: string
          example: string
          lang: string
          latitude: number
          longitude: number
          meaning: string
          normalized_name: string
          place_detail: string
          region: string
          region_name: string
          source_language: string
          tag_id: string
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
      test_user_visible: { Args: { _owner: string }; Returns: boolean }
      touch_last_seen: { Args: never; Returns: string }
      track_slang_tag_click: {
        Args: { _conversion?: boolean; _tag_id: string }
        Returns: undefined
      }
      track_slang_tag_reach: { Args: { _tag_id: string }; Returns: undefined }
      trending_hashtags: {
        Args: { _days?: number; _limit?: number }
        Returns: {
          engagement: number
          posts_count: number
          recent_posts: number
          score: number
          tag: string
        }[]
      }
      upsert_slang_definition: {
        Args: { _example: string; _meaning: string; _tag_id: string }
        Returns: string
      }
      upsert_slang_geo: {
        Args: {
          _city: string
          _country: string
          _language: string
          _latitude: number
          _longitude: number
          _place_detail: string
          _region: string
          _tag_id: string
        }
        Returns: string
      }
      username_status: { Args: { _username: string }; Returns: string }
      username_variants: { Args: { _username: string }; Returns: string[] }
    }
    Enums: {
      ad_campaign_kind: "campaign" | "company_slang_tag" | "creator_slang_tag"
      ad_campaign_status: "draft" | "active" | "paused" | "ended" | "archived"
      app_role: "admin" | "user" | "creator" | "business" | "moderator"
      arena_challenge_status: "draft" | "active" | "judging" | "closed"
      channel_role: "owner" | "moderator"
      connection_status: "pending" | "accepted" | "declined"
      display_name_mode: "username" | "real_name" | "both"
      feedback_category:
        | "bug"
        | "improvement"
        | "design"
        | "performance"
        | "other"
      feedback_status: "new" | "in_progress" | "done" | "rejected"
      interest_category_kind:
        | "topic"
        | "region"
        | "language"
        | "style"
        | "other"
      interest_content_type: "post" | "slang_tag" | "profile" | "ad"
      location_visibility: "public" | "connections" | "private"
      market_delivery: "pickup" | "shipping" | "both"
      market_dispute_status: "open" | "in_review" | "resolved" | "rejected"
      market_fulfillment_type: "pickup" | "shipping"
      market_item_condition: "new" | "like_new" | "good" | "used"
      market_item_status:
        | "active"
        | "reserved"
        | "sold"
        | "disabled"
        | "deleted"
      market_offer_status: "open" | "accepted" | "declined" | "withdrawn"
      market_payment_status:
        | "unpaid"
        | "pending"
        | "paid"
        | "failed"
        | "refunded"
        | "partially_refunded"
        | "cancelled"
      market_promotion_status: "requested" | "active" | "expired" | "cancelled"
      market_promotion_type:
        | "standard"
        | "featured"
        | "channel_boost"
        | "local_boost"
      market_refund_status: "requested" | "processing" | "completed" | "failed"
      market_shipping_status:
        | "not_required"
        | "awaiting_shipment"
        | "shipped"
        | "delivered"
      market_transaction_status:
        | "pending"
        | "payment_pending"
        | "paid"
        | "processing"
        | "ready_for_pickup"
        | "shipped"
        | "completed"
        | "cancelled"
        | "refunded"
        | "disputed"
      moderation_action_kind:
        | "content_removed"
        | "content_hidden"
        | "slang_tag_hidden"
        | "market_item_removed"
        | "user_warned"
        | "user_banned"
        | "no_action"
      moderation_appeal_status:
        | "submitted"
        | "in_review"
        | "upheld"
        | "overturned"
        | "rejected"
      moderation_reason_code:
        | "rule_violation"
        | "illegal_content"
        | "spam"
        | "fraud"
        | "harassment"
        | "prohibited_market_item"
        | "other"
      moderation_status: "pending" | "approved" | "review" | "blocked"
      post_visibility: "public" | "connections" | "private" | "following"
      presence_status: "online" | "busy" | "offline"
      profile_visibility: "public" | "connections" | "private"
      report_status: "open" | "reviewing" | "resolved" | "dismissed"
      report_target_type:
        | "post"
        | "slang_tag"
        | "comment"
        | "profile"
        | "message"
        | "market_item"
        | "market_seller"
      reserved_username_category:
        | "system"
        | "staff"
        | "admin"
        | "support"
        | "moderation"
        | "official"
        | "brand"
        | "reserved"
        | "impersonation"
        | "inappropriate"
        | "other"
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
      ad_campaign_status: ["draft", "active", "paused", "ended", "archived"],
      app_role: ["admin", "user", "creator", "business", "moderator"],
      arena_challenge_status: ["draft", "active", "judging", "closed"],
      channel_role: ["owner", "moderator"],
      connection_status: ["pending", "accepted", "declined"],
      display_name_mode: ["username", "real_name", "both"],
      feedback_category: [
        "bug",
        "improvement",
        "design",
        "performance",
        "other",
      ],
      feedback_status: ["new", "in_progress", "done", "rejected"],
      interest_category_kind: ["topic", "region", "language", "style", "other"],
      interest_content_type: ["post", "slang_tag", "profile", "ad"],
      location_visibility: ["public", "connections", "private"],
      market_delivery: ["pickup", "shipping", "both"],
      market_dispute_status: ["open", "in_review", "resolved", "rejected"],
      market_fulfillment_type: ["pickup", "shipping"],
      market_item_condition: ["new", "like_new", "good", "used"],
      market_item_status: ["active", "reserved", "sold", "disabled", "deleted"],
      market_offer_status: ["open", "accepted", "declined", "withdrawn"],
      market_payment_status: [
        "unpaid",
        "pending",
        "paid",
        "failed",
        "refunded",
        "partially_refunded",
        "cancelled",
      ],
      market_promotion_status: ["requested", "active", "expired", "cancelled"],
      market_promotion_type: [
        "standard",
        "featured",
        "channel_boost",
        "local_boost",
      ],
      market_refund_status: ["requested", "processing", "completed", "failed"],
      market_shipping_status: [
        "not_required",
        "awaiting_shipment",
        "shipped",
        "delivered",
      ],
      market_transaction_status: [
        "pending",
        "payment_pending",
        "paid",
        "processing",
        "ready_for_pickup",
        "shipped",
        "completed",
        "cancelled",
        "refunded",
        "disputed",
      ],
      moderation_action_kind: [
        "content_removed",
        "content_hidden",
        "slang_tag_hidden",
        "market_item_removed",
        "user_warned",
        "user_banned",
        "no_action",
      ],
      moderation_appeal_status: [
        "submitted",
        "in_review",
        "upheld",
        "overturned",
        "rejected",
      ],
      moderation_reason_code: [
        "rule_violation",
        "illegal_content",
        "spam",
        "fraud",
        "harassment",
        "prohibited_market_item",
        "other",
      ],
      moderation_status: ["pending", "approved", "review", "blocked"],
      post_visibility: ["public", "connections", "private", "following"],
      presence_status: ["online", "busy", "offline"],
      profile_visibility: ["public", "connections", "private"],
      report_status: ["open", "reviewing", "resolved", "dismissed"],
      report_target_type: [
        "post",
        "slang_tag",
        "comment",
        "profile",
        "message",
        "market_item",
        "market_seller",
      ],
      reserved_username_category: [
        "system",
        "staff",
        "admin",
        "support",
        "moderation",
        "official",
        "brand",
        "reserved",
        "impersonation",
        "inappropriate",
        "other",
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
