import { Link, useLocation } from "react-router-dom";
import { Home, Package, Users, CreditCard, BarChart3 } from "lucide-react";

export default function Sidebar() {
    const location = useLocation();

    const links = [
        { name: "Dashboard", path: "/", icon: Home },
        { name: "Products", path: "/products", icon: Package },
        { name: "Users", path: "/users", icon: Users },
        { name: "Payments", path: "/payments", icon: CreditCard },
    ];

    return (
        <aside className="w-64 bg-gradient-to-b from-[#58C1D1] to-[#4AA8B8] p-6 flex flex-col gap-2">
            {/* Logo/Brand */}
            <div className="mb-8 flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <BarChart3 className="text-white" size={24} />
                </div>
                <span className="text-white font-bold text-xl">Admin Panel</span>
            </div>

            {/* Navigation Links */}
            <nav className="flex flex-col gap-1">
                {links.map((link) => {
                    const Icon = link.icon;
                    const isActive = location.pathname === link.path;

                    return (
                        <Link
                            key={link.name}
                            to={link.path}
                            className={`
                                flex items-center gap-3 px-4 py-3 rounded-lg
                                transition-all duration-200
                                ${isActive
                                    ? 'bg-white text-[#58C1D1] shadow-lg font-semibold'
                                    : 'text-white hover:bg-white/10'
                                }
                            `}
                        >
                            <Icon size={20} />
                            <span className="font-medium">{link.name}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom Section */}
            <div className="mt-auto pt-6 border-t border-white/20">
                <div className="text-white/90 text-sm">
                    <p className="font-medium">Admin User</p>
                    <p className="text-white/70 text-xs mt-0.5">admin@example.com</p>
                </div>
            </div>
        </aside>
    );
}