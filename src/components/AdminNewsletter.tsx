import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/RichTextEditor';
import { toast } from 'sonner';
import { Users, Send, Mail, Save, Trash2, FileText, Plus } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { useLocation } from 'react-router-dom';

export function AdminNewsletter() {
  console.log('AdminNewsletter component rendering');
  
  const location = useLocation();
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [showSubscribers, setShowSubscribers] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [showDrafts, setShowDrafts] = useState(true);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ sent: number; total: number; status: string } | null>(null);
  const [newsletterStatus, setNewsletterStatus] = useState<{ remaining: number; already_sent: number; total: number } | null>(null);

  // Load newsletter from navigation state if present
  useEffect(() => {
    if (location.state?.subject && location.state?.content) {
      setSubject(location.state.subject);
      setContent(location.state.content);
      toast.info('Nyhetsbrev laddat för att fortsätta skicka');
    }
  }, [location.state]);

  // Load drafts and subscribers on mount
  useEffect(() => {
    loadDrafts();
    loadSubscribers();
  }, []);

  // Check newsletter status when subject changes
  useEffect(() => {
    checkNewsletterStatus();
  }, [subject]);

  const checkNewsletterStatus = async () => {
    if (!subject.trim()) return;

    try {
      const { data: lastNewsletter } = await supabase
        .from('sent_newsletters')
        .select('id')
        .eq('subject', subject)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { count: totalSubscribers } = await supabase
        .from('newsletter_subscribers')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (lastNewsletter) {
        const { data: recipients } = await supabase
          .from('newsletter_recipients')
          .select('subscriber_email')
          .eq('sent_newsletter_id', lastNewsletter.id);

        const alreadySent = recipients?.length || 0;
        const remaining = (totalSubscribers || 0) - alreadySent;

        // Only show status if we have tracking data (recipients exist)
        if (alreadySent > 0) {
          setNewsletterStatus({
            remaining,
            already_sent: alreadySent,
            total: totalSubscribers || 0
          });
        } else {
          setNewsletterStatus(null);
        }
      } else {
        setNewsletterStatus(null);
      }
    } catch (error) {
      console.error('Error checking newsletter status:', error);
    }
  };

  const loadSubscribers = async () => {
    try {
      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .select('*')
        .eq('subscription_type', 'newsletter')
        .order('subscribed_at', { ascending: false });

      if (error) throw error;
      setSubscribers(data || []);
      setShowSubscribers(true);
    } catch (error: any) {
      console.error('Error loading subscribers:', error);
      toast.error('Kunde inte ladda prenumeranter');
    }
  };

  const loadDrafts = async () => {
    try {
      const { data, error } = await supabase
        .from('newsletter_drafts')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setDrafts(data || []);
      setShowDrafts(true);
    } catch (error: any) {
      console.error('Error loading drafts:', error);
      toast.error('Kunde inte ladda utkast');
    }
  };

  const saveDraft = async () => {
    if (!subject.trim() && !content.trim()) {
      toast.error('Ämne eller innehåll krävs för att spara utkast');
      return;
    }

    setIsLoading(true);
    try {
      if (currentDraftId) {
        // Update existing draft
        const { error } = await supabase
          .from('newsletter_drafts')
          .update({ subject: subject.trim(), content: content.trim() })
          .eq('id', currentDraftId);

        if (error) throw error;
        toast.success('Utkast uppdaterat!');
      } else {
        // Create new draft
        const { data, error } = await supabase
          .from('newsletter_drafts')
          .insert({ subject: subject.trim(), content: content.trim() })
          .select()
          .single();

        if (error) throw error;
        setCurrentDraftId(data.id);
        toast.success('Utkast sparat!');
      }
      
      await loadDrafts();
    } catch (error: any) {
      console.error('Error saving draft:', error);
      toast.error('Kunde inte spara utkast');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDraft = (draft: any) => {
    setSubject(draft.subject);
    setContent(draft.content);
    setCurrentDraftId(draft.id);
    toast.success('Utkast laddat!');
  };

  const deleteDraft = async (draftId: string) => {
    try {
      const { error } = await supabase
        .from('newsletter_drafts')
        .delete()
        .eq('id', draftId);

      if (error) throw error;

      if (currentDraftId === draftId) {
        setSubject('');
        setContent('');
        setCurrentDraftId(null);
      }

      await loadDrafts();
      toast.success('Utkast raderat!');
    } catch (error: any) {
      console.error('Error deleting draft:', error);
      toast.error('Kunde inte radera utkast');
    } finally {
      setDraftToDelete(null);
    }
  };

  const newDraft = () => {
    setSubject('');
    setContent('');
    setCurrentDraftId(null);
  };

  const sendNewsletter = async () => {
    console.log('[Newsletter] Send start', { hasSubject: !!subject.trim(), hasContent: !!content.trim() });

    if (!subject.trim() || !content.trim()) {
      toast.error('Både ämne och innehåll krävs');
      return;
    }

    setIsLoading(true);
    setSendProgress({ sent: 0, total: 0, status: 'starting' });

    try {
      const payload = { 
        subject: subject.trim(), 
        content: content.trim(), 
        from: "Peter Svärdsmyr <hej@petersvardsmyr.se>"
      };

      const { data, error } = await supabase.functions.invoke('newsletter', { body: payload });

      if (error) throw error;

      console.log('[Newsletter] Send response', data);
      
      const runId = (data as any)?.run_id;
      const remaining = (data as any)?.remaining || 0;
      const alreadySent = (data as any)?.already_sent || 0;
      const totalSubs = (data as any)?.total_subscribers || 0;
      const successful = (data as any)?.successful || 0;

      // Update newsletter status
      setNewsletterStatus({
        remaining,
        already_sent: alreadySent + successful,
        total: totalSubs
      });
      
      if (runId) {
        // Subscribe to database changes for progress updates
        const channel = supabase
          .channel(`newsletter-progress-${runId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'newsletter_send_status',
              filter: `run_id=eq.${runId}`
            },
            (payload) => {
              console.log('Progress update from DB:', payload);
              const newData = payload.new as any;
              setSendProgress({
                sent: newData.sent,
                total: newData.total,
                status: newData.status
              });
              
              if (newData.status === 'completed') {
                setTimeout(() => {
                  supabase.removeChannel(channel);
                  setSendProgress(null);
                }, 3000);
              }
            }
          )
          .subscribe();
      }

      const message = remaining > 0 
        ? `Nyhetsbrev skickat till ${successful} prenumeranter. ${remaining} återstår att skicka till.`
        : `Nyhetsbrev skickat till ${successful} prenumeranter. Alla har nu fått mejlet!`;

      toast.success('Nyhetsbrev skickat!', {
        description: message
      });

      // Don't clear form if there are more to send
      if (remaining === 0) {
        setSubject('');
        setContent('');
        setCurrentDraftId(null);
        setNewsletterStatus(null);
      }

      // Refresh status
      await checkNewsletterStatus();
    } catch (error: any) {
      console.error('Newsletter send error:', error);
      toast.error('Kunde inte skicka nyhetsbrev', {
        description: error?.message || 'Ett oväntat fel uppstod'
      });
      setSendProgress(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-heading font-medium">Nyhetsbrev</h2>
        <p className="text-muted-foreground">
          {subscribers.filter(s => s.is_active && s.confirmed_at).length} bekräftade prenumeranter
        </p>
      </div>

      {/* Drafts List */}
      {showDrafts && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Sparade utkast ({drafts.length})
                </CardTitle>
                <CardDescription>
                  Dina sparade nyhetsbrevsutkast
                </CardDescription>
              </div>
              <Button onClick={newDraft} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Nytt utkast
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {drafts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Inga utkast sparade ännu</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {drafts.map((draft) => (
                  <div 
                    key={draft.id} 
                    className={`flex items-center justify-between p-3 border rounded hover:bg-muted/50 transition-colors cursor-pointer ${currentDraftId === draft.id ? 'bg-muted border-primary' : ''}`}
                  >
                    <div className="flex-1" onClick={() => loadDraft(draft)}>
                      <p className="font-medium">{draft.subject || 'Utan ämne'}</p>
                      <p className="text-sm text-muted-foreground">
                        Senast uppdaterad: {new Date(draft.updated_at).toLocaleString('sv-SE')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDraftToDelete(draft.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Subscribers List */}
      {showSubscribers && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Prenumeranter ({subscribers.length})
            </CardTitle>
            <CardDescription>
              Lista över alla registrerade prenumeranter
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {subscribers.map((subscriber) => (
                <div key={subscriber.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <p className="font-medium">{subscriber.name || 'Ej angivet'}</p>
                    <p className="text-sm text-muted-foreground">{subscriber.email}</p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(subscriber.subscribed_at).toLocaleDateString('sv-SE')}
                    {!subscriber.is_active && (
                      <span className="ml-2 text-red-500">(Inaktiv)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Send Newsletter */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                {currentDraftId ? 'Redigera utkast' : 'Skapa nyhetsbrev'}
              </CardTitle>
              <CardDescription>
                Komponera och skicka ett nyhetsbrev till alla aktiva prenumeranter
              </CardDescription>
            </div>
            {currentDraftId && (
              <Button onClick={newDraft} variant="outline" size="sm">
                Rensa formulär
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); sendNewsletter(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Ämne</Label>
              <Input
                id="subject"
                type="text"
                placeholder="Ämnesrad för nyhetsbrevet"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="content">Innehåll</Label>
                <RichTextEditor
                  content={content}
                  onChange={setContent}
                  placeholder="Skriv innehållet för ditt nyhetsbrev här. Använd verktygsfältet för formatering och lägg till bilder."
                />
              </div>
              
              <div className="space-y-2">
                <Label>Förhandsgranskning</Label>
                <div className="border border-input rounded-md bg-muted/30 p-4 min-h-[300px] max-h-[500px] overflow-y-auto">
                  <style>
                    {`@import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');`}
                  </style>
                  <div 
                    style={{ 
                      fontFamily: "'Crimson Text', Georgia, serif", 
                      maxWidth: '600px', 
                      margin: '0 auto',
                      color: '#000000'
                    }}
                  >
                    {subject && (
                      <div style={{ marginBottom: '20px', paddingBottom: '10px', borderBottom: '2px solid #eee' }}>
                        <p style={{ fontSize: '14px', color: '#666', margin: '0 0 5px 0' }}>Ämne:</p>
                        <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#000' }}>{subject}</h2>
                      </div>
                    )}
                    <div 
                      dangerouslySetInnerHTML={{ __html: content || '<p style="color: #999;">Inget innehåll än...</p>' }}
                      style={{
                        fontSize: '16px',
                        lineHeight: '1.6',
                        color: '#000000'
                      }}
                      className="[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:text-black [&_h1]:font-['Playfair_Display',Georgia,serif] [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-black [&_h2]:font-['Playfair_Display',Georgia,serif] [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-black [&_h3]:font-['Playfair_Display',Georgia,serif] [&_p]:text-base [&_p]:leading-relaxed [&_p]:mb-3 [&_p]:text-black [&_p]:font-['Crimson_Text',Georgia,serif] [&_strong]:font-bold [&_strong]:text-black [&_em]:italic [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:my-2 [&_ul]:font-['Crimson_Text',Georgia,serif] [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:my-2 [&_ol]:font-['Crimson_Text',Georgia,serif] [&_blockquote]:border-l-4 [&_blockquote]:border-gray-400 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4 [&_blockquote]:font-['Crimson_Text',Georgia,serif] [&_a]:text-blue-600 [&_a]:underline [&_img]:max-w-full [&_img]:h-auto [&_img]:my-4"
                    />
                    <hr style={{ margin: '30px 0', border: 'none', borderTop: '1px solid #eee' }} />
                    <footer style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '8px', marginTop: '30px' }}>
                      <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                        <a href="https://petersvardsmyr.se" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '500' }}>
                          petersvardsmyr.se
                        </a>
                      </div>
                      <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                        <a href="mailto:hej@petersvardsmyr.se" style={{ color: '#666', textDecoration: 'none' }}>
                          hej@petersvardsmyr.se
                        </a>
                      </div>
                      <hr style={{ margin: '15px 0', border: 'none', borderTop: '1px solid #ddd' }} />
                      <p style={{ fontSize: '12px', color: '#666', textAlign: 'center', margin: '10px 0' }}>
                        Du får detta e-postmeddelande eftersom du prenumererar på vårt nyhetsbrev.
                      </p>
                      <p style={{ fontSize: '12px', textAlign: 'center', margin: '10px 0' }}>
                        <a href="#" style={{ color: '#666', textDecoration: 'underline' }}>
                          Avregistrera dig här
                        </a>
                      </p>
                    </footer>
                  </div>
                </div>
              </div>
            </div>

            {newsletterStatus && newsletterStatus.already_sent > 0 && (
              <div className="p-4 border rounded-md bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Status för detta nyhetsbrev:</span>
                </div>
                <div className="space-y-1 text-sm">
                  <p>✓ {newsletterStatus.already_sent} av {newsletterStatus.total} har fått mejlet</p>
                  {newsletterStatus.remaining > 0 && (
                    <p className="text-blue-600 dark:text-blue-400 font-medium">
                      {newsletterStatus.remaining} återstår att skicka till
                    </p>
                  )}
                </div>
                {newsletterStatus.remaining === 0 && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                    ✓ Alla prenumeranter har fått detta nyhetsbrev!
                  </p>
                )}
              </div>
            )}

            {sendProgress && (
              <div className="space-y-2 mb-4 p-4 border rounded-md bg-muted/30">
                <div className="flex justify-between text-sm font-medium">
                  <span>Skickar nyhetsbrev...</span>
                  <span>{sendProgress.sent} / {sendProgress.total}</span>
                </div>
                <Progress value={(sendProgress.sent / sendProgress.total) * 100} />
                {sendProgress.status === 'completed' && (
                  <p className="text-sm text-green-600 text-center">
                    ✓ Nyhetsbrevet har skickats!
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                type="button"
                onClick={saveDraft}
                disabled={isLoading}
                variant="outline"
                className="flex-1"
              >
                <Save className="w-4 h-4 mr-2" />
                {currentDraftId ? 'Uppdatera utkast' : 'Spara som utkast'}
              </Button>
              <Button
                type="button"
                onClick={() => setShowSendConfirm(true)}
                disabled={isLoading}
                className="flex-1"
              >
                <Mail className="w-4 h-4 mr-2" />
                {isLoading
                  ? 'Skickar...'
                  : newsletterStatus && newsletterStatus.remaining > 0
                    ? `Skicka till nästa ${Math.min(40, newsletterStatus.remaining)} prenumeranter`
                    : `Skicka till max 40 av ${subscribers.filter(s => s.is_active && s.confirmed_at && s.subscription_type === 'newsletter').length} prenumeranter`}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Send Confirmation Dialog */}
      <AlertDialog open={showSendConfirm} onOpenChange={setShowSendConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skicka nyhetsbrev?</AlertDialogTitle>
            <AlertDialogDescription>
              {newsletterStatus && newsletterStatus.remaining > 0
                ? `Nästa ${Math.min(40, newsletterStatus.remaining)} av ${newsletterStatus.remaining} återstående prenumeranter kommer att få mejlet med ämnet "${subject}".`
                : `Upp till 40 av ${subscribers.filter(s => s.is_active && s.confirmed_at && s.subscription_type === 'newsletter').length} bekräftade prenumeranter kommer att få mejlet med ämnet "${subject}".`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowSendConfirm(false); sendNewsletter(); }}>
              <Mail className="w-4 h-4 mr-2" />
              Skicka
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!draftToDelete} onOpenChange={(open) => !open && setDraftToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Radera utkast?</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill radera detta utkast? Denna åtgärd kan inte ångras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={() => draftToDelete && deleteDraft(draftToDelete)}>
              Radera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}