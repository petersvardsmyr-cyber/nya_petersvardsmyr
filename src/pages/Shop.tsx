import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ShoppingCart, Plus, Minus, Trash2, Percent } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import attBliTillImage1 from '@/assets/book-att-bli-till.jpg';
import attBliTillImage2 from '@/assets/book-att-bli-till-2.jpg';
import attBliTillImage3 from '@/assets/book-att-bli-till-3.jpg';
import alltDetViDelarExtra1 from '@/assets/book-allt-det-vi-delar-extra-1.jpg';
import alltDetViDelarExtra2 from '@/assets/book-allt-det-vi-delar-extra-2.jpg';
import alltDetViDelarExtra3 from '@/assets/book-allt-det-vi-delar-extra-3.jpg';
import alltDetViDelarExtra4 from '@/assets/book-allt-det-vi-delar-extra-4.jpg';
import alltDetViDelarExtra5 from '@/assets/book-allt-det-vi-delar-extra-5.jpg';
import alltDetViDelarExtra6 from '@/assets/book-allt-det-vi-delar-extra-6.jpg';
import alltDetViDelarExtra7 from '@/assets/book-allt-det-vi-delar-extra-7.jpg';
import tygkasseSvart1 from '@/assets/tygkasse-svart-1.jpg';
import tygkasseSvart2 from '@/assets/tygkasse-svart-2.jpg';
import tygkasseSvart3 from '@/assets/tygkasse-svart-3.jpg';
import detOrdnarSigExtra1 from '@/assets/book-det-ordnar-sig-extra-1.jpg';
import detOrdnarSigExtra2 from '@/assets/book-det-ordnar-sig-extra-2.jpg';
import detOrdnarSigExtra3 from '@/assets/book-det-ordnar-sig-extra-3.jpg';
import detOrdnarSigExtra4 from '@/assets/book-det-ordnar-sig-extra-4.jpg';
import detOrdnarSigExtra5 from '@/assets/book-det-ordnar-sig-extra-5.jpg';
import alltDetViDelarAndraAretExtra1 from '@/assets/book-allt-det-vi-delar-andra-aret-extra-1.jpg';
import alltDetViDelarAndraAretExtra2 from '@/assets/book-allt-det-vi-delar-andra-aret-extra-2.jpg';
import alltDetViDelarAndraAretExtra3 from '@/assets/book-allt-det-vi-delar-andra-aret-extra-3.jpg';
import alltDetViDelarAndraAretExtra4 from '@/assets/book-allt-det-vi-delar-andra-aret-extra-4.jpg';
import alltDetViDelarAndraAretExtra5 from '@/assets/book-allt-det-vi-delar-andra-aret-extra-5.jpg';
import alltDetViDelarAndraAretExtra6 from '@/assets/book-allt-det-vi-delar-andra-aret-extra-6.jpg';

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  original_price: number | null;
  image_url: string;
  additional_images?: string[];
  in_stock: boolean;
  featured: boolean;
  category?: string | null;
  discount_active: boolean;
}

interface CartItem extends Product {
  quantity: number;
}

interface ShippingOption {
  id: 'sweden' | 'europe' | 'world';
  name: string;
  price: number;
  region: 'sweden' | 'eu' | 'non-eu';
}

const SHIPPING_OPTIONS: ShippingOption[] = [
  { id: 'sweden', name: 'Inom Sverige', price: 39, region: 'sweden' },
  { id: 'europe', name: 'Europa (utanför Sverige)', price: 100, region: 'eu' },
  { id: 'world', name: 'Utanför Europa', price: 100, region: 'non-eu' }
];

const BOOK_VAT_RATE = 0.06;

// Determine VAT rate per product (books 6%, merch 25%)
const getVatRate = (product: Product | CartItem) => {
  return product.category === 'book' ? 0.06 : 0.25;
};

