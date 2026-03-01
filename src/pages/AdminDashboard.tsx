import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FileText, BookOpen, Mail, Plus, Users, Eye, Package, Bell, TrendingUp, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface DashboardStats {
  totalPosts: number;
  publishedPosts: number;
  totalProducts: number;
  totalSubscribers: number;
  totalOrders: number;
  monthlyRevenue: number;
  previousMonthRevenue: number;
  recentOrders: any[];
  recentSubscribers: any[];
  recentPosts: any[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalPosts: 0,
    publishedPosts: 0,
    totalProducts: 0,
    totalSubscribers: 0,
    totalOrders: 0,
    monthlyRevenue: 0,
    previousMonthRevenue: 0,
    recentOrders: [],
    recentSubscribers: [],
    recentPosts: []
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Get current month start and previous month start
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

      // Fetch all blog posts for stats
      const { data: allPostsData, error: allPostsError } = await supabase
        .from('blog_posts')
        .select('id, is_published');
      
      if (allPostsError) throw allPostsError;

      // Fetch recent blog posts for display
      const { data: recentPostsData, error: recentPostsError } = await supabase
        .from('blog_posts')
        .select('id, title, is_published, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (recentPostsError) throw recentPostsError;

      // Fetch products stats
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id');
      
      if (productsError) throw productsError;

      // Fetch all active subscribers for stats
      const { data: allSubscribersData, error: allSubscribersError } = await supabase
        .from('newsletter_subscribers')
        .select('id')
        .eq('is_active', true);
      
      if (allSubscribersError) throw allSubscribersError;

      // Fetch recent subscribers for display
      const { data: recentSubscribersData, error: recentSubscribersError } = await supabase
        .from('newsletter_subscribers')
        .select('id, email, name, subscribed_at, is_active')
        .eq('is_active', true)
        .order('subscribed_at', { ascending: false })
        .limit(5);
      
      if (recentSubscribersError) throw recentSubscribersError;

      // Fetch all orders stats
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, email, total_amount, created_at, status')
        .order('created_at', { ascending: false });
      
      if (ordersError) throw ordersError;

      // Calculate monthly revenue
      const currentMonthOrders = ordersData?.filter(
        order => order.created_at >= currentMonthStart && order.status === 'completed'
      ) || [];
      
      const previousMonthOrders = ordersData?.filter(
        order => order.created_at >= previousMonthStart && 
                 order.created_at <= previousMonthEnd && 
                 order.status === 'completed'
      ) || [];

      const monthlyRevenue = currentMonthOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
      const previousMonthRevenue = previousMonthOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

      const totalPosts = allPostsData?.length || 0;
      const publishedPosts = allPostsData?.filter(post => post.is_published).length || 0;
      const totalProducts = productsData?.length || 0;
      const totalSubscribers = allSubscribersData?.length || 0;
      const totalOrders = ordersData?.filter(o => o.status !== 'pending').length || 0;

      setStats({
        totalPosts,
        publishedPosts,
        totalProducts,
        totalSubscribers,
        totalOrders,
        monthlyRevenue,
        previousMonthRevenue,
        recentOrders: ordersData?.filter(o => o.status !== 'pending').slice(0, 5) || [],
        recentSubscribers: recentSubscribersData || [],
        recentPosts: recentPostsData || []
      });
    } catch (error) {
      toast({
        title: "Fel vid hämtning av statistik",
        description: "Kunde inte hämta dashboard-statistik.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <div>Laddar...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Översikt</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link to="/admin/posts">
          <Card className="cursor-pointer transition-all hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Blogginlägg
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPosts}</div>
              <p className="text-xs text-muted-foreground">
                {stats.publishedPosts} publicerade
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/products">
          <Card className="cursor-pointer transition-all hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Produkter
              </CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProducts}</div>
              <p className="text-xs text-muted-foreground">
                I butiken
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/orders">
          <Card className="cursor-pointer transition-all hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Beställningar
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
              <p className="text-xs text-muted-foreground">
                Totalt antal
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/newsletter/subscribers">
          <Card className="cursor-pointer transition-all hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Prenumeranter
              </CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSubscribers}</div>
              <p className="text-xs text-muted-foreground">
                Aktiva prenumeranter
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Revenue Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Intäkter denna månad
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats.monthlyRevenue / 100).toFixed(0)} kr</div>
            <p className="text-xs text-muted-foreground">
              {stats.monthlyRevenue > stats.previousMonthRevenue ? (
                <span className="text-green-600">
                  +{((stats.monthlyRevenue - stats.previousMonthRevenue) / 100).toFixed(0)} kr från förra månaden
                </span>
              ) : stats.monthlyRevenue < stats.previousMonthRevenue ? (
                <span className="text-red-600">
                  {((stats.monthlyRevenue - stats.previousMonthRevenue) / 100).toFixed(0)} kr från förra månaden
                </span>
              ) : (
                <span>Samma som förra månaden</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Webbplats
            </CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Live</div>
            <p className="text-xs text-muted-foreground">
              <Link to="/" className="text-primary hover:underline">Visa webbplats</Link>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Senaste beställningar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentOrders.length > 0 ? (
              <div className="space-y-2">
                {stats.recentOrders.slice(0, 5).map((order) => (
                  <div key={order.id} className="flex justify-between items-start text-sm border-b pb-2 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium truncate">{order.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), 'dd MMM yyyy', { locale: sv })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{(order.total_amount / 100).toFixed(0)} kr</p>
                      <p className="text-xs text-muted-foreground capitalize">{order.status}</p>
                    </div>
                  </div>
                ))}
                <Link to="/admin/orders">
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    Visa alla
                  </Button>
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Inga beställningar än</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Nya prenumeranter
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentSubscribers.length > 0 ? (
              <div className="space-y-2">
                {stats.recentSubscribers.slice(0, 5).map((subscriber) => (
                  <div key={subscriber.id} className="flex justify-between items-start text-sm border-b pb-2 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium truncate">{subscriber.name || subscriber.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{subscriber.email}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(subscriber.subscribed_at), 'dd MMM', { locale: sv })}
                    </p>
                  </div>
                ))}
                <Link to="/admin/newsletter/subscribers">
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    Visa alla
                  </Button>
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Inga prenumeranter än</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Senaste inlägg
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentPosts.length > 0 ? (
              <div className="space-y-2">
                {stats.recentPosts.slice(0, 5).map((post) => (
                  <div key={post.id} className="flex justify-between items-start text-sm border-b pb-2 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium line-clamp-1">{post.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(post.created_at), 'dd MMM yyyy', { locale: sv })}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${post.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {post.is_published ? 'Publicerad' : 'Utkast'}
                    </span>
                  </div>
                ))}
                <Link to="/admin/posts">
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    Visa alla
                  </Button>
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Inga inlägg än</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Blogginlägg
            </CardTitle>
            <CardDescription>
              Hantera dina blogginlägg och artiklar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/admin/posts">
              <Button variant="outline" className="w-full">
                Visa alla inlägg
              </Button>
            </Link>
            <Link to="/admin/posts/new">
              <Button className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Nytt inlägg
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Butik
            </CardTitle>
            <CardDescription>
              Hantera produkter, beställningar och nyhetsbrev
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/admin/products">
              <Button variant="outline" className="w-full">
                Hantera produkter
              </Button>
            </Link>
            <Link to="/admin/orders">
              <Button variant="outline" className="w-full">
                Visa beställningar
              </Button>
            </Link>
            <Link to="/admin/newsletter">
              <Button variant="outline" className="w-full">
                Nyhetsbrevsprenumeranter
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* E-postnotiser Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              E-postnotiser
            </CardTitle>
            <CardDescription>
              Hantera e-postutskick och notifikationer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Link to="/admin/order-notifications">
                <Button variant="outline" className="w-full justify-start">
                  <Package className="h-4 w-4 mr-2" />
                  Orderbekräftelser
                </Button>
              </Link>
              <Link to="/admin/newsletter-notifications">
                <Button variant="outline" className="w-full justify-start">
                  <Mail className="h-4 w-4 mr-2" />
                  Nyhetsbrevbekräftelser
                </Button>
              </Link>
              <Link to="/admin/email-settings">
                <Button variant="outline" className="w-full justify-start">
                  <Bell className="h-4 w-4 mr-2" />
                  E-postinställningar
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}