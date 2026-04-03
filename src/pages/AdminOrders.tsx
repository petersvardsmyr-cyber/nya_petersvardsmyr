import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, Package, Calendar, CreditCard, Mail, Truck, Send, AlertCircle, CheckCircle2, Loader2, ShoppingCart, Trash2, Search } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Order {
  id: string;
  created_at: string;
  email: string;
  total_amount: number;
  discount_amount: number;
  discount_code: string | null;
  status: string;
  items: any;
  shipping_address: any;
  stripe_session_id: string;
  stripe_payment_intent_id?: string | null;
  shipped_at?: string;
  shipping_tracking_number?: string;
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [shippingOrder, setShippingOrder] = useState<Order | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isShipping, setIsShipping] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<'checking' | 'success' | 'error' | null>(null);
  const [stripeDetails, setStripeDetails] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'completed' | 'abandoned'>('completed');
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  // Filter orders based on tab and search
  const matchesSearch = (order: Order) => {
    if (!searchQuery.trim()) return true;
    return order.email.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const paidOrders = orders.filter(order =>
    order.stripe_payment_intent_id !== null &&
    order.stripe_payment_intent_id !== undefined &&
    matchesSearch(order)
  );

  const abandonedOrders = orders.filter(order =>
    order.status === 'pending' &&
    !order.stripe_payment_intent_id &&
    matchesSearch(order)
  );

  const shippedOrders = paidOrders.filter(order => order.status === 'shipped');

  useEffect(() => {
    fetchOrders();
    checkStripeHealth();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, created_at, email, total_amount, discount_amount, discount_code, status, items, shipping_address, stripe_session_id, stripe_payment_intent_id, shipped_at, shipping_tracking_number')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      toast({
        title: "Fel vid hämtning av beställningar",
        description: "Kunde inte hämta beställningarna.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const cleanupAbandonedOrders = async () => {
    try {
      const { error } = await supabase.functions.invoke('cleanup-abandoned-orders');
      
      if (error) throw error;
      
      toast({
        title: "Rensning slutförd",
        description: "Gamla övergivna varukorgar har raderats.",
      });
      
      fetchOrders();
    } catch (error) {
      console.error('Error cleaning up orders:', error);
      toast({
        title: "Fel",
        description: "Kunde inte rensa övergivna varukorgar.",
        variant: "destructive",
      });
    }
  };

  const checkStripeHealth = async () => {
    setStripeStatus('checking');
    try {
      const { data, error } = await supabase.functions.invoke('stripe-health-check');
      if (error) throw error;
      
      setStripeStatus(data.status === 'success' ? 'success' : 'error');
      setStripeDetails(data);
    } catch (error: any) {
      console.error('Stripe health check failed:', error);
      setStripeStatus('error');
      setStripeDetails({ error: error.message || 'Connection failed' });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'd MMM yyyy HH:mm', { locale: sv });
  };

  const handleShipOrder = async () => {
    if (!shippingOrder) return;
    
    setIsShipping(true);
    try {
      const { error } = await supabase.functions.invoke('ship-order', {
        body: {
          order_id: shippingOrder.id,
          tracking_number: trackingNumber.trim() || undefined
        }
      });

      if (error) throw error;

      toast({
        title: "Beställning skickad",
        description: "Kunden har informerats via e-post om att beställningen är skickad.",
      });

      // Reset form
      setShippingOrder(null);
      setTrackingNumber('');
      
      // Refresh orders
      fetchOrders();
    } catch (error) {
      console.error('Error shipping order:', error);
      toast({
        title: "Fel",
        description: "Kunde inte skicka beställningen. Försök igen.",
        variant: "destructive",
      });
    } finally {
      setIsShipping(false);
    }
  };

  const getStatusBadge = (status: string, hasPayment: boolean = false) => {
    const statusMap = {
      pending: { label: hasPayment ? 'Väntande' : 'Övergiven', variant: hasPayment ? 'secondary' as const : 'outline' as const },
      paid: { label: 'Betald', variant: 'default' as const },
      shipped: { label: 'Skickad', variant: 'default' as const },
      completed: { label: 'Slutförd', variant: 'default' as const },
      cancelled: { label: 'Avbruten', variant: 'destructive' as const }
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || { label: status, variant: 'secondary' as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const renderOrdersList = (ordersList: Order[]) => {
    if (ordersList.length === 0) {
      return (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-medium">
                {activeTab === 'completed' ? 'Inga betalda beställningar än' : 'Inga övergivna varukorgar'}
              </h3>
              <p className="text-muted-foreground">
                {activeTab === 'completed' 
                  ? 'Betalda beställningar kommer att visas här när kunder slutför köp.'
                  : 'Övergivna varukorgar visas här när kunder påbörjar men inte slutför köp.'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {ordersList.map((order) => (
          <Card key={order.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    Beställning #{order.id.slice(0, 8)}
                    {!order.stripe_payment_intent_id && (
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                    )}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDate(order.created_at)}
                  </CardDescription>
                </div>
                <div className="flex flex-col sm:items-end gap-2">
                  {getStatusBadge(order.status, !!order.stripe_payment_intent_id)}
                  <div className="text-lg font-semibold">
                    {formatCurrency(order.total_amount)}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm truncate">{order.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{Array.isArray(order.items) ? order.items.length : 0} produkter</span>
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{order.stripe_payment_intent_id ? 'Betald' : 'Ej betald'}</span>
                </div>
                <div className="flex justify-end gap-2">
                  {(order.status === 'paid' || order.status === 'completed') && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => setShippingOrder(order)}
                        >
                          <Truck className="h-4 w-4 mr-2" />
                          Markera som skickad
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Markera som skickad</DialogTitle>
                          <DialogDescription>
                            Beställning #{order.id.slice(0, 8)} kommer att markeras som skickad och kunden får ett bekräftelsemail.
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="tracking">Spårningsnummer (valfritt)</Label>
                            <Input
                              id="tracking"
                              value={trackingNumber}
                              onChange={(e) => setTrackingNumber(e.target.value)}
                              placeholder="T.ex. 1234567890"
                            />
                          </div>
                          
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              onClick={() => {
                                setShippingOrder(null);
                                setTrackingNumber('');
                              }}
                            >
                              Avbryt
                            </Button>
                            <Button 
                              onClick={handleShipOrder}
                              disabled={isShipping}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              {isShipping ? 'Skickar...' : 'Skicka beställning'}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Visa detaljer
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>
                          Beställning #{selectedOrder?.id.slice(0, 8)}
                        </DialogTitle>
                        <DialogDescription>
                          Skapad {selectedOrder && formatDate(selectedOrder.created_at)}
                        </DialogDescription>
                      </DialogHeader>
                      
                      {selectedOrder && (
                        <div className="space-y-6">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <h4 className="font-medium mb-2">Kundinfo</h4>
                              <p className="text-sm text-muted-foreground">{selectedOrder.email}</p>
                            </div>
                          <div>
                            <h4 className="font-medium mb-2">Status</h4>
                            {getStatusBadge(selectedOrder.status, !!selectedOrder.stripe_payment_intent_id)}
                            {selectedOrder.shipped_at && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Skickad: {formatDate(selectedOrder.shipped_at)}
                              </p>
                            )}
                            {!selectedOrder.stripe_payment_intent_id && (
                              <p className="text-sm text-orange-600 mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Ingen betalning mottagen
                              </p>
                            )}
                          </div>
                          </div>

                          <div>
                            <h4 className="font-medium mb-2">Produkter</h4>
                            <div className="space-y-2">
                              {Array.isArray(selectedOrder.items) && selectedOrder.items?.map((item: any, index: number) => (
                                <div key={index} className="flex justify-between items-center p-2 border rounded">
                                  <span>{item.title}</span>
                                  <div className="text-right">
                                    <div>{item.quantity} st</div>
                                    <div className="text-sm text-muted-foreground">
                                      {formatCurrency(item.price * 100)}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {selectedOrder.shipping_address && (
                            <div>
                              <h4 className="font-medium mb-2">Leveransadress</h4>
                              <div className="text-sm space-y-1">
                                {/* Customer name - check both top-level and nested shipping_option */}
                                {selectedOrder.shipping_address.name && !selectedOrder.shipping_address.option_id && (
                                  <p className="font-medium">{selectedOrder.shipping_address.name}</p>
                                )}
                                {selectedOrder.shipping_address.line1 && (
                                  <p>{selectedOrder.shipping_address.line1}</p>
                                )}
                                {selectedOrder.shipping_address.line2 && (
                                  <p>{selectedOrder.shipping_address.line2}</p>
                                )}
                                {(selectedOrder.shipping_address.postal_code || selectedOrder.shipping_address.city) && (
                                  <p>
                                    {selectedOrder.shipping_address.postal_code && selectedOrder.shipping_address.postal_code}{' '}
                                    {selectedOrder.shipping_address.city && selectedOrder.shipping_address.city}
                                  </p>
                                )}
                                {selectedOrder.shipping_address.state && (
                                  <p>{selectedOrder.shipping_address.state}</p>
                                )}
                                {selectedOrder.shipping_address.country && (
                                  <p>{selectedOrder.shipping_address.country}</p>
                                )}
                                {selectedOrder.shipping_address.phone && (
                                  <p className="mt-2">
                                    <span className="text-muted-foreground">Tel: </span>
                                    {selectedOrder.shipping_address.phone}
                                  </p>
                                )}
                                {/* Show shipping option/region info */}
                                {(selectedOrder.shipping_address.shipping_option?.name || selectedOrder.shipping_address.region) && (
                                  <p className="mt-2 text-muted-foreground">
                                    Fraktsätt: {selectedOrder.shipping_address.shipping_option?.name || selectedOrder.shipping_address.name}
                                    {(selectedOrder.shipping_address.shipping_option?.region || selectedOrder.shipping_address.region) && (
                                      <> ({selectedOrder.shipping_address.shipping_option?.region || selectedOrder.shipping_address.region})</>
                                    )}
                                  </p>
                                )}
                                {/* Fallback for old orders that only have shipping option data */}
                                {!selectedOrder.shipping_address.line1 && !selectedOrder.shipping_address.shipping_option && selectedOrder.shipping_address.region && (
                                  <p className="text-muted-foreground italic">
                                    Fullständig adress saknas (äldre beställning)
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="border-t pt-4">
                            <div className="space-y-2">
                              {selectedOrder.discount_amount > 0 && (
                                <div className="flex justify-between">
                                  <span>Rabatt ({selectedOrder.discount_code})</span>
                                  <span>-{formatCurrency(selectedOrder.discount_amount)}</span>
                                </div>
                              )}
                              <div className="flex justify-between font-medium">
                                <span>Totalt</span>
                                <span>{formatCurrency(selectedOrder.total_amount)}</span>
                              </div>
                            </div>
                          </div>

                          {selectedOrder.shipping_tracking_number && (
                            <div>
                              <h4 className="font-medium mb-2">Spårningsnummer</h4>
                              <p className="text-sm text-muted-foreground">
                                {selectedOrder.shipping_tracking_number}
                              </p>
                            </div>
                          )}

                          <div>
                            <h4 className="font-medium mb-2">Stripe Session ID</h4>
                            <p className="text-xs text-muted-foreground font-mono break-all">
                              {selectedOrder.stripe_session_id}
                            </p>
                            {selectedOrder.stripe_payment_intent_id && (
                              <>
                                <h4 className="font-medium mb-2 mt-4">Stripe Payment Intent ID</h4>
                                <p className="text-xs text-muted-foreground font-mono break-all">
                                  {selectedOrder.stripe_payment_intent_id}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Beställningar</h1>
        <div>Laddar...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Beställningar</h1>
        <div className="flex gap-2">
          <Button onClick={fetchOrders} variant="outline">
            Uppdatera
          </Button>
          <Button onClick={checkStripeHealth} variant="outline" size="sm">
            {stripeStatus === 'checking' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Testa Stripe'
            )}
          </Button>
        </div>
      </div>

      {/* Stripe Status Alert */}
      {stripeStatus && (
        <Alert className={stripeStatus === 'success' ? 'border-green-200 bg-green-50' : stripeStatus === 'error' ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}>
          {stripeStatus === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : stripeStatus === 'error' ? (
            <AlertCircle className="h-4 w-4 text-red-600" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          )}
          <AlertDescription>
            {stripeStatus === 'success' && stripeDetails && (
              <div>
                <strong>Stripe anslutning OK</strong> - {stripeDetails.key_type === 'live' ? 'Live-läge' : 'Test-läge'} 
                {stripeDetails.account && ` (${stripeDetails.account.country})`}
                {stripeDetails.webhook_secret_configured && ' • Webhook konfigurerad'}
              </div>
            )}
            {stripeStatus === 'error' && (
              <div>
                <strong>Stripe anslutningsproblem:</strong> {stripeDetails?.error || 'Okänt fel'}
              </div>
            )}
            {stripeStatus === 'checking' && 'Kontrollerar Stripe anslutning...'}
          </AlertDescription>
        </Alert>
      )}

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Betalda beställningar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{paidOrders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Skickade paket</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{shippedOrders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Övergivna varukorgar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{abandonedOrders.length}</div>
            {abandonedOrders.length > 0 && (
              <Button 
                variant="link" 
                size="sm" 
                className="h-auto p-0 text-xs text-muted-foreground hover:text-destructive"
                onClick={cleanupAbandonedOrders}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Rensa gamla (&gt;24h)
              </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Totalt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Sök på e-postadress..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-medium">Inga beställningar än</h3>
              <p className="text-muted-foreground">
                Beställningar kommer att visas här när kunder genomför köp.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'completed' | 'abandoned')}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="completed">
              Betalda beställningar ({paidOrders.length})
            </TabsTrigger>
            <TabsTrigger value="abandoned">
              Övergivna varukorgar ({abandonedOrders.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="completed" className="mt-6">
            {renderOrdersList(paidOrders)}
          </TabsContent>
          
          <TabsContent value="abandoned" className="mt-6">
            {renderOrdersList(abandonedOrders)}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}