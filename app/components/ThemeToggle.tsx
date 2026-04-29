'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

export default function ThemeToggle() {
    const [theme, setTheme] = useState<Theme>('light')
    const [mounted, setMounted] = useState(false)

    const applyTheme = (selectedTheme: Theme) => {
        const isDark = selectedTheme === 'dark'

        document.documentElement.classList.toggle('dark', isDark)
        document.body.classList.toggle('dark', isDark)
        document.documentElement.setAttribute('data-theme', selectedTheme)
        localStorage.setItem('n8n-admin-theme', selectedTheme)
    }

    useEffect(() => {
        const savedTheme = localStorage.getItem('n8n-admin-theme') as Theme | null
        const initialTheme = savedTheme === 'dark' ? 'dark' : 'light'

        setTheme(initialTheme)
        applyTheme(initialTheme)
        setMounted(true)
    }, [])

    const toggleTheme = () => {
        const nextTheme = theme === 'dark' ? 'light' : 'dark'

        setTheme(nextTheme)
        applyTheme(nextTheme)
    }

    if (!mounted) return null

    return (
        <button
            onClick={toggleTheme}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-medium text-gray-200 transition hover:bg-gray-700"
        >
            {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>
    )
}