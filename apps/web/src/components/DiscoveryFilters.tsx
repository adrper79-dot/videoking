'use client';

import { useState } from 'react';

interface DiscoveryFiltersProps {
  onFilter: (filters: DiscoveryFilterState) => void;
  loading?: boolean;
}

export interface DiscoveryFilterState {
  style?: string;
  tool?: string;
  genre?: string;
  search?: string;
}

const STYLES = ['digital', 'traditional', 'mixed_media', '3d'];
const TOOLS = ['procreate', 'clip_studio', 'photoshop', 'krita', 'affinity', 'blender', 'maya', 'traditional_media', 'other'];
const GENRES = ['animation', 'comic', 'illustration', 'character_design', 'concept_art', 'afro_fantasy', 'sci_fi', 'animation_short', 'process_video', 'tutorial', 'speedart', 'other'];

/**
 * Discovery filter UI for browsing videos by style, tool, and genre
 */
export function DiscoveryFilters({ onFilter, loading }: DiscoveryFiltersProps) {
  const [filters, setFilters] = useState<DiscoveryFilterState>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleFilterChange = (key: keyof DiscoveryFilterState, value: string) => {
    const newFilters = { ...filters, [key]: value || undefined };
    setFilters(newFilters);
    onFilter(newFilters);
  };

  const handleReset = () => {
    setFilters({});
    onFilter({});
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search videos..."
          value={filters.search || ''}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          disabled={loading}
          className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 text-white rounded-lg placeholder-slate-400 focus:outline-none focus:border-purple-500 disabled:opacity-50"
        />
      </div>

      {/* Quick Filter Buttons */}
      <div className="mb-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm font-medium text-purple-400 hover:text-purple-300 flex items-center gap-2"
        >
          {showAdvanced ? '▼' : '▶'} Advanced Filters
          {activeFilterCount > 0 && (
            <span className="ml-2 px-2 py-1 bg-purple-600 text-white text-xs rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="space-y-4">
          {/* Style Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Art Style
            </label>
            <select
              value={filters.style || ''}
              onChange={(e) => handleFilterChange('style', e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-md focus:outline-none focus:border-purple-500 disabled:opacity-50"
            >
              <option value="">All Styles</option>
              {STYLES.map((style) => (
                <option key={style} value={style}>
                  {style.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Tool Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Primary Tool
            </label>
            <select
              value={filters.tool || ''}
              onChange={(e) => handleFilterChange('tool', e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-md focus:outline-none focus:border-purple-500 disabled:opacity-50"
            >
              <option value="">All Tools</option>
              {TOOLS.map((tool) => (
                <option key={tool} value={tool}>
                  {tool.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Genre Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Genre
            </label>
            <select
              value={filters.genre || ''}
              onChange={(e) => handleFilterChange('genre', e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-md focus:outline-none focus:border-purple-500 disabled:opacity-50"
            >
              <option value="">All Genres</option>
              {GENRES.map((genre) => (
                <option key={genre} value={genre}>
                  {genre.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Button */}
          {activeFilterCount > 0 && (
            <button
              onClick={handleReset}
              disabled={loading}
              className="w-full px-3 py-2 bg-slate-700 text-gray-300 rounded-md hover:bg-slate-600 disabled:opacity-50 text-sm font-medium"
            >
              Clear All Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
