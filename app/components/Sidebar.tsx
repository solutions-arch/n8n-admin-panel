// app/components/Sidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
    { label: 'Executions', href: '/', icon: '⚡' },
    { label: 'Workflows', href: '/workflows', icon: '📋' },
    { label: 'Admin Panel', href: '/admin', icon: '⚙️' },
]

export default function Sidebar() {
    const pathname = usePathname()

    return (
        <aside className="w-56 bg-gray-900 text-white flex flex-col shrink-0">
            <div className="p-6 border-b border-gray-700">
                <h1 className="text-lg font-bold tracking-tight">n8n Admin</h1>
                <p className="text-xs text-gray-400 mt-0.5">Execution Monitor</p>
            </div>

            <nav className="p-4 flex-1">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Navigation</p>
                {navItems.map(item => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 transition-colors ${pathname === item.href
                                ? 'bg-gray-700 text-white'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                            }`}
                    >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                    </Link>
                ))}
            </nav>

            <div className="p-4 border-t border-gray-700">
                <p className="text-xs text-gray-500">n8n Admin Panel</p>
            </div>
        </aside>
    )
}