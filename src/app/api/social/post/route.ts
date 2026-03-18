import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type DeletePostBody = {
  post_id?: string;
};

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => ({}))) as DeletePostBody;
  if (!body.post_id) {
    return NextResponse.json({ error: 'post_id is required.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: post, error: postError } = await supabase
    .from('feed_posts')
    .select('id, user_id')
    .eq('id', body.post_id)
    .single();

  if (postError || !post) {
    return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
  }
  if (post.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: fallbackRepliesDeleteError } = await supabase
    .from('feed_posts')
    .delete()
    .eq('content_type', 'reply')
    .eq('content->>parent_post_id', post.id);
  if (fallbackRepliesDeleteError) {
    return NextResponse.json({ error: fallbackRepliesDeleteError.message }, { status: 500 });
  }

  const { error: deleteError } = await supabase
    .from('feed_posts')
    .delete()
    .eq('id', post.id)
    .eq('user_id', user.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
