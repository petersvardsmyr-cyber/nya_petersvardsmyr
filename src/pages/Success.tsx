import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Package, Home, Download, Info } from 'lucide-react';

const Success = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  
  useEffect(() => {
    // Clear cart on successful payment
    localStorage.removeItem('cart');
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          
          <h1 className="text-2xl font-heading font-medium text-foreground mb-4">
            Tack för din beställning!
          </h1>
          
          <p className="text-muted-foreground mb-6 leading-relaxed">
            Din betalning har behandlats framgångsrikt. En orderbekräftelse med fullständiga detaljer och momsspecifikation har skickats till din e-postadress.
          </p>
          
          {sessionId && (
            <div className="bg-muted p-4 rounded-lg mb-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Package className="w-4 h-4" />
                Ordernummer
              </div>
              <p className="font-mono text-sm font-medium">
                {sessionId.slice(-8).toUpperCase()}
              </p>
            </div>
          )}

          {/* VAT Information */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 text-left">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-3">
              <Info className="w-4 h-4" />
              <h3 className="font-medium">Momsinformation</h3>
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-400">
              <p>Fullständig momsspecifikation och kvitto finns i din orderbekräftelse via e-post.</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <Button asChild className="w-full">
              <Link to="/butik">
                Fortsätt handla
              </Link>
            </Button>
            
            <Button variant="outline" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Ladda ner kvitto
            </Button>
            
            <Button variant="outline" asChild className="w-full">
              <Link to="/" className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                Tillbaka till start
              </Link>
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground mt-6">
            Har du frågor? Kontakta mig på{' '}
            <a href="mailto:hej@petersvardsmyr.se" className="text-primary hover:underline">
              hej@petersvardsmyr.se
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Success;