export type FeedReply = {
  id: string;
  post_id: string;
  user_id: string;
  parent_reply_id: string | null;
  content: string;
  created_at: string;
};

export type FeedPost = {
  id: string;
  user_id: string;
  content: unknown;
  content_type: string;
  created_at: string;
  likes_count?: number;
  comments_count?: number;
  replies?: FeedReply[];
};
