import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Users, Mail, Pencil, Trash2, Search } from 'lucide-react';

interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  is_active: boolean;
  subscribed_at: string;
  unsubscribed_at: string | null;
  confirmed_at: string | null;
}

interface AdminSubscribersSharedProps {
  subscriptionType: 'newsletter' | 'blog';
}

export function AdminSubscribersShared({ subscriptionType }: AdminSubscribersSharedProps) {
  const isNewsletter = subscriptionType === 'newsletter';
  const label = isNewsletter ? 'nyhetsbrevsprenumerant' : 'bloggprenumerant';
  const labelPlural = isNewsletter ? 'nyhetsbrevsprenumeranter' : 'bloggprenumeranter';

  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', is_active: true });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);

  const loadSubscribers = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .select('*')
        .eq('subscription_type', subscriptionType)
        .order('subscribed_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setSubscribers(data || []);
    } catch (error: any) {
      console.error(`Error loading ${labelPlural}:`, error);
      toast.error(`Kunde inte ladda ${labelPlural}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubscribers();
  }, [subscriptionType]);

  const filteredSubscribers = subscribers.filter(s =>
    !searchQuery.trim() ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAdd = () => {
    setIsAddMode(true);
    setEditingSubscriber(null);
    setEditForm({ name: '', email: '', is_active: true });
    setIsDialogOpen(true);
  };

  const handleEdit = (subscriber: Subscriber) => {
    setIsAddMode(false);
    setEditingSubscriber(subscriber);
    setEditForm({
      name: subscriber.name || '',
      email: subscriber.email,
      is_active: subscriber.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editForm.email) {
      toast.error('E-postadress krävs');
      return;
    }

    try {
      if (isAddMode) {
        const { error } = await supabase
          .from('newsletter_subscribers')
          .insert([{
            email: editForm.email,
            name: editForm.name || null,
            is_active: editForm.is_active,
            confirmed_at: new Date().toISOString(),
            confirmation_token: null,
            subscription_type: subscriptionType,
          }]);

        if (error) throw error;
        toast.success(`${label.charAt(0).toUpperCase() + label.slice(1)} tillagd`);
      } else {
        if (!editingSubscriber) return;

        const { error } = await supabase
          .from('newsletter_subscribers')
          .update({
            name: editForm.name || null,
            email: editForm.email,
            is_active: editForm.is_active,
          })
          .eq('id', editingSubscriber.id);

        if (error) throw error;
        toast.success(`${label.charAt(0).toUpperCase() + label.slice(1)} uppdaterad`);
      }

      setIsDialogOpen(false);
      loadSubscribers();
    } catch (error: any) {
      console.error('Error saving subscriber:', error);
      toast.error(isAddMode ? `Kunde inte lägga till ${label}` : `Kunde inte uppdatera ${label}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Är du säker på att du vill ta bort denna ${label}?`)) return;

    try {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Prenumerant borttagen');
      loadSubscribers();
    } catch (error: any) {
      console.error('Error deleting subscriber:', error);
      toast.error('Kunde inte ta bort prenumerant');
    }
  };

  const handleResendConfirmation = async (email: string) => {
    try {
      const { error } = await supabase.functions.invoke('send-confirmation-email', {
        body: { email },
      });
      if (error) throw error;
      toast.success('Bekräftelsemail skickat', {
        description: `Ett nytt bekräftelsemail har skickats till ${email}`,
      });
    } catch (error: any) {
      console.error('Error sending confirmation:', error);
      toast.error('Kunde inte skicka bekräftelsemail');
    }
  };

  const activeCount = subscribers.filter(s => s.is_active).length;
  const confirmedActiveCount = subscribers.filter(s => s.is_active && s.confirmed_at).length;
  const pendingCount = subscribers.filter(s => s.is_active && !s.confirmed_at).length;
  const inactiveCount = subscribers.filter(s => !s.is_active).length;

  return (
    <div className="space-y-6">
      {/* Statistikkort */}
      <div className={`grid gap-4 ${isNewsletter ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totalt</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscribers.length}</div>
          </CardContent>
        </Card>

        {isNewsletter ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bekräftade & aktiva</CardTitle>
                <Users className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{confirmedActiveCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Får nyhetsbrev</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Väntar på bekräftelse</CardTitle>
                <Mail className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingCount}</div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aktiva</CardTitle>
              <Users className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeCount}</div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isNewsletter ? 'Avregistrerade' : 'Inaktiva'}</CardTitle>
            <Users className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inactiveCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{isNewsletter ? 'Prenumeranter' : 'Bloggprenumeranter'}</CardTitle>
              <CardDescription>
                {isNewsletter
                  ? 'Hantera alla dina nyhetsbrevsprenumeranter'
                  : 'Personer som får notiser om nya blogginlägg'}
              </CardDescription>
            </div>
            <Button onClick={handleAdd}>
              Lägg till {label}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Sökfält */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Sök på e-post eller namn..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Laddar prenumeranter...</p>
          ) : filteredSubscribers.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'Inga träffar för sökningen' : `Inga ${labelPlural} ännu`}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Namn</TableHead>
                  <TableHead>E-post</TableHead>
                  {isNewsletter && <TableHead>Bekräftad</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead>Prenumererad</TableHead>
                  {isNewsletter && <TableHead>Avregistrerad</TableHead>}
                  <TableHead className="text-right">Åtgärder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubscribers.map((subscriber) => (
                  <TableRow key={subscriber.id}>
                    <TableCell>{subscriber.name || '-'}</TableCell>
                    <TableCell>{subscriber.email}</TableCell>
                    {isNewsletter && (
                      <TableCell>
                        {subscriber.confirmed_at ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Bekräftad
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            Obekräftad
                          </span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        subscriber.is_active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {subscriber.is_active ? 'Aktiv' : isNewsletter ? 'Avregistrerad' : 'Inaktiv'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(subscriber.subscribed_at).toLocaleDateString('sv-SE')}
                    </TableCell>
                    {isNewsletter && (
                      <TableCell>
                        {subscriber.unsubscribed_at
                          ? new Date(subscriber.unsubscribed_at).toLocaleDateString('sv-SE')
                          : '-'}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {isNewsletter && !subscriber.confirmed_at && subscriber.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResendConfirmation(subscriber.email)}
                            title="Skicka bekräftelsemail igen"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(subscriber)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(subscriber.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isAddMode
                ? `Lägg till ${label}`
                : `Redigera ${label}`}
            </DialogTitle>
            <DialogDescription>
              {isAddMode
                ? `Lägg till en ny ${label} som bekräftad och aktiv`
                : `Uppdatera information för ${label}en`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Namn</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Ange namn"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">E-post</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="namn@exempel.se"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-active"
                checked={editForm.is_active}
                onCheckedChange={(checked) => setEditForm({ ...editForm, is_active: checked })}
              />
              <Label htmlFor="edit-active">Aktiv prenumeration</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Avbryt
              </Button>
              <Button onClick={handleSave}>
                Spara ändringar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