const Shop = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [discountCode, setDiscountCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption>(SHIPPING_OPTIONS[0]);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchProducts();
    loadCart();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('in_stock', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      
      // Map products and add hardcoded additional images
      const productsWithImages = (data || []).map(product => {
        if (product.title === "Att bli till") {
          return {
            ...product,
            additional_images: [product.image_url, attBliTillImage1, attBliTillImage2, attBliTillImage3]
          } as Product;
        }
        if (product.title === "Allt det vi delar") {
          return {
            ...product,
            additional_images: [
              product.image_url,
              alltDetViDelarExtra2,
              alltDetViDelarExtra3,
              alltDetViDelarExtra4,
              alltDetViDelarExtra5,
              alltDetViDelarExtra6,
              alltDetViDelarExtra7,
              alltDetViDelarExtra1
            ]
          } as Product;
        }
        if (product.title === "Tygkasse, svart") {
          return {
            ...product,
            additional_images: [tygkasseSvart1, tygkasseSvart2, tygkasseSvart3]
          } as Product;
        }
        if (product.title === "Det ordnar sig") {
          return {
            ...product,
            additional_images: [product.image_url, detOrdnarSigExtra1, detOrdnarSigExtra2, detOrdnarSigExtra3, detOrdnarSigExtra4, detOrdnarSigExtra5]
          } as Product;
        }
        if (product.title === "Allt det vi delar – andra året") {
          return {
            ...product,
            additional_images: [
              product.image_url,
              alltDetViDelarAndraAretExtra1,
              alltDetViDelarAndraAretExtra2,
              alltDetViDelarAndraAretExtra3,
              alltDetViDelarAndraAretExtra4,
              alltDetViDelarAndraAretExtra5,
              alltDetViDelarAndraAretExtra6
            ]
          } as Product;
        }
        return product as Product;
      });
      
      setProducts(productsWithImages);
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte ladda produkter",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCart = () => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  };

  const saveCart = (newCart: CartItem[]) => {
    localStorage.setItem('cart', JSON.stringify(newCart));
    setCart(newCart);
  };

  const addToCart = (product: Product) => {
    // Use discount price if active, otherwise use original price
    const effectivePrice = product.discount_active ? product.price : (product.original_price || product.price);
    const productWithEffectivePrice = { ...product, price: effectivePrice };
    
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      const newCart = cart.map(item =>
        item.id === product.id 
          ? { ...item, quantity: item.quantity + 1, price: effectivePrice }
          : item
      );
      saveCart(newCart);
    } else {
      const newCart = [...cart, { ...productWithEffectivePrice, quantity: 1 }];
      saveCart(newCart);
    }
    toast({
      title: "Tillagd i varukorg",
      description: `${product.title} har lagts till i din varukorg`,
    });
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity === 0) {
      removeFromCart(productId);
      return;
    }
    const newCart = cart.map(item =>
      item.id === productId 
        ? { ...item, quantity: newQuantity }
        : item
    );
    saveCart(newCart);
  };

  const removeFromCart = (productId: string) => {
    const newCart = cart.filter(item => item.id !== productId);
    saveCart(newCart);
  };

  const applyDiscount = () => {
    // Simple discount logic - in real app, validate against database
    if (discountCode.toLowerCase() === 'välkommen10') {
      setDiscountAmount(10);
      toast({
        title: "Rabattkod aktiverad!",
        description: "10% rabatt tillämpad",
      });
    } else {
      setDiscountAmount(0);
      toast({
        title: "Ogiltig rabattkod",
        description: "Rabattkoden kunde inte hittas",
        variant: "destructive",
      });
    }
  };

  // Bestäm fraktens momssats baserat på varukorgens innehåll
  const determineShippingVatRate = (): number => {
    // Utanför EU = momsfri export
    if (selectedShipping.region === 'non-eu') return 0;

    let bookQuantity = 0;
    let merchQuantity = 0;

    cart.forEach(item => {
      if (item.category === 'book') {
        bookQuantity += item.quantity;
      } else {
        merchQuantity += item.quantity;
      }
    });

    // Bara böcker → 6%
    if (merchQuantity === 0) return 0.06;
    // Bara merch → 25%
    if (bookQuantity === 0) return 0.25;
    // Mix → momssats för kategorin med flest artiklar (lika = 6%, förmånligare)
    return bookQuantity >= merchQuantity ? 0.06 : 0.25;
  };

  const calculateVATBreakdown = () => {
    // Steg 1: Beräkna inkl. moms per produkt, sedan räkna ut moms baklänges
    let vat6ExVAT = 0;
    let vat6VAT = 0;
    let vat6IncVAT = 0;
    let vat25ExVAT = 0;
    let vat25VAT = 0;
    let vat25IncVAT = 0;

    cart.forEach(item => {
      const vatRate = getVatRate(item);
      // Kundens pris inkl moms per styck (avrundad till helkrona)
      const unitIncVAT = Math.round(item.price * (1 + vatRate));
      const itemIncVAT = unitIncVAT * item.quantity;
      // Räkna ut moms baklänges från inkl-moms-beloppet
      const itemExVAT = Math.round(itemIncVAT / (1 + vatRate));
      const itemVAT = itemIncVAT - itemExVAT;

      if (vatRate === 0.06) {
        vat6ExVAT += itemExVAT;
        vat6VAT += itemVAT;
        vat6IncVAT += itemIncVAT;
      } else {
        vat25ExVAT += itemExVAT;
        vat25VAT += itemVAT;
        vat25IncVAT += itemIncVAT;
      }
    });

    const productsExVAT = vat6ExVAT + vat25ExVAT;
    const productsVAT = vat6VAT + vat25VAT;
    const productsIncVAT = vat6IncVAT + vat25IncVAT;

    // Tillämpa rabatt proportionellt på inkl-moms-belopp
    const discountAmountSEK = Math.round(productsIncVAT * (discountAmount / 100));
    const finalProductsIncVAT = productsIncVAT - discountAmountSEK;
    const finalProductsExVAT = productsIncVAT > 0
      ? Math.round(productsExVAT - Math.round((productsExVAT / productsIncVAT) * discountAmountSEK))
      : 0;
    const finalProductsVAT = finalProductsIncVAT - finalProductsExVAT;

    // Beräkna frakt med dynamisk momssats
    const shippingVatRate = determineShippingVatRate();
    const shippingIncVAT = selectedShipping.price;
    const shippingExVAT = shippingVatRate > 0
      ? Math.round(shippingIncVAT / (1 + shippingVatRate))
      : shippingIncVAT;
    const shippingVAT = shippingIncVAT - shippingExVAT;

    // Summera totaler
    const totalExVAT = finalProductsExVAT + shippingExVAT;
    const totalVAT = finalProductsVAT + shippingVAT;
    const rawTotalIncVAT = totalExVAT + totalVAT;

    // Öresutjämning: avrunda till närmaste helkrona
    const roundedTotalIncVAT = Math.round(rawTotalIncVAT);
    const oresutjamning = roundedTotalIncVAT - rawTotalIncVAT;

    return {
      products: {
        exVAT: finalProductsExVAT,
        vat: finalProductsVAT,
        incVAT: finalProductsIncVAT,
        originalIncVAT: productsIncVAT,
        discount: discountAmountSEK
      },
      vat6: { exVAT: vat6ExVAT, vat: vat6VAT, incVAT: vat6IncVAT },
      vat25: { exVAT: vat25ExVAT, vat: vat25VAT, incVAT: vat25IncVAT },
      shipping: {
        exVAT: shippingExVAT,
        vat: shippingVAT,
        incVAT: shippingIncVAT,
        vatRate: shippingVatRate
      },
      total: {
        exVAT: totalExVAT,
        vat: totalVAT,
        incVAT: roundedTotalIncVAT,
        oresutjamning: oresutjamning
      }
    };
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    setIsCheckingOut(true);
    try {
      const breakdown = calculateVATBreakdown();
      
      // Get current user session if available
      const { data: { session } } = await supabase.auth.getSession();
      
      const orderData = {
        items: cart.map(item => ({
          id: item.id,
          title: item.title,
          price: Math.round(item.price * (1 + getVatRate(item))), // inkl. moms, helkrona
          quantity: item.quantity,
          category: item.category || 'book'
        })),
        shipping: {
          option_id: selectedShipping.id,
          name: selectedShipping.name,
          price_ex_vat: breakdown.shipping.exVAT,
          vat_rate: breakdown.shipping.vatRate,
          region: selectedShipping.region
        },
        total_amount: breakdown.total.incVAT,
        discount_amount: breakdown.products.discount,
        discount_code: discountCode || null,
        newsletter_optin: newsletterOptIn,
        vat_breakdown: breakdown,
        email: session?.user?.email || undefined
      };

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: orderData
      });

      if (error) throw error;

      if (data?.url) {
        // Redirect directly to Stripe checkout to avoid popup blockers
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      
      let errorMessage = "Kunde inte skapa betalning. Försök igen senare.";
      let errorTitle = "Ett fel uppstod";
      
      if (error instanceof Error) {
        if (error.message?.includes('Invalid API Key')) {
          errorTitle = "Betalning ej konfigurerad";
          errorMessage = "Stripe betalning är inte korrekt konfigurerad. Kontakta supporten.";
        } else if (error.message?.includes('network') || error.message?.includes('timeout')) {
          errorTitle = "Nätverksfel";
          errorMessage = "Kontrollera din internetanslutning och försök igen.";
        } else if (error.message?.includes('validation')) {
          errorTitle = "Ogiltiga uppgifter";
          errorMessage = "Kontrollera dina uppgifter och försök igen.";
        } else if (error.message) {
          errorMessage = `${error.message}`;
        }
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsCheckingOut(false);
    }
  };

  const vatBreakdown = calculateVATBreakdown();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 md:px-12">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl md:text-4xl font-heading font-medium text-foreground">
              Butik
            </h1>
            <ShoppingCart className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">
            {cart.reduce((sum, item) => sum + item.quantity, 0)} varor i varukorgen
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Products */}
          <div className="lg:col-span-2">
            <div className="grid md:grid-cols-2 gap-6">
              {products.map((product) => {
                const images = product.additional_images || [product.image_url];
                const hasMultipleImages = images.length > 1;
                
                return (
                  <Card key={product.id} className="group hover:shadow-lg transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="aspect-square mb-4 overflow-hidden rounded-lg relative">
                        {hasMultipleImages ? (
                          <Carousel className="w-full h-full">
                            <CarouselContent>
                              {images.map((image, index) => (
                                <CarouselItem key={index}>
                                  <img 
                                    src={image} 
                                    alt={`${product.title} - Bild ${index + 1}`}
                                    className="w-full h-full object-cover object-top"
                                    loading="lazy"
                                  />
                                </CarouselItem>
                              ))}
                            </CarouselContent>
                            <CarouselPrevious className="left-2" />
                            <CarouselNext className="right-2" />
                          </Carousel>
                        ) : (
                          <img 
                            src={product.image_url} 
                            alt={product.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        )}
                      </div>
                    
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-heading font-medium text-lg text-foreground flex-1">
                        {product.title}
                      </h3>
                      {product.featured && (
                        <Badge variant="secondary" className="ml-2">Populär</Badge>
                      )}
                    </div>
                    
                    {product.description && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between">
                     <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          {product.discount_active && product.original_price ? (
                            <>
                              <span className="text-muted-foreground line-through text-sm">
                                {Math.round(product.original_price * (1 + getVatRate(product)))} kr
                              </span>
                              <span className="text-primary font-medium text-lg">
                                {Math.round(product.price * (1 + getVatRate(product)))} kr
                              </span>
                            </>
                          ) : (
                            <span className="text-primary font-medium text-lg">
                              {Math.round((product.original_price || product.price) * (1 + getVatRate(product)))} kr
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          ({product.discount_active ? product.price : (product.original_price || product.price)} kr ex moms + {Math.round((product.discount_active ? product.price : (product.original_price || product.price)) * getVatRate(product))} kr moms {Math.round(getVatRate(product) * 100)}%)
                        </span>
                      </div>
                      
                      <Button 
                        onClick={() => addToCart(product)}
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Lägg till
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          </div>

          {/* Cart */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <CardContent className="p-6">
                <h2 className="font-heading font-medium text-xl mb-4 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Varukorg
                </h2>
                
                {cart.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Din varukorg är tom
                  </p>
                ) : (
                  <>
                    <div className="space-y-4 mb-6">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 pb-4 border-b">
                          <img 
                            src={item.image_url} 
                            alt={item.title}
                            className="w-16 h-16 object-cover rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">{item.title}</h4>
                            <p className="text-primary font-medium">{Math.round(item.price * (1 + getVatRate(item)))} kr</p>
                            <p className="text-xs text-muted-foreground">({item.price} kr ex moms)</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="w-8 h-8 p-0"
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center text-sm">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="w-8 h-8 p-0"
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFromCart(item.id)}
                              className="w-8 h-8 p-0 text-destructive"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Shipping Options */}
                    <div className="mb-6">
                      <h3 className="font-medium mb-3">Frakt</h3>
                      <div className="space-y-2">
                        {SHIPPING_OPTIONS.map((option) => (
                          <label key={option.id} className="flex items-center gap-3 p-3 border rounded cursor-pointer hover:bg-accent">
                            <input
                              type="radio"
                              name="shipping"
                              checked={selectedShipping.id === option.id}
                              onChange={() => setSelectedShipping(option)}
                              className="text-primary"
                            />
                            <div className="flex-1">
                              <div className="flex justify-between items-center">
                                <span className="font-medium">{option.name}</span>
                                <span className="font-medium">{option.price} kr</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {option.region === 'non-eu'
                                  ? `${option.price} kr - Momsfri export`
                                  : `Momssats beror på varukorgens innehåll`
                                }
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Discount Code */}
                    <div className="mb-6">
                      <div className="flex gap-2 mb-2">
                        <Input
                          placeholder="Rabattkod"
                          value={discountCode}
                          onChange={(e) => setDiscountCode(e.target.value)}
                          className="flex-1"
                        />
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={applyDiscount}
                          className="flex items-center gap-1"
                        >
                          <Percent className="w-3 h-3" />
                        </Button>
                      </div>
                      {discountAmount > 0 && (
                        <p className="text-green-600 text-sm">
                          {discountAmount}% rabatt tillämpad
                        </p>
                      )}
                    </div>

                    {/* Newsletter Opt-in */}
                    <div className="mb-6">
                      <div className="flex items-start space-x-2">
                        <Checkbox 
                          id="newsletter" 
                          checked={newsletterOptIn}
                          onCheckedChange={(checked) => setNewsletterOptIn(checked === true)}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <label 
                            htmlFor="newsletter" 
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            Prenumerera på mitt nyhetsbrev
                          </label>
                          <p className="text-xs text-muted-foreground">
                            Få uppdateringar om nya böcker, artiklar och tankar direkt i din inkorg.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* VAT Breakdown */}
                    <div className="space-y-2 mb-6 pt-4 border-t">
                      <div className="text-sm font-medium mb-2">Prisuppdelning</div>

                      <div className="flex justify-between text-sm">
                        <span>Varor (ex moms):</span>
                        <span>{vatBreakdown.products.exVAT} kr</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Moms varor:</span>
                        <span>{vatBreakdown.products.vat} kr</span>
                      </div>
                      {vatBreakdown.products.discount > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Rabatt:</span>
                          <span>-{vatBreakdown.products.discount} kr</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm border-b pb-1">
                        <span>Varor totalt:</span>
                        <span>{vatBreakdown.products.incVAT} kr</span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span>Frakt (ex moms):</span>
                        <span>{vatBreakdown.shipping.exVAT} kr</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Moms frakt ({Math.round(vatBreakdown.shipping.vatRate * 100)}%):</span>
                        <span>{vatBreakdown.shipping.vat} kr {vatBreakdown.shipping.vatRate === 0 && "(momsfri export)"}</span>
                      </div>
                      <div className="flex justify-between text-sm border-b pb-1">
                        <span>Frakt totalt:</span>
                        <span>{vatBreakdown.shipping.incVAT} kr</span>
                      </div>

                      {vatBreakdown.total.oresutjamning !== 0 && (
                        <div className="flex justify-between text-sm">
                          <span>Öresutjämning:</span>
                          <span>{vatBreakdown.total.oresutjamning > 0 ? '+' : ''}{vatBreakdown.total.oresutjamning.toFixed(2)} kr</span>
                        </div>
                      )}

                      <div className="flex justify-between font-medium text-lg pt-2 border-t">
                        <span>Att betala:</span>
                        <span>{vatBreakdown.total.incVAT} kr</span>
                      </div>

                      <div className="text-xs text-muted-foreground pt-2">
                        <div>Total moms: {vatBreakdown.total.vat} kr</div>
                        {vatBreakdown.vat6.vat > 0 && (
                          <div>Varav moms 6% (böcker): {vatBreakdown.vat6.vat} kr</div>
                        )}
                        {vatBreakdown.vat25.vat > 0 && (
                          <div>Varav moms 25% (övrigt): {vatBreakdown.vat25.vat} kr</div>
                        )}
                        <div>Varav moms frakt ({Math.round(vatBreakdown.shipping.vatRate * 100)}%): {vatBreakdown.shipping.vat} kr</div>
                      </div>
                    </div>

                    <Button 
                      onClick={handleCheckout}
                      disabled={isCheckingOut}
                      className="w-full"
                      size="lg"
                    >
                      {isCheckingOut ? 'Bearbetar...' : 'Till kassan'}
                    </Button>
                    
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Säker betalning via Stripe
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Shop;