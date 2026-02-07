'use client';

import React from 'react';
import type { FilterType, SortOption, SortOrder } from '@/types/storage';

interface FilterControlsProps {
    filterType: FilterType;
    sortOption: SortOption;
    sortOrder: SortOrder;
    onFilterChange: (filter: FilterType) => void;
    onSortChange: (sort: SortOption) => void;
    onSortOrderToggle: () => void;
}

export const FilterControls: React.FC<FilterControlsProps> = ({
    filterType,
    sortOption,
    sortOrder,
    onFilterChange,
    onSortChange,
    onSortOrderToggle
}) => {
    const filterOptions: { value: FilterType; label: string }[] = [
        { value: 'all', label: 'All Songs' },
        { value: 'ai_separated', label: 'AI Separated' },
        { value: 'direct_karaoke', label: 'Direct Karaoke' }
    ];

    const sortOptions: { value: SortOption; label: string }[] = [
        { value: 'date', label: 'Date Added' },
        { value: 'title', label: 'Title' },
        { value: 'artist', label: 'Artist' },
        { value: 'duration', label: 'Duration' }
    ];

    return (
        <div className="flex flex-wrap items-center gap-3">
            {/* Filter Type */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Filter:</span>
                <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                    {filterOptions.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => onFilterChange(option.value)}
                            className={`
                                px-3 py-1.5 rounded-md text-sm font-medium transition-all
                                ${filterType === option.value
                                    ? 'bg-primary text-white shadow-sm'
                                    : 'text-muted-foreground hover:text-white hover:bg-white/5'
                                }
                            `}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Sort Option */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sort by:</span>
                <select
                    value={sortOption}
                    onChange={(e) => onSortChange(e.target.value as SortOption)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                >
                    {sortOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Sort Order Toggle */}
            <button
                onClick={onSortOrderToggle}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
                aria-label={`Sort order: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
            >
                {sortOrder === 'asc' ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                    </svg>
                ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                    </svg>
                )}
                <span>{sortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>
            </button>
        </div>
    );
};
