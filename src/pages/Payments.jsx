import { useEffect, useState } from "react";
import { Check, X, Clock, CreditCard, Building2, ChevronDown, ChevronUp, Search, Filter, TrendingUp, DollarSign, Users } from "lucide-react";
import supabase from "../supabaseClient";
import Layout from "../components/Layout";

export default function Withdrawals() {
    const [withdrawals, setWithdrawals] = useState([]);
    const [filteredWithdrawals, setFilteredWithdrawals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedWithdrawal, setExpandedWithdrawal] = useState(null);
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        paid: 0,
        totalAmount: 0
    });

    useEffect(() => {
        loadWithdrawals();
    }, []);

    useEffect(() => {
        filterWithdrawals();
        calculateStats();
    }, [statusFilter, searchTerm, withdrawals]);

    async function loadWithdrawals() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("withdrawals")
                .select(`
                    *,
                    creators!withdrawals_creator_fk (
                        full_name,
                        recipient_name,
                        bank_account,
                        bank_name
                    )
                `)
                .order("requested_at", { ascending: false });

            if (error) {
                console.error("Error fetching withdrawals:", error);
                setWithdrawals([]);
            } else {
                const mapped = (data || []).map(w => ({
                    ...w,
                    creator: w.creators || null
                }));
                setWithdrawals(mapped);
            }
        } catch (err) {
            console.error("Unexpected error:", err);
            setWithdrawals([]);
        }
        setLoading(false);
    }

    function filterWithdrawals() {
        let filtered = [...withdrawals];

        if (statusFilter !== "all") {
            filtered = filtered.filter(w => w.status === statusFilter);
        }

        if (searchTerm) {
            filtered = filtered.filter(w =>
                w.creator?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                w.creator?.recipient_name?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        setFilteredWithdrawals(filtered);
    }

    function calculateStats() {
        const total = withdrawals.length;
        const pending = withdrawals.filter(w => w.status === "pending").length;
        const paid = withdrawals.filter(w => w.status === "paid").length;
        const totalAmount = withdrawals
            .filter(w => w.status === "paid")
            .reduce((sum, w) => sum + (w.net_amount || 0), 0);

        setStats({ total, pending, paid, totalAmount });
    }

    function getStatusBadge(status) {
        switch (status) {
            case "pending":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 border border-yellow-200">
                        <Clock className="w-3.5 h-3.5" />
                        Pending
                    </span>
                );
            case "paid":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                        <Check className="w-3.5 h-3.5" />
                        Paid
                    </span>
                );
            default:
                return null;
        }
    }

    async function updateWithdrawalStatus(id, newStatus) {
        try {
            const { error } = await supabase
                .from("withdrawals")
                .update({ status: newStatus, processed_at: new Date().toISOString() })
                .eq("id", id);

            if (!error) {
                loadWithdrawals();
            } else {
                console.error("Error updating withdrawal:", error);
            }
        } catch (err) {
            console.error("Unexpected error:", err);
        }
    }

    return (
        <Layout>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">Withdrawal Requests</h2>
                    <p className="text-gray-500">Manage creator withdrawal requests and payouts</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                                <TrendingUp className="text-white" size={20} />
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm font-medium mb-1">Total Requests</p>
                        <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
                    </div>

                    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center">
                                <Clock className="text-white" size={20} />
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm font-medium mb-1">Pending</p>
                        <p className="text-2xl font-bold text-gray-800">{stats.pending}</p>
                    </div>

                    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                                <Check className="text-white" size={20} />
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm font-medium mb-1">Completed</p>
                        <p className="text-2xl font-bold text-gray-800">{stats.paid}</p>
                    </div>

                    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#58C1D1] to-[#4AA8B8] flex items-center justify-center">
                                <DollarSign className="text-white" size={20} />
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm font-medium mb-1">Total Paid Out</p>
                        <p className="text-2xl font-bold text-gray-800">RM {stats.totalAmount.toFixed(2)}</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search by creator or recipient name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#58C1D1] focus:border-transparent transition-all"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="text-gray-400" size={20} />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#58C1D1] focus:border-transparent bg-white"
                            >
                                <option value="all">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="paid">Paid</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Withdrawals List */}
                {loading ? (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#58C1D1] mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading withdrawal requests...</p>
                    </div>
                ) : filteredWithdrawals.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                        <p className="text-gray-600 text-lg">No withdrawal requests found</p>
                        <p className="text-gray-400 text-sm mt-2">Try adjusting your filters</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredWithdrawals.map(w => (
                            <div key={w.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
                                <div className="p-6">
                                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                        {/* Left Section - Creator Info */}
                                        <div className="flex items-start gap-4 flex-1">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#58C1D1] to-[#4AA8B8] flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                                                {w.creator?.full_name?.charAt(0).toUpperCase() || "C"}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h3 className="text-lg font-bold text-gray-800 truncate">
                                                        {w.creator?.full_name || "Unknown Creator"}
                                                    </h3>
                                                    {getStatusBadge(w.status)}
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                                        <span className="font-medium">Amount: <span className="text-gray-800">RM {w.amount.toFixed(2)}</span></span>
                                                        <span className="text-gray-400">|</span>
                                                        <span className="font-medium">Fee: <span className="text-gray-800">RM {w.fee.toFixed(2)}</span></span>
                                                        <span className="text-gray-400">|</span>
                                                        <span className="font-medium">Net: <span className="text-green-600 font-semibold">RM {w.net_amount.toFixed(2)}</span></span>
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        Requested on: {new Date(w.requested_at).toLocaleDateString("en-MY", {
                                                            year: "numeric",
                                                            month: "long",
                                                            day: "numeric"
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Section - Actions */}
                                        <div className="flex items-center gap-3">
                                            {w.status === "pending" && (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => updateWithdrawalStatus(w.id, "paid")}
                                                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                                                    >
                                                        <Check size={16} />
                                                        Mark as Paid
                                                    </button>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => setExpandedWithdrawal(expandedWithdrawal === w.id ? null : w.id)}
                                                className="flex items-center gap-1.5 text-[#58C1D1] hover:text-[#4AA8B8] font-medium text-sm transition-colors"
                                            >
                                                {expandedWithdrawal === w.id ? (
                                                    <>
                                                        <ChevronUp size={18} />
                                                        Hide
                                                    </>
                                                ) : (
                                                    <>
                                                        <ChevronDown size={18} />
                                                        Bank Details
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Expandable Bank Details Section */}
                                {expandedWithdrawal === w.id && w.creator && (
                                    <div className="border-t border-gray-200 bg-gray-50 p-6">
                                        <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                                            <Building2 size={16} className="text-[#58C1D1]" />
                                            Bank Account Information
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                                                <div className="text-xs font-medium text-gray-500 mb-1">Recipient Name</div>
                                                <div className="text-sm font-semibold text-gray-800">{w.creator.recipient_name || "N/A"}</div>
                                            </div>
                                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                                                <div className="text-xs font-medium text-gray-500 mb-1">Bank Name</div>
                                                <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                                    <Building2 className="w-4 h-4 text-green-600" />
                                                    {w.creator.bank_name || "N/A"}
                                                </div>
                                            </div>
                                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                                                <div className="text-xs font-medium text-gray-500 mb-1">Account Number</div>
                                                <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                                    <CreditCard className="w-4 h-4 text-blue-600" />
                                                    {w.creator.bank_account || "N/A"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
}