'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeType = 'midnight' | 'cyberpunk' | 'aurora';

interface ThemeContextType {
    theme: ThemeType;
    setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<ThemeType>(() => {
        if (typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem('muzika-theme') as ThemeType;
            return (savedTheme as ThemeType) || 'midnight';
        }
        return 'midnight';
    });

    useEffect(() => {
        // Remove all theme classes
        document.documentElement.classList.remove('theme-midnight', 'theme-cyberpunk', 'theme-aurora');
        // Add current theme class (midnight is the default/root)
        if (theme !== 'midnight') {
            document.documentElement.classList.add(`theme-${theme}`);
        }
        localStorage.setItem('muzika-theme', theme);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
