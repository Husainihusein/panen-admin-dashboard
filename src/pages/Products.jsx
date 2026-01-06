import { useRef, useEffect, useState } from "react";
import { Search, Filter, Eye, Check, X, Clock, Package, Image } from "lucide-react";
import supabase from "../supabaseClient";
import Layout from "../components/Layout";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export default function Products() {
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [previewModal, setPreviewModal] = useState({ open: false, product: null, url: null, type: null });

    useEffect(() => {
        loadProducts();
    }, []);

    useEffect(() => {
        filterProducts();
    }, [searchTerm, statusFilter, products]);

    async function loadProducts() {
        setLoading(true);
        try {
            let { data, error } = await supabase
                .from("products")
                .select(`
                    *,
                    users!products_owner_fk (
                        username
                    )
                `)
                .eq("is_deleted", false)
                .order("created_at", { ascending: false });

            if (error || !data) {
                const result = await supabase
                    .from("products")
                    .select(`
                        *,
                        users (
                            username
                        )
                    `)
                    .eq("is_deleted", false)
                    .order("created_at", { ascending: false });

                data = result.data;
                error = result.error;
            }

            if (error || !data) {
                const { data: productsOnly, error: productsError } = await supabase
                    .from("products")
                    .select("*")
                    .eq("is_deleted", false)
                    .order("created_at", { ascending: false });

                if (productsError) {
                    console.error("Products fetch failed:", productsError);
                    setProducts([]);
                    setLoading(false);
                    return;
                }

                const userIds = [...new Set(productsOnly.map(p => p.owner_id).filter(Boolean))];

                if (userIds.length > 0) {
                    const { data: usersData, error: usersError } = await supabase
                        .from("users")
                        .select("id, username")
                        .in("id", userIds);

                    if (!usersError && usersData) {
                        const userMap = {};
                        usersData.forEach(user => {
                            userMap[user.id] = user;
                        });

                        const mappedData = productsOnly.map(item => ({
                            ...item,
                            owner: userMap[item.owner_id] || null
                        }));

                        setProducts(mappedData);
                        setLoading(false);
                        return;
                    }
                }

                setProducts(productsOnly.map(item => ({ ...item, owner: null })));
            } else {
                const mappedData = (data || []).map(item => ({
                    ...item,
                    owner: item.users || null
                }));

                setProducts(mappedData);
            }
        } catch (err) {
            console.error("Unexpected error:", err);
            setProducts([]);
        }

        setLoading(false);
    }

    function filterProducts() {
        let filtered = [...products];

        if (searchTerm) {
            filtered = filtered.filter(
                (p) =>
                    p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    p.owner?.username?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (statusFilter !== "all") {
            filtered = filtered.filter((p) => p.status === statusFilter);
        }

        setFilteredProducts(filtered);
    }

    async function updateStatus(productId, newStatus) {
        try {
            const { error } = await supabase
                .from("products")
                .update({ status: newStatus })
                .eq("id", productId);

            if (!error) {
                loadProducts();
            } else {
                console.error("Error updating status:", error);
            }
        } catch (err) {
            console.error("Unexpected error:", err);
        }
    }

    function getStatusBadge(status) {
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
                        In Review
                    </span>
                );
        }
    }

    const PdfPreview = ({ url }) => {
        const containerRef = useRef(null);
        const [width, setWidth] = useState(600);

        useEffect(() => {
            if (containerRef.current) {
                setWidth(containerRef.current.offsetWidth);
            }
            const handleResize = () => {
                if (containerRef.current) setWidth(containerRef.current.offsetWidth);
            };
            window.addEventListener("resize", handleResize);
            return () => window.removeEventListener("resize", handleResize);
        }, []);

        return (
            <div ref={containerRef} className="w-full h-96 overflow-auto mt-2 border">
                <Document file={url}>
                    <Page pageNumber={1} width={width} />
                </Document>
            </div>
        );
    };

    const stats = {
        total: products.length,
        approved: products.filter((p) => p.status === "approved").length,
        review: products.filter((p) => p.status === "review").length,
        rejected: products.filter((p) => p.status === "rejected").length,
    };

    // --- generate signed URL for private files ---
    async function getSignedUrl(filePath) {
        try {
            console.log('Original file path:', filePath);

            // Parse the URL and extract path segments
            const url = new URL(filePath);
            const pathSegments = url.pathname.split('/').filter(Boolean);

            console.log('Path segments:', pathSegments);

            // Find the index of 'product-files' in the path
            const bucketIndex = pathSegments.findIndex(segment => segment === 'product-files');

            if (bucketIndex === -1 || bucketIndex >= pathSegments.length - 1) {
                throw new Error('Invalid product-files URL format');
            }

            // Get everything AFTER 'product-files'
            const filePathInBucket = pathSegments.slice(bucketIndex + 1).join('/');

            console.log('File path in bucket:', filePathInBucket);

            const { data, error } = await supabase
                .storage
                .from("product-files")
                .createSignedUrl(filePathInBucket, 3600); // Valid for 1 hour

            if (error) {
                console.error('Signed URL error:', error);
                throw error;
            }

            if (!data?.signedUrl) {
                throw new Error('Failed to generate signed URL');
            }

            console.log('✅ Signed URL generated successfully');
            return data.signedUrl;
        } catch (err) {
            console.error('Error getting signed URL:', err);
            alert(`Error accessing file: ${err.message}\n\nCheck console for details.`);
            return null;
        }
    }

    async function handleViewProduct(item) {
        let url = item.file_url || item.video_url || item.thumbnail_url;

        if (!url) {
            alert('No file URL available for this product');
            return;
        }

        // Determine file type
        let fileType = 'unknown';
        const lowerUrl = url.toLowerCase();

        if (lowerUrl.endsWith('.pdf')) {
            fileType = 'pdf';
        } else if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
            fileType = 'image';
        } else if (lowerUrl.match(/\.(mp4|webm|mov)$/)) {
            fileType = 'video';
        } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            fileType = 'youtube';
        }

        // For public Supabase files, use directly
        // For private files or external links, open in new tab
        const isPublicSupabase = url.includes('/object/public/');

        if (fileType === 'pdf' || fileType === 'image' || fileType === 'video') {
            // Show in modal for review
            setPreviewModal({
                open: true,
                product: item,
                url: url,
                type: fileType
            });
        } else {
            // External links or unknown types - open in new tab
            window.open(url, "_blank", "noopener,noreferrer");
        }
    }

    function closePreview() {
        setPreviewModal({ open: false, product: null, url: null, type: null });
    }
    return (
        <Layout>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">Products Management</h2>
                    <p className="text-gray-500">Review and approve digital products from creators</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                                <Package className="text-white" size={20} />
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm font-medium mb-1">Total Products</p>
                        <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                                <Check className="text-white" size={20} />
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm font-medium mb-1">Approved</p>
                        <p className="text-2xl font-bold text-gray-800">{stats.approved}</p>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center">
                                <Clock className="text-white" size={20} />
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm font-medium mb-1">In Review</p>
                        <p className="text-2xl font-bold text-gray-800">{stats.review}</p>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                                <X className="text-white" size={20} />
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm font-medium mb-1">Rejected</p>
                        <p className="text-2xl font-bold text-gray-800">{stats.rejected}</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search by title, category, or creator..."
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
                                <option value="review">In Review</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Products List */}
                {loading ? (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#58C1D1] mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading products...</p>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                        <p className="text-gray-600 text-lg">No products found</p>
                        <p className="text-gray-400 text-sm mt-2">Try adjusting your filters</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredProducts.map((item) => {
                            const ownerName = item.owner?.username || "Unknown User";

                            return (
                                <div
                                    key={item.id}
                                    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all"
                                >
                                    <div className="p-6">
                                        <div className="flex flex-col lg:flex-row gap-4">
                                            {/* Product Image */}
                                            <div className="w-full lg:w-32 h-32 flex-shrink-0">
                                                {item.thumbnail_url ? (
                                                    <img
                                                        src={item.thumbnail_url}
                                                        alt={item.title}
                                                        className="w-full h-full object-cover rounded-lg"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
                                                        <Image className="text-gray-400" size={32} />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Product Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-lg font-bold text-gray-800 truncate mb-1">
                                                            {item.title}
                                                        </h3>
                                                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                                                            <span className="flex items-center gap-1">
                                                                <span className="font-medium">Category:</span>
                                                                <span>{item.category || "—"}</span>
                                                            </span>
                                                            <span className="text-gray-300">|</span>
                                                            <span className="flex items-center gap-1">
                                                                <span className="font-medium">Creator:</span>
                                                                <span>{ownerName}</span>
                                                            </span>
                                                            <span className="text-gray-300">|</span>
                                                            <span className="flex items-center gap-1">
                                                                <span className="font-medium">Price:</span>
                                                                <span className="font-semibold text-[#58C1D1]">
                                                                    RM {item.price}
                                                                </span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {getStatusBadge(item.status)}
                                                </div>

                                                {/* Description */}
                                                {item.description && (
                                                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                                                        {item.description}
                                                    </p>
                                                )}

                                                {/* Actions */}
                                                <div className="flex flex-wrap gap-2">
                                                    <select
                                                        value={item.status}
                                                        onChange={(e) => updateStatus(item.id, e.target.value)}
                                                        className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#58C1D1] focus:border-transparent bg-white"
                                                    >
                                                        <option value="review">In Review</option>
                                                        <option value="approved">Approve</option>
                                                        <option value="rejected">Reject</option>
                                                    </select>
                                                    <button
                                                        onClick={() => handleViewProduct(item)}
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#58C1D1] text-white rounded-lg text-sm font-medium hover:bg-[#4AA8B8] transition-colors"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                        View Product
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                )}

                {/* Preview Modal */}
                {previewModal.open && (
                    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                            {/* Modal Header */}
                            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">{previewModal.product.title}</h3>
                                    <p className="text-sm text-gray-500 mt-1">Review product content</p>
                                </div>
                                <button
                                    onClick={closePreview}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-auto p-6">
                                {previewModal.type === 'pdf' && (
                                    <div className="w-full h-[70vh]">
                                        <iframe
                                            src={`${previewModal.url}#toolbar=0&navpanes=0&scrollbar=1`}
                                            className="w-full h-full border rounded-lg"
                                            title="PDF Preview"
                                        />
                                    </div>
                                )}

                                {previewModal.type === 'image' && (
                                    <div className="flex items-center justify-center">
                                        <img
                                            src={previewModal.url}
                                            alt={previewModal.product.title}
                                            className="max-w-full max-h-[70vh] object-contain rounded-lg"
                                        />
                                    </div>
                                )}

                                {previewModal.type === 'video' && (
                                    <div className="flex items-center justify-center">
                                        <video
                                            controls
                                            className="max-w-full max-h-[70vh] rounded-lg"
                                            src={previewModal.url}
                                        >
                                            Your browser does not support video playback.
                                        </video>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 border-t border-gray-200 flex justify-between items-center">
                                <div className="text-sm text-gray-600">
                                    <span className="font-medium">Status:</span> {getStatusBadge(previewModal.product.status)}
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            updateStatus(previewModal.product.id, 'rejected');
                                            closePreview();
                                        }}
                                        className="px-5 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors inline-flex items-center gap-2"
                                    >
                                        <X className="w-4 h-4" />
                                        Reject
                                    </button>
                                    <button
                                        onClick={() => {
                                            updateStatus(previewModal.product.id, 'approved');
                                            closePreview();
                                        }}
                                        className="px-5 py-2.5 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors inline-flex items-center gap-2"
                                    >
                                        <Check className="w-4 h-4" />
                                        Approve
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
