import { useEffect, useState } from "react";
import { Search, Filter, User, Mail, Phone, CreditCard, Building2, FileText, UserCheck, Users as UsersIcon, ChevronDown, ChevronUp, Check, X, Clock } from "lucide-react";
import supabase from "../supabaseClient";
import Layout from "../components/Layout";

export default function Users() {
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [userTypeFilter, setUserTypeFilter] = useState("all");
    const [expandedUser, setExpandedUser] = useState(null);

    useEffect(() => {
        loadUsers();
    }, []);

    useEffect(() => {
        filterUsers();
    }, [searchTerm, statusFilter, userTypeFilter, users]);

    async function loadUsers() {
        setLoading(true);

        try {
            let { data, error } = await supabase
                .from("users")
                .select(`
                    *,
                    creators!creators_user_id_fkey (
                        ic_number,
                        full_name,
                        recipient_name,
                        bank_account,
                        bank_name,
                        status,
                        created_at
                    )
                `)
                .order("created_at", { ascending: false });

            if (error || !data) {
                const result = await supabase
                    .from("users")
                    .select(`
                        *,
                        creators (
                            ic_number,
                            full_name,
                            recipient_name,
                            bank_account,
                            bank_name,
                            status,
                            created_at
                        )
                    `)
                    .order("created_at", { ascending: false });

                data = result.data;
                error = result.error;
            }

            if (error || !data) {
                const { data: usersOnly, error: usersError } = await supabase
                    .from("users")
                    .select("*")
                    .order("created_at", { ascending: false });

                if (usersError) {
                    console.error("Users fetch failed:", usersError);
                    setUsers([]);
                    setLoading(false);
                    return;
                }

                const userIds = usersOnly.map(u => u.id).filter(Boolean);

                if (userIds.length > 0) {
                    const { data: creatorsData, error: creatorsError } = await supabase
                        .from("creators")
                        .select("*")
                        .in("user_id", userIds);

                    if (!creatorsError && creatorsData) {
                        const creatorMap = {};
                        creatorsData.forEach(creator => {
                            creatorMap[creator.user_id] = creator;
                        });

                        const mappedData = usersOnly.map(user => ({
                            ...user,
                            creator: creatorMap[user.id] || null
                        }));

                        setUsers(mappedData);
                        setLoading(false);
                        return;
                    }
                }

                setUsers(usersOnly.map(user => ({ ...user, creator: null })));
            } else {
                const mappedData = (data || []).map(user => ({
                    ...user,
                    creator: user.creators || null
                }));

                setUsers(mappedData);
            }
        } catch (err) {
            console.error("Unexpected error:", err);
            setUsers([]);
        }

        setLoading(false);
    }

    function filterUsers() {
        let filtered = [...users];

        if (searchTerm) {
            filtered = filtered.filter(
                (u) =>
                    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    u.phone_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    u.creator?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    u.creator?.ic_number?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (userTypeFilter === "creators") {
            filtered = filtered.filter((u) => u.creator !== null);
        } else if (userTypeFilter === "regular") {
            filtered = filtered.filter((u) => u.creator === null);
        }

        if (statusFilter !== "all") {
            filtered = filtered.filter((u) => u.creator?.status === statusFilter);
        }

        setFilteredUsers(filtered);
    }

    async function updateCreatorStatus(userId, newStatus) {
        try {
            const { error } = await supabase
                .from("creators")
                .update({ status: newStatus })
                .eq("user_id", userId);

            if (!error) {
                loadUsers();
            } else {
                console.error("Error updating status:", error);
            }
        } catch (err) {
            console.error("Unexpected error:", err);
        }
    }

    function getStatusBadge(status) {
        if (!status) return null;

        switch (status) {
            case "approved":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                        <Check className="w-3.5 h-3.5" />
                        Approved
                    </span>
                );
            case "rejected":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                        <X className="w-3.5 h-3.5" />
                        Rejected
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 border border-yellow-200">
                        <Clock className="w-3.5 h-3.5" />
                        Pending
                    </span>
                );
        }
    }

    const stats = {
        total: users.length,
        creators: users.filter(u => u.creator !== null).length,
        regular: users.filter(u => u.creator === null).length,
        approved: users.filter((u) => u.creator?.status === "approved").length,
        pending: users.filter((u) => u.creator?.status === "pending").length,
        rejected: users.filter((u) => u.creator?.status === "rejected").length,
    };

    return (
        <Layout>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">Users & Creators Management</h2>
                    <p className="text-gray-500">Manage user accounts and review creator applications</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                                <UsersIcon className="text-white" size={18} />
                            </div>
                        </div>
                        <p className="text-gray-500 text-xs font-medium mb-1">Total Users</p>
                        <p className="text-xl font-bold text-gray-800">{stats.total}</p>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#58C1D1] to-[#4AA8B8] flex items-center justify-center">
                                <UserCheck className="text-white" size={18} />
                            </div>
                        </div>
                        <p className="text-gray-500 text-xs font-medium mb-1">Creators</p>
                        <p className="text-xl font-bold text-gray-800">{stats.creators}</p>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                                <User className="text-white" size={18} />
                            </div>
                        </div>
                        <p className="text-gray-500 text-xs font-medium mb-1">Regular</p>
                        <p className="text-xl font-bold text-gray-800">{stats.regular}</p>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center">
                                <Clock className="text-white" size={18} />
                            </div>
                        </div>
                        <p className="text-gray-500 text-xs font-medium mb-1">Pending</p>
                        <p className="text-xl font-bold text-gray-800">{stats.pending}</p>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                                <Check className="text-white" size={18} />
                            </div>
                        </div>
                        <p className="text-gray-500 text-xs font-medium mb-1">Approved</p>
                        <p className="text-xl font-bold text-gray-800">{stats.approved}</p>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                                <X className="text-white" size={18} />
                            </div>
                        </div>
                        <p className="text-gray-500 text-xs font-medium mb-1">Rejected</p>
                        <p className="text-xl font-bold text-gray-800">{stats.rejected}</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                    <div className="flex flex-col lg:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search by name, email, username, phone..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#58C1D1] focus:border-transparent transition-all"
                            />
                        </div>
                        <div className="flex gap-3">
                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                                <select
                                    value={userTypeFilter}
                                    onChange={(e) => setUserTypeFilter(e.target.value)}
                                    className="pl-10 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#58C1D1] focus:border-transparent bg-white"
                                >
                                    <option value="all">All Users</option>
                                    <option value="creators">Creators Only</option>
                                    <option value="regular">Regular Users</option>
                                </select>
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#58C1D1] focus:border-transparent bg-white"
                            >
                                <option value="all">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Users List */}
                {loading ? (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#58C1D1] mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading users...</p>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                        <UsersIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-600 text-lg">No users found</p>
                        <p className="text-gray-400 text-sm mt-2">Try adjusting your filters</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredUsers.map((user) => (
                            <div
                                key={user.id}
                                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all"
                            >
                                {/* Main User Info */}
                                <div className="p-6">
                                    <div className="flex flex-col lg:flex-row gap-4">
                                        {/* Left Section - User Avatar & Info */}
                                        <div className="flex items-start gap-4 flex-1">
                                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#58C1D1] to-[#4AA8B8] flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                                                {user.name?.charAt(0).toUpperCase() || "U"}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                    <h3 className="text-lg font-bold text-gray-800">
                                                        {user.name}
                                                    </h3>
                                                    {user.creator ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-[#58C1D1] to-[#4AA8B8] text-white">
                                                            <UserCheck className="w-3 h-3" />
                                                            Creator
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                                            <User className="w-3 h-3" />
                                                            User
                                                        </span>
                                                    )}
                                                    {user.creator && getStatusBadge(user.creator.status)}
                                                </div>
                                                <p className="text-sm text-gray-500 mb-3">@{user.username}</p>

                                                {/* Contact Info */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                                        <Mail className="w-4 h-4 text-[#58C1D1]" />
                                                        <span>{user.email}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                                        <Phone className="w-4 h-4 text-green-500" />
                                                        <span>{user.phone_number || "No phone"}</span>
                                                    </div>
                                                </div>

                                                {/* Bio */}
                                                {user.bio && user.bio !== 'this is my bio' && (
                                                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                                        <p className="text-sm text-gray-700 italic">"{user.bio}"</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right Section - Actions */}
                                        <div className="flex flex-col gap-2 lg:items-end">
                                            {user.creator && (
                                                <>
                                                    <select
                                                        value={user.creator.status}
                                                        onChange={(e) => updateCreatorStatus(user.id, e.target.value)}
                                                        className="w-full lg:w-40 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#58C1D1] focus:border-transparent bg-white font-medium"
                                                    >
                                                        <option value="pending">Set Pending</option>
                                                        <option value="approved">Approve</option>
                                                        <option value="rejected">Reject</option>
                                                    </select>
                                                    <button
                                                        onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                                                        className="flex items-center gap-2 text-sm text-[#58C1D1] hover:text-[#4AA8B8] font-medium transition-colors"
                                                    >
                                                        {expandedUser === user.id ? (
                                                            <>
                                                                <ChevronUp size={18} />
                                                                Hide Details
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ChevronDown size={18} />
                                                                View Details
                                                            </>
                                                        )}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Expandable Creator Details */}
                                {user.creator && expandedUser === user.id && (
                                    <div className="border-t border-gray-200 bg-gray-50 p-6">
                                        <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                                            <FileText size={16} className="text-[#58C1D1]" />
                                            Creator Application Details
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                                                <div className="text-xs font-medium text-gray-500 mb-1">Full Legal Name</div>
                                                <div className="text-sm font-semibold text-gray-800">{user.creator.full_name || "N/A"}</div>
                                            </div>
                                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                                                <div className="text-xs font-medium text-gray-500 mb-1">IC Number</div>
                                                <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                                    <CreditCard className="w-4 h-4 text-blue-600" />
                                                    {user.creator.ic_number || "N/A"}
                                                </div>
                                            </div>
                                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                                                <div className="text-xs font-medium text-gray-500 mb-1">Recipient Name</div>
                                                <div className="text-sm font-semibold text-gray-800">{user.creator.recipient_name || "N/A"}</div>
                                            </div>
                                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                                                <div className="text-xs font-medium text-gray-500 mb-1">Bank Name</div>
                                                <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                                    <Building2 className="w-4 h-4 text-green-600" />
                                                    {user.creator.bank_name || "N/A"}
                                                </div>
                                            </div>
                                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                                                <div className="text-xs font-medium text-gray-500 mb-1">Account Number</div>
                                                <div className="text-sm font-semibold text-gray-800">{user.creator.bank_account || "N/A"}</div>
                                            </div>
                                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                                                <div className="text-xs font-medium text-gray-500 mb-1">Applied On</div>
                                                <div className="text-sm font-semibold text-gray-800">
                                                    {new Date(user.creator.created_at).toLocaleDateString('en-MY', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
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