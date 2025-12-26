import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { DollarSign, ShoppingBag, Users, TrendingUp, Package, UserPlus, ShoppingCart, FileText, Eye } from "lucide-react";
import supabase from "../supabaseClient";

export default function Dashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalRevenue: 0,
        creatorEarnings: 0,
        totalWithdrawn: 0,
        companyBalance: 0,
        productsSold: 0,
        totalUsers: 0,
        activeProducts: 0,
    });
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState([]);

    useEffect(() => {
        loadDashboardData();

        // Subscribe to real-time updates
        const purchasesChannel = supabase
            .channel('purchases_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, () => {
                loadDashboardData();
            })
            .subscribe();

        const usersChannel = supabase
            .channel('users_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
                loadDashboardData();
            })
            .subscribe();

        const productsChannel = supabase
            .channel('products_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
                loadDashboardData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(purchasesChannel);
            supabase.removeChannel(usersChannel);
            supabase.removeChannel(productsChannel);
        };
    }, []);

    async function loadDashboardData() {
        setLoading(true);
        try {
            // Fetch all relevant data in parallel
            const [
                purchasesResult,
                productsResult,
                withdrawalsResult,
                recentPurchasesResult,
                recentUsersResult,
                recentProductsResult,
            ] = await Promise.all([
                // All paid purchases with product info
                supabase.from('purchases').select(`
                id,
                amount,
                created_at,
                product:products(id, owner_id, title)
            `).eq('status', 'paid'),

                // Active products for stats
                supabase.from('products').select('id, status, is_active').eq('is_active', true),

                // Paid withdrawals
                supabase.from('withdrawals').select('net_amount, status').eq('status', 'paid'),

                // Recent purchases for activity feed
                supabase.from('purchases').select(`
                id,
                amount,
                created_at,
                user:users(name, username),
                product:products(title)
            `).eq('status', 'paid').order('created_at', { ascending: false }).limit(5),

                // Recent users
                supabase.from('users').select('id, name, username, created_at').order('created_at', { ascending: false }).limit(3),

                // Recent products
                supabase.from('products').select('id, title, owner_id, created_at, users!products_owner_fk(username)').order('created_at', { ascending: false }).limit(3),
            ]);

            // --- Calculate Stats ---

            // Total Products Sold
            const productsSold = purchasesResult.data?.length || 0;

            // Total Creator Earnings (sum of all purchases amounts)
            const creatorEarnings = purchasesResult.data?.reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0;

            // Total Revenue (sum of paid withdrawals)
            const totalRevenue = withdrawalsResult.data?.reduce((sum, w) => sum + parseFloat(w.net_amount), 0) || 0;

            // Company Balance = earnings not withdrawn yet
            const companyBalance = creatorEarnings - totalRevenue;

            // Active Products
            const activeProducts = productsResult.data?.filter(p => p.status === 'approved').length || 0;

            // Update stats
            setStats({
                totalRevenue,
                creatorEarnings,
                totalWithdrawn: totalRevenue,
                companyBalance,
                productsSold,
                totalUsers: await getTotalUsers(), // helper to count users
                activeProducts,
            });

            // --- Prepare Recent Activity ---
            const activities = [];

            // Recent purchases
            recentPurchasesResult.data?.forEach(purchase => {
                activities.push({
                    id: purchase.id,
                    type: 'purchase',
                    user: purchase.user?.name || 'Unknown User',
                    username: purchase.user?.username,
                    action: `Purchased ${purchase.product?.title || 'a product'}`,
                    time: getTimeAgo(purchase.created_at),
                    amount: `RM ${parseFloat(purchase.amount).toFixed(2)}`,
                    timestamp: new Date(purchase.created_at).getTime(),
                });
            });

            // Recent users
            recentUsersResult.data?.forEach(user => {
                activities.push({
                    id: user.id,
                    type: 'user_joined',
                    user: user.name,
                    username: user.username,
                    action: 'Joined the platform',
                    time: getTimeAgo(user.created_at),
                    timestamp: new Date(user.created_at).getTime(),
                });
            });

            // Recent products
            recentProductsResult.data?.forEach(product => {
                activities.push({
                    id: product.id,
                    type: 'product_created',
                    user: product.users?.username || 'Unknown',
                    action: `Created product "${product.title}"`,
                    time: getTimeAgo(product.created_at),
                    timestamp: new Date(product.created_at).getTime(),
                });
            });

            // Sort activities by timestamp
            activities.sort((a, b) => b.timestamp - a.timestamp);
            setRecentActivity(activities.slice(0, 8));

            // --- Prepare Chart Data (Last 7 Days Revenue) ---
            const last7Days = [];
            const today = new Date();
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];

                const dayRevenue = purchasesResult.data
                    ?.filter(p => p.created_at.startsWith(dateStr))
                    .reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0;

                last7Days.push({
                    date: date.toLocaleDateString('en-MY', { month: 'short', day: 'numeric' }),
                    revenue: dayRevenue,
                });
            }
            setChartData(last7Days);

        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
        setLoading(false);
    }

    // Helper to get total users
    async function getTotalUsers() {
        const { count, error } = await supabase.from('users').select('id', { count: 'exact', head: true });
        if (error) return 0;
        return count || 0;
    }

    function getTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const seconds = Math.floor((now - time) / 1000);

        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        return `${Math.floor(seconds / 86400)} days ago`;
    }

    function getActivityIcon(type) {
        switch (type) {
            case 'purchase':
                return <ShoppingCart className="text-green-500" size={16} />;
            case 'user_joined':
                return <UserPlus className="text-blue-500" size={16} />;
            case 'product_created':
                return <Package className="text-purple-500" size={16} />;
            default:
                return <FileText className="text-gray-500" size={16} />;
        }
    }

    function handleActivityClick(activity) {
        if (activity.type === 'user_joined' && activity.id) {
            navigate('/users');
        } else if (activity.type === 'product_created' && activity.id) {
            navigate('/products');
        } else if (activity.type === 'purchase') {
            navigate('/payments');
        }
    }

    const maxChartValue = Math.max(...chartData.map(d => d.revenue), 100);

    return (
        <Layout>
            <div className="space-y-6">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">Welcome to Admin Dashboard</h2>
                    <p className="text-gray-500">Here's what's happening with your store today.</p>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#58C1D1]"></div>
                    </div>
                ) : (
                    <>
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {/* Total Revenue (Platform Income) */}
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#58C1D1] to-[#4AA8B8] flex items-center justify-center">
                                        <DollarSign className="text-white" size={24} />
                                    </div>
                                    <span className="text-green-500 text-sm font-semibold flex items-center gap-1">
                                        <TrendingUp size={16} />
                                        Live
                                    </span>
                                </div>
                                <h3 className="text-gray-500 text-sm font-medium mb-1">Total Revenue</h3>
                                <p className="text-2xl font-bold text-gray-800">RM {stats.totalRevenue.toFixed(2)}</p>
                                <p className="text-xs text-gray-400 mt-1">Platform total income</p>
                            </div>

                            {/* Products Sold (Count) */}
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#7DE0E6] to-[#58C1D1] flex items-center justify-center">
                                        <ShoppingBag className="text-white" size={24} />
                                    </div>
                                </div>
                                <h3 className="text-gray-500 text-sm font-medium mb-1">Products Sold</h3>
                                <p className="text-2xl font-bold text-gray-800">{stats.productsSold}</p>
                                <p className="text-xs text-gray-400 mt-1">Total purchases made</p>
                            </div>

                            {/* Creator Earnings (Total earned by all creators) */}
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                                        <DollarSign className="text-white" size={24} />
                                    </div>
                                </div>
                                <h3 className="text-gray-500 text-sm font-medium mb-1">Creator Earnings</h3>
                                <p className="text-2xl font-bold text-gray-800">RM {stats.creatorEarnings.toFixed(2)}</p>
                                <p className="text-xs text-gray-400 mt-1">Total earned by creators</p>
                            </div>

                            {/* Company Balance (Held by platform) */}
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                                        <DollarSign className="text-white" size={24} />
                                    </div>
                                </div>
                                <h3 className="text-gray-500 text-sm font-medium mb-1">Company Balance</h3>
                                <p className="text-2xl font-bold text-gray-800">RM {stats.companyBalance.toFixed(2)}</p>
                                <p className="text-xs text-gray-400 mt-1">Held (before withdrawal)</p>
                            </div>

                            {/* Total Users */}
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                                        <Users className="text-white" size={24} />
                                    </div>
                                </div>
                                <h3 className="text-gray-500 text-sm font-medium mb-1">Total Users</h3>
                                <p className="text-2xl font-bold text-gray-800">{stats.totalUsers}</p>
                                <p className="text-xs text-gray-400 mt-1">Registered accounts</p>
                            </div>

                            {/* Active Products */}
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                                        <Package className="text-white" size={24} />
                                    </div>
                                </div>
                                <h3 className="text-gray-500 text-sm font-medium mb-1">Active Products</h3>
                                <p className="text-2xl font-bold text-gray-800">{stats.activeProducts}</p>
                                <p className="text-xs text-gray-400 mt-1">Approved & listed</p>
                            </div>

                            {/* Total Withdrawn */}
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                                        <DollarSign className="text-white" size={24} />
                                    </div>
                                </div>
                                <h3 className="text-gray-500 text-sm font-medium mb-1">Total Withdrawn</h3>
                                <p className="text-2xl font-bold text-gray-800">RM {stats.totalWithdrawn.toFixed(2)}</p>
                                <p className="text-xs text-gray-400 mt-1">Paid out to creators</p>
                            </div>

                            {/* Pending Withdrawals */}
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center">
                                        <DollarSign className="text-white" size={24} />
                                    </div>
                                </div>
                                <h3 className="text-gray-500 text-sm font-medium mb-1">Pending Withdrawals</h3>
                                <p className="text-2xl font-bold text-gray-800">RM {(stats.creatorEarnings - stats.totalWithdrawn).toFixed(2)}</p>
                                <p className="text-xs text-gray-400 mt-1">Awaiting payout</p>
                            </div>
                        </div>

                        {/* Chart Section */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-gray-800">Revenue Last 7 Days</h3>
                                <span className="text-sm text-gray-500">Daily breakdown</span>
                            </div>
                            <div className="space-y-3">
                                {chartData.map((day, index) => (
                                    <div key={index} className="flex items-center gap-3">
                                        <div className="w-20 text-sm text-gray-600 font-medium">
                                            {day.date}
                                        </div>
                                        <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                                            <div
                                                className="bg-gradient-to-r from-[#58C1D1] to-[#4AA8B8] h-full rounded-full transition-all duration-500 flex items-center justify-end pr-3"
                                                style={{ width: `${(day.revenue / maxChartValue) * 100}%` }}
                                            >
                                                {day.revenue > 0 && (
                                                    <span className="text-white text-xs font-semibold">
                                                        RM {day.revenue.toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-gray-800">Recent Activity</h3>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    <span className="text-sm text-gray-500">Live Updates</span>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {recentActivity.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">No recent activity</p>
                                ) : (
                                    recentActivity.map((activity, index) => (
                                        <div
                                            key={index}
                                            onClick={() => handleActivityClick(activity)}
                                            className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-gray-200"
                                        >
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#58C1D1] to-[#4AA8B8] flex items-center justify-center text-white font-semibold flex-shrink-0">
                                                    {activity.user.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        {getActivityIcon(activity.type)}
                                                        <p className="font-medium text-gray-800 truncate">
                                                            {activity.user}
                                                        </p>
                                                    </div>
                                                    <p className="text-sm text-gray-500 truncate">{activity.action}</p>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0 ml-4">
                                                {activity.amount && (
                                                    <p className="font-semibold text-gray-800 text-sm">{activity.amount}</p>
                                                )}
                                                <p className="text-xs text-gray-500">{activity.time}</p>
                                                <Eye className="text-[#58C1D1] ml-auto mt-1" size={14} />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Layout>
    );
}