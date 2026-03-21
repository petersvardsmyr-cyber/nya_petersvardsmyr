import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { sanitizeHtml } from "@/lib/sanitize";
import { ShareButton } from "@/components/ShareButton";
import BlogComments from "@/components/BlogComments";
import BlogSubscribe from "@/components/BlogSubscribe";

interface BlogPost {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  slug: string;
  published_date: string;
  featured_image_url?: string;
  image_caption?: string;
  author: string;
  tags?: string[];
}

const BlogPost = () => {
  const { slug } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchPost = async () => {
      if (!slug) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('blog_posts')
          .select('*')
          .eq('slug', slug)
          .eq('is_published', true)
          .single();

        if (error || !data) {
          console.error('Error fetching post:', error);
          setNotFound(true);
          return;
        }

        setPost(data);
      } catch (err) {
        console.error('Fetch error:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-12 py-20">
        <Skeleton className="h-8 w-24 mb-6" />
        <Skeleton className="h-12 w-3/4 mb-6" />
        <Skeleton className="h-4 w-48 mb-8" />
        <div className="aspect-video mb-8">
          <Skeleton className="w-full h-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="max-w-4xl mx-auto px-12 py-20 text-center">
        <h1 className="text-4xl font-heading font-medium mb-6 text-foreground">
          Inlägget kunde inte hittas
        </h1>
        <p className="text-muted-foreground mb-8">
          Det verkar som att det inlägg du letar efter inte finns.
        </p>
        <Button asChild>
          <Link to="/blogg">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Tillbaka till bloggen
          </Link>
        </Button>
      </div>
    );
  }

  // Sanitize HTML content from Tiptap editor
  const sanitizedContent = sanitizeHtml(post.content);

  // Build absolute URLs for social media
  const baseUrl = window.location.origin;
  const pageUrl = `${baseUrl}/blogg/${post.slug}`;
  
  // Make OG image absolute
  let ogImage = `${baseUrl}/peter-profile.jpg`;
  if (post.featured_image_url) {
    // If it's a data URL or already absolute, use as is
    if (post.featured_image_url.startsWith('data:') || post.featured_image_url.startsWith('http')) {
      ogImage = post.featured_image_url;
    } else {
      // Make relative URLs absolute
      ogImage = `${baseUrl}${post.featured_image_url}`;
    }
  }

  return (
    <>
      <Helmet>
        <title>{post.title} | Peter Svärdsmyr</title>
        <meta name="description" content={post.excerpt} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.excerpt} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="article:published_time" content={post.published_date} />
        <meta property="article:author" content={post.author} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={post.excerpt} />
        <meta name="twitter:image" content={ogImage} />
      </Helmet>
      
      <article className="max-w-4xl mx-auto px-12 py-20">
        <Button variant="ghost" asChild className="mb-6">
        <Link to="/blogg">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Tillbaka till bloggen
        </Link>
      </Button>

      <header className="mb-12">
        <h1 className="text-4xl md:text-5xl font-heading font-medium mb-6 text-foreground leading-tight">
          {post.title}
        </h1>
        
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
            <time className="text-sm">
              {new Date(post.published_date).toLocaleDateString('sv-SE', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </time>
            <span>•</span>
            <span className="text-sm">{post.author}</span>
          </div>
          <ShareButton 
            title={post.title}
            text={post.excerpt}
            url={pageUrl}
          />
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {post.tags.map((tag) => (
              <Link key={tag} to={`/blogg/tag/${encodeURIComponent(tag)}`}>
                <Badge 
                  variant="secondary"
                  className="hover:bg-accent/20 cursor-pointer transition-colors"
                >
                  {tag}
                </Badge>
              </Link>
            ))}
          </div>
        )}

        {post.featured_image_url && (
          <figure className="mb-8">
            <div className="aspect-video overflow-hidden rounded-lg">
              <img 
                src={post.featured_image_url} 
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
            {post.image_caption && (
              <figcaption className="text-center text-sm text-muted-foreground mt-3 italic">
                {post.image_caption}
              </figcaption>
            )}
          </figure>
        )}
      </header>

      <div 
        className="prose max-w-none [&_p]:text-foreground [&_strong]:text-foreground [&_strong]:font-bold [&_em]:text-foreground [&_em]:italic [&_img]:my-4 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4 [&_blockquote]:text-foreground [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_h4]:text-foreground"
        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
      />

      <BlogComments postId={post.id} postTitle={post.title} postSlug={post.slug} />

      <BlogSubscribe />

      <footer className="mt-12 pt-8 border-t border-border">
        <div className="flex flex-col items-center gap-6">
          <div className="text-sm text-muted-foreground">
            Publicerad {new Date(post.published_date).toLocaleDateString('sv-SE')}
          </div>
          
          <ShareButton 
            title={post.title}
            text={post.excerpt}
            url={pageUrl}
          />
          
          <Button variant="outline" asChild>
            <Link to="/blogg">Läs fler inlägg</Link>
          </Button>
        </div>
      </footer>
    </article>
    </>
  );
};

export default BlogPost;