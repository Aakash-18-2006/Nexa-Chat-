import React from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';

export const NexaSearchBar = ({
  value = '',
  onChange,
  onClear,
  placeholder = 'Search messages, people, groups...',
  autoFocus = false,
  showFilter = true,
  isFilterActive = false,
  onFilterClick,
  filterTitle = 'Filter search results',
  onKeyDown,
  className = '',
  inputRef,
  isLoading = false
}) => {
  return (
    <div className={`nexa-search-poda ${className}`}>
      {/* Outer Rotating Glowing Backdrops */}
      <div className="nexa-search-glow" aria-hidden="true" />
      <div className="nexa-search-darkBorderBg" aria-hidden="true" />
      <div className="nexa-search-white" aria-hidden="true" />
      <div className="nexa-search-border" aria-hidden="true" />

      {/* Main Container */}
      <div className="nexa-search-main">
        {/* Subtle Ambient Red Highlight */}
        <div className="nexa-search-pink-mask" aria-hidden="true" />

        {/* Search Icon with Soft Glow on Focus */}
        <div className="nexa-search-icon">
          <Search className="w-4 h-4" />
        </div>

        {/* Real HTML Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className="nexa-search-input"
          aria-label="Search"
        />

        {/* Futuristic Red Scanning Bar while searching */}
        {isLoading && <div className="nexa-search-scanner" aria-hidden="true" />}

        {/* Right Action: Clear Button (if value exists) & Filter Button */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
          {value && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="p-1 rounded-full text-slate-400 hover:text-[#ff1744] hover:bg-white/10 transition-colors cursor-pointer"
              title="Clear search"
              aria-label="Clear search query"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {showFilter && (
            <div className="relative flex items-center justify-center">
              {/* Animated Filter Border */}
              <div className="nexa-search-filter-border" aria-hidden="true" />
              <button
                type="button"
                onClick={onFilterClick}
                title={filterTitle}
                aria-label={filterTitle}
                aria-pressed={isFilterActive}
                className={`nexa-search-filter-btn ${isFilterActive ? 'active' : ''}`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
