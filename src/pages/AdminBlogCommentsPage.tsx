import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { MessageCircle, ExternalLink, Trash2, ThumbsUp, RefreshCw, Pencil, Check, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CommentWithPost {
  id: string;
  author_name: string | null;
  content: string;
  created_at: string;
  likes: number;
  post_id: string;
  post_title?: string;
  post_slug?: string;
}

export default function AdminBlogCommentsPage() {
  const [comments, setComments] = useState<CommentWithPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchComments();
  }, []);

  const fetchComments = async () => {
    setLoading(true);
    
    const { data: commentsData, error: commentsError } = await supabase
      .from('blog_comments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (commentsError) {
      console.error('Error fetching comments:', commentsError);
      toast.error('Kunde inte hämta kommentarer');
      setLoading(false);
      return;
    }

    if (!commentsData || commentsData.length === 0) {
      setComments([]);
      setLoading(false);
      return;
    }

    const postIds = [...new Set(commentsData.map(c => c.post_id))];
    const { data: postsData, error: postsError } = await supabase
      .from('blog_posts')
      .select('id, title, slug')
      .in('id', postIds);

    if (postsError) {
      console.error('Error fetching posts:', postsError);
    }

    const postsMap = new Map(postsData?.map(p => [p.id, { title: p.title, slug: p.slug }]) || []);
    
    const commentsWithPosts: CommentWithPost[] = commentsData.map(comment => ({
      ...comment,
      post_title: postsMap.get(comment.post_id)?.title || 'Okänt inlägg',
      post_slug: postsMap.get(comment.post_id)?.slug
    }));

    setComments(commentsWithPosts);
    setLoading(false);
  };

  const handleDelete = async (commentId: string) => {
    setDeleting(commentId);
    
    const { error } = await supabase
      .from('blog_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('Error deleting comment:', error);
      toast.error('Kunde inte radera kommentaren');
    } else {
      toast.success('Kommentar raderad');
      setComments(prev => prev.filter(c => c.id !== commentId));
    }
    
    setDeleting(null);
  };

  const startEditing = (comment: CommentWithPost) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
    setEditAuthor(comment.author_name || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditContent('');
    setEditAuthor('');
  };

  const handleSave = async () => {
    if (!editingId || !editContent.trim()) return;
    
    setSaving(true);
    
    const { error } = await supabase
      .from('blog_comments')
      .update({ 
        content: editContent.trim(),
        author_name: editAuthor.trim() || null
      })
      .eq('id', editingId);

    if (error) {
      console.error('Error updating comment:', error);
      toast.error('Kunde inte uppdatera kommentaren');
    } else {
      toast.success('Kommentar uppdaterad');
      setComments(prev => prev.map(c => 
        c.id === editingId ? { ...c, content: editContent.trim(), author_name: editAuthor.trim() || null } : c
      ));
      setEditingId(null);
      setEditContent('');
      setEditAuthor('');
    }
    
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bloggkommentarer</h1>
          <p className="text-muted-foreground">
            {comments.length} {comments.length === 1 ? 'kommentar' : 'kommentarer'} totalt
          </p>
        </div>
        <Button variant="outline" onClick={fetchComments} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Uppdatera
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2 mb-4" />
                <div className="h-16 bg-muted rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Inga kommentarer ännu</h3>
            <p className="text-muted-foreground">
              När läsare kommenterar dina inlägg visas de här.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <Card key={comment.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {comment.author_name || 'Anonym'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), { 
                          addSuffix: true, 
                          locale: sv 
                        })}
                      </span>
                      {comment.likes > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <ThumbsUp className="h-3 w-3" />
                          {comment.likes}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>på</span>
                      {comment.post_slug ? (
                        <Link 
                          to={`/blogg/${comment.post_slug}`}
                          className="text-primary hover:underline flex items-center gap-1 truncate"
                          target="_blank"
                        >
                          {comment.post_title}
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </Link>
                      ) : (
                        <span className="truncate">{comment.post_title}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {editingId !== comment.id && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => startEditing(comment)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={deleting === comment.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Radera kommentar?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Är du säker på att du vill radera denna kommentar? Detta går inte att ångra.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Avbryt</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(comment.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Radera
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {editingId === comment.id ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-author">Författare</Label>
                      <Input
                        id="edit-author"
                        value={editAuthor}
                        onChange={(e) => setEditAuthor(e.target.value)}
                        placeholder="Anonym"
                        disabled={saving}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-content">Kommentar</Label>
                      <Textarea
                        id="edit-content"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[100px]"
                        disabled={saving}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        onClick={handleSave}
                        disabled={saving || !editContent.trim()}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Spara
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={cancelEditing}
                        disabled={saving}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Avbryt
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-lg">
                      {comment.content}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(comment.created_at), 'PPP HH:mm', { locale: sv })}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
