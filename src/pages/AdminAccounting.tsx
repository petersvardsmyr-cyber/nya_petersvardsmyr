import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2, FileSpreadsheet } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  stripe_payment_intent_id?: string | null;
}

interface AccountingRow {
  orderNumber: string;
  date: string;
  customerEmail: string;
  products: string;
  amountExVat: number;
  vat6: number;
  vat25: number;
  totalVat: number;
  amountIncVat: number;
  stripeFee: number;
  netPayout: number;
}

const BOOK_VAT_RATE = 0.06;
const MERCH_VAT_RATE = 0.25;

export default function AdminAccounting() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [stripeFees, setStripeFees] = useState<Record<string, number>>({});
  const [feesLoading, setFeesLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchStripeFees = async (orders: Order[]) => {
    const paidOrders = orders.filter(o => o.stripe_payment_intent_id);
    const paymentIntentIds = paidOrders.map(o => o.stripe_payment_intent_id!);

    if (paymentIntentIds.length === 0) return;

    setFeesLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-stripe-fees', {
        body: { payment_intent_ids: paymentIntentIds }
      });
      if (!error && data?.fees) {
        setStripeFees(data.fees);
      }
    } catch (e) {
      console.error('Failed to fetch Stripe fees:', e);
      toast({
        title: "Kunde inte hämta Stripe-avgifter",
        description: "Avgifterna kunde inte hämtas från Stripe. Kontrollera anslutningen.",
        variant: "destructive",
      });
    } finally {
      setFeesLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .not('stripe_payment_intent_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
      // Hämta faktiska Stripe-avgifter efter att ordrar laddats
      if (data && data.length > 0) {
        fetchStripeFees(data);
      }
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

  const getVatRate = (category: string | null | undefined) => {
    // Gamla ordrar saknar category - default till 'book' (alla tidiga produkter var böcker)
    if (!category) return BOOK_VAT_RATE;
    return category === 'book' ? BOOK_VAT_RATE : MERCH_VAT_RATE;
  };

  const calculateAccountingData = (order: Order): AccountingRow => {
    let totalExVat = 0;
    let vat6Total = 0;
    let vat25Total = 0;
    
    // Calculate product totals
    if (Array.isArray(order.items)) {
      order.items.forEach((item: any) => {
        const vatRate = getVatRate(item.category);
        const itemTotalIncVat = item.price * item.quantity * 100; // Convert to öre
        const itemExVat = itemTotalIncVat / (1 + vatRate);
        const itemVat = itemTotalIncVat - itemExVat;
        
        totalExVat += itemExVat;
        
        if (vatRate === BOOK_VAT_RATE) {
          vat6Total += itemVat;
        } else {
          vat25Total += itemVat;
        }
      });
    }

    // Add shipping if exists - använd faktisk momssats från ordern
    if (order.shipping_address) {
      const shippingVatRate = order.shipping_address?.vat_rate ?? 0.25;
      const shippingExVat = order.shipping_address.price_ex_vat * 100;
      const shippingIncVat = shippingExVat * (1 + shippingVatRate);
      const shippingVat = shippingIncVat - shippingExVat;

      totalExVat += shippingExVat;
      // Fördela fraktmoms till rätt momssats-kategori
      if (shippingVatRate === BOOK_VAT_RATE) {
        vat6Total += shippingVat;
      } else {
        vat25Total += shippingVat;
      }
    }

    const totalVat = vat6Total + vat25Total;
    const totalIncVat = order.total_amount;

    // Hämta faktisk Stripe-avgift från API (i öre) eller visa 0 om inte tillgänglig
    const stripeFee = order.stripe_payment_intent_id && stripeFees[order.stripe_payment_intent_id]
      ? stripeFees[order.stripe_payment_intent_id] / 100  // Konvertera öre till SEK
      : 0;
    const netPayout = (totalIncVat / 100) - stripeFee;

    // Get product names
    const productNames = Array.isArray(order.items) 
      ? order.items.map((item: any) => `${item.title} (${item.quantity}st)`).join(', ')
      : '';

    return {
      orderNumber: order.id.slice(0, 8),
      date: new Date(order.created_at).toLocaleDateString('sv-SE'),
      customerEmail: order.email,
      products: productNames,
      amountExVat: totalExVat / 100,
      vat6: vat6Total / 100,
      vat25: vat25Total / 100,
      totalVat: totalVat / 100,
      amountIncVat: totalIncVat / 100,
      stripeFee: stripeFee,
      netPayout: netPayout
    };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const filteredOrders = orders.filter(order => {
    if (!dateFrom && !dateTo) return true;
    const orderDate = new Date(order.created_at);
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo + 'T23:59:59') : null;
    
    if (from && orderDate < from) return false;
    if (to && orderDate > to) return false;
    return true;
  });

  const accountingRows = filteredOrders.map(calculateAccountingData);

  const totals = accountingRows.reduce((acc, row) => ({
    amountExVat: acc.amountExVat + row.amountExVat,
    vat6: acc.vat6 + row.vat6,
    vat25: acc.vat25 + row.vat25,
    totalVat: acc.totalVat + row.totalVat,
    amountIncVat: acc.amountIncVat + row.amountIncVat,
    stripeFee: acc.stripeFee + row.stripeFee,
    netPayout: acc.netPayout + row.netPayout,
  }), { amountExVat: 0, vat6: 0, vat25: 0, totalVat: 0, amountIncVat: 0, stripeFee: 0, netPayout: 0 });

  const exportToCSV = () => {
    const headers = [
      'Ordernummer',
      'Datum',
      'Kund',
      'Produkter',
      'Belopp exkl. moms (SEK)',
      'Moms 6% (SEK)',
      'Moms 25% (SEK)',
      'Total moms (SEK)',
      'Belopp inkl. moms (SEK)',
      'Stripe-avgift (SEK)',
      'Nettoutbetalning (SEK)'
    ];

    const csvRows = [
      headers.join(';'),
      ...accountingRows.map(row => [
        row.orderNumber,
        row.date,
        row.customerEmail,
        `"${row.products}"`,
        formatCurrency(row.amountExVat).replace(',', '.'),
        formatCurrency(row.vat6).replace(',', '.'),
        formatCurrency(row.vat25).replace(',', '.'),
        formatCurrency(row.totalVat).replace(',', '.'),
        formatCurrency(row.amountIncVat).replace(',', '.'),
        formatCurrency(row.stripeFee).replace(',', '.'),
        formatCurrency(row.netPayout).replace(',', '.')
      ].join(';')),
      '',
      'TOTALT;;;' + [
        formatCurrency(totals.amountExVat).replace(',', '.'),
        formatCurrency(totals.vat6).replace(',', '.'),
        formatCurrency(totals.vat25).replace(',', '.'),
        formatCurrency(totals.totalVat).replace(',', '.'),
        formatCurrency(totals.amountIncVat).replace(',', '.'),
        formatCurrency(totals.stripeFee).replace(',', '.'),
        formatCurrency(totals.netPayout).replace(',', '.')
      ].join(';')
    ];

    const csvContent = csvRows.join('\n');
    const BOM = '\uFEFF'; // UTF-8 BOM for proper Swedish characters
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const fileName = dateFrom && dateTo 
      ? `bokforing_${dateFrom}_till_${dateTo}.csv`
      : `bokforing_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export klar",
      description: "Bokföringsunderlaget har exporterats till CSV.",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold">Bokföringsunderlag</h1>
          <p className="text-muted-foreground">
            Översikt av betalda beställningar med moms och Stripe-avgifter
            {feesLoading && ' (hämtar Stripe-avgifter...)'}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtrera och exportera</CardTitle>
            <CardDescription>Välj datumperiod och exportera till CSV för bokföring</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="dateFrom">Från datum</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="dateTo">Till datum</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <Button 
                onClick={exportToCSV} 
                disabled={accountingRows.length === 0}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Exportera CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Beställningar ({accountingRows.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order#</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Kund</TableHead>
                  <TableHead>Produkter</TableHead>
                  <TableHead className="text-right">Exkl. moms</TableHead>
                  <TableHead className="text-right">Moms 6%</TableHead>
                  <TableHead className="text-right">Moms 25%</TableHead>
                  <TableHead className="text-right">Total moms</TableHead>
                  <TableHead className="text-right">Inkl. moms</TableHead>
                  <TableHead className="text-right">Stripe-avgift</TableHead>
                  <TableHead className="text-right">Netto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountingRows.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono">{row.orderNumber}</TableCell>
                    <TableCell>{row.date}</TableCell>
                    <TableCell className="text-sm">{row.customerEmail}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate" title={row.products}>
                      {row.products}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(row.amountExVat)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.vat6)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.vat25)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(row.totalVat)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(row.amountIncVat)}</TableCell>
                    <TableCell className="text-right text-destructive">{formatCurrency(row.stripeFee)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(row.netPayout)}</TableCell>
                  </TableRow>
                ))}
                {accountingRows.length > 0 && (
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={4}>TOTALT</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.amountExVat)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.vat6)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.vat25)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.totalVat)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.amountIncVat)}</TableCell>
                    <TableCell className="text-right text-destructive">{formatCurrency(totals.stripeFee)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.netPayout)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {accountingRows.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {dateFrom || dateTo ? 'Inga beställningar för vald period' : 'Inga betalda beställningar än'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
