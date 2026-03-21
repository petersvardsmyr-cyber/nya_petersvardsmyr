import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Save, ArrowLeft, X, FileText, Upload, Eye, EyeOff, Sparkles, Loader2 } from 'lucide-react';

interface BlogPostData {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  meta_description: string;
  featured_image_url: string;
  image_caption: string;
  is_published: boolean;
  is_featured: boolean;
  tags: string[];
  author: string;
  published_date: string;
}

export default function AdminPostEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState<BlogPostData>({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    meta_description: '',
    featured_image_url: '',
    image_caption: '',
    is_published: false,
    is_featured: false,
    tags: [],
    author: 'Peter Svärdsmyr',
    published_date: new Date().toISOString().split('T')[0],
  });

  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState<'excerpt' | 'meta_description' | 'both' | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && id) {
      fetchPost(id);
    }
  }, [id, isEditing]);

  const fetchPost = async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (error) throw error;

      setFormData({
        title: data.title || '',
        slug: data.slug || '',
        excerpt: data.excerpt || '',
        content: data.content || '',
        meta_description: data.meta_description || '',
        featured_image_url: data.featured_image_url || '',
        image_caption: data.image_caption || '',
        is_published: data.is_published || false,
        is_featured: data.is_featured || false,
        tags: data.tags || [],
        author: data.author || 'Peter Svärdsmyr',
        published_date: data.published_date || new Date().toISOString().split('T')[0],
      });
    } catch (error) {
      toast({
        title: "Fel vid hämtning av inlägg",
        description: "Kunde inte hämta inlägget.",
        variant: "destructive",
      });
      navigate('/admin');
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/å/g, 'a')
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({
      ...prev,
      title,
      slug: generateSlug(title),
    }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  };

  const generateWithAI = async (type: 'excerpt' | 'meta_description' | 'both') => {
    if (!formData.content || !formData.title) {
      toast({
        title: "Innehåll krävs",
        description: "Skriv titel och innehåll innan du genererar med AI.",
        variant: "destructive",
      });
      return;
    }

    setAiLoading(type);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Inte inloggad", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-blog-meta', {
        body: {
          content: formData.content,
          title: formData.title,
          type,
        },
      });

      if (error) throw error;

      if (data.excerpt !== undefined) {
        setFormData(prev => ({ ...prev, excerpt: data.excerpt }));
      }
      if (data.meta_description !== undefined) {
        setFormData(prev => ({ ...prev, meta_description: data.meta_description }));
      }

      toast({
        title: "AI-text genererad",
        description: type === 'both'
          ? "Sammanfattning och meta-beskrivning har genererats."
          : type === 'excerpt'
            ? "Sammanfattning har genererats."
            : "Meta-beskrivning har genererats.",
      });
    } catch (error: any) {
      console.error('AI generation error:', error);
      toast({
        title: "Fel vid AI-generering",
        description: error.message || "Kunde inte generera text.",
        variant: "destructive",
      });
    } finally {
      setAiLoading(null);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Bilden är för stor",
          description: "Max storlek är 10MB.",
          variant: "destructive",
        });
        return;
      }

      try {
        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('blog-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('blog-images')
          .getPublicUrl(filePath);

        setFormData(prev => ({ ...prev, featured_image_url: publicUrl }));
        
        toast({
          title: "Bild uppladdad",
          description: "Bilden har sparats till Storage.",
        });
      } catch (error: any) {
        toast({
          title: "Fel vid uppladdning",
          description: error.message || "Kunde inte ladda upp bilden.",
          variant: "destructive",
        });
      }
    }
  };

  const sendBlogNotification = async (postId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase.functions.invoke('send-blog-notification', {
        body: {
          post_id: postId,
          title: formData.title,
          excerpt: formData.excerpt,
          slug: formData.slug,
        },
      });

      if (error) {
        console.error('Failed to send blog notification:', error);
      } else {
        console.log('Blog notification sent successfully');
      }
    } catch (err) {
      console.error('Error sending blog notification:', err);
    }
  };

  const handlePublish = async () => {
    setLoading(true);

    try {
      const publishData = {
        ...formData,
        is_published: true,
      };

      // Check if this is a new publication (not already published)
      const wasPublished = isEditing ? formData.is_published : false;

      if (isEditing && id) {
        // Fetch current state to check if already published
        const { data: currentPost } = await supabase
          .from('blog_posts')
          .select('is_published')
          .eq('id', id)
          .single();

        const { error } = await supabase
          .from('blog_posts')
          .update({
            ...publishData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (error) throw error;

        // Send notification only if post wasn't already published
        if (!currentPost?.is_published) {
          await sendBlogNotification(id);
          toast({
            title: "Inlägg publicerat",
            description: "Blogginlägget har publicerats och prenumeranter har notifierats.",
          });
        } else {
          toast({
            title: "Inlägg uppdaterat",
            description: "Blogginlägget har uppdaterats.",
          });
        }
      } else {
        const { data: newPost, error } = await supabase
          .from('blog_posts')
          .insert([publishData])
          .select('id')
          .single();

        if (error) throw error;

        // Send notification for new published post
        if (newPost) {
          await sendBlogNotification(newPost.id);
        }

        toast({
          title: "Inlägg publicerat",
          description: "Blogginlägget har skapats och prenumeranter har notifierats.",
        });
      }

      navigate('/admin/posts');
    } catch (error: any) {
      toast({
        title: "Fel vid publicering",
        description: error.message || "Kunde inte publicera inlägget.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsDraft = async () => {
    setLoading(true);

    try {
      const draftData = {
        ...formData,
        is_published: false,
      };

      if (isEditing && id) {
        const { error } = await supabase
          .from('blog_posts')
          .update({
            ...draftData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (error) throw error;

        toast({
          title: "Utkast sparat",
          description: "Inlägget har sparats som utkast.",
        });
      } else {
        const { error } = await supabase
          .from('blog_posts')
          .insert([draftData]);

        if (error) throw error;

        toast({
          title: "Utkast sparat",
          description: "Inlägget har sparats som utkast.",
        });
      }

      navigate('/admin/posts');
    } catch (error: any) {
      toast({
        title: "Fel vid sparande",
        description: error.message || "Kunde inte spara utkastet.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnpublish = async () => {
    setLoading(true);

    try {
      const { error } = await supabase
        .from('blog_posts')
        .update({
          is_published: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Inlägg avpublicerat",
        description: "Inlägget är nu dolt från publiken.",
      });

      navigate('/admin/posts');
    } catch (error: any) {
      toast({
        title: "Fel vid avpublicering",
        description: error.message || "Kunde inte avpublicera inlägget.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/admin')}
          className="self-start sm:self-auto"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Tillbaka
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold flex-1">
          {isEditing ? 'Redigera inlägg' : 'Nytt blogginlägg'}
        </h1>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
            <Card>
              <CardHeader>
                <CardTitle>Innehåll</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Titel *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    required
                    placeholder="Titel på blogginlägget"
                  />
                </div>

                <div>
                  <Label htmlFor="slug">URL-slug</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="url-slug-for-inlagget"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="excerpt">Sammanfattning</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => generateWithAI('excerpt')}
                      disabled={aiLoading !== null || !formData.content || !formData.title}
                      className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    >
                      {aiLoading === 'excerpt' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      Generera med AI
                    </Button>
                  </div>
                  <Textarea
                    id="excerpt"
                    value={formData.excerpt}
                    onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                    placeholder="Kort sammanfattning av inlägget"
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Innehåll *</Label>
                  <RichTextEditor
                    content={formData.content}
                    onChange={(content) => setFormData(prev => ({ ...prev, content }))}
                    placeholder="Skriv ditt blogginlägg här..."
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6 order-1 lg:order-2">
            <Card>
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="is_featured">Utvalt inlägg</Label>
                    <p className="text-xs text-muted-foreground">
                      Visas överst på startsidan
                    </p>
                  </div>
                  <Switch
                    id="is_featured"
                    checked={formData.is_featured}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_featured: checked }))}
                  />
                </div>

                <div>
                  <Label htmlFor="published_date">Publiceringsdatum</Label>
                  <Input
                    id="published_date"
                    type="date"
                    value={formData.published_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, published_date: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="author">Författare</Label>
                  <Input
                    id="author"
                    value={formData.author}
                    onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SEO & Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="meta_description">Meta-beskrivning</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => generateWithAI('meta_description')}
                      disabled={aiLoading !== null || !formData.content || !formData.title}
                      className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    >
                      {aiLoading === 'meta_description' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      Generera med AI
                    </Button>
                  </div>
                  <Textarea
                    id="meta_description"
                    value={formData.meta_description}
                    onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                    placeholder="Beskrivning för sökmotorer (max 160 tecken)"
                    rows={3}
                    maxLength={160}
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    {formData.meta_description.length}/160 tecken
                  </div>
                </div>

                <div>
                  <Label htmlFor="featured_image">Utvald bild</Label>
                  <div className="flex gap-2">
                    <Input
                      id="featured_image"
                      value={formData.featured_image_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, featured_image_url: e.target.value }))}
                      placeholder="https://exempel.se/bild.jpg"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      title="Ladda upp bild"
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                  {formData.featured_image_url && (
                    <>
                      <div className="mt-3">
                        <Label className="text-sm text-muted-foreground">Förhandsvisning</Label>
                        <div className="mt-2 border rounded-lg overflow-hidden bg-muted/30">
                          <img
                            src={formData.featured_image_url}
                            alt="Förhandsvisning av bild"
                            className="w-full h-48 object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.classList.add('hidden');
                              const errorDiv = target.nextElementSibling as HTMLDivElement;
                              if (errorDiv) errorDiv.classList.remove('hidden');
                            }}
                            onLoad={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.classList.remove('hidden');
                              const errorDiv = target.nextElementSibling as HTMLDivElement;
                              if (errorDiv) errorDiv.classList.add('hidden');
                            }}
                          />
                          <div className="w-full h-48 hidden flex items-center justify-center text-muted-foreground bg-muted/50">
                            <div className="text-center">
                              <p className="text-sm">Kunde inte ladda bilden</p>
                              <p className="text-xs">Kontrollera att URL:en är korrekt</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <Label htmlFor="image_caption">Bildtext</Label>
                        <Input
                          id="image_caption"
                          value={formData.image_caption}
                          onChange={(e) => setFormData(prev => ({ ...prev, image_caption: e.target.value }))}
                          placeholder="Beskrivning som visas under bilden (valfritt)"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <Label>Taggar</Label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Lägg till tagg"
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    />
                    <Button type="button" onClick={addTag} size="sm">
                      Lägg till
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {formData.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {isEditing && formData.is_published ? (
                <>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={handlePublish}
                    disabled={loading || !formData.title || !formData.content}
                  >
                    {loading ? (
                      'Sparar...'
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Uppdatera publicerat inlägg
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleUnpublish}
                    disabled={loading}
                  >
                    <EyeOff className="mr-2 h-4 w-4" />
                    Avpublicera inlägg
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={handlePublish}
                    disabled={loading || !formData.title || !formData.content}
                  >
                    {loading ? (
                      'Publicerar...'
                    ) : (
                      <>
                        <Eye className="mr-2 h-4 w-4" />
                        {isEditing ? 'Uppdatera och publicera' : 'Publicera inlägg'}
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleSaveAsDraft}
                    disabled={loading || !formData.title || !formData.content}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {isEditing ? 'Spara som utkast' : 'Spara som utkast'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}