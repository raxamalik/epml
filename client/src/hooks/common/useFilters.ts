import { useState, useCallback, useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";

interface UseFiltersProps {
  initialSearch?: string;
  initialStatus?: string;
  initialStore?: string;
  debounceMs?: number;
  onFilterChange?: (filters: FilterState) => void;
}

export interface FilterState {
  search: string;
  status: string;
  store: string;
}

interface UseFiltersReturn {
  search: string;
  status: string;
  store: string;
  debouncedSearch: string;
  setSearch: (value: string) => void;
  setStatus: (value: string) => void;
  setStore: (value: string) => void;
  reset: () => void;
  filters: FilterState;
}

export function useFilters({
  initialSearch = "",
  initialStatus = "all",
  initialStore = "all",
  debounceMs = 500,
  onFilterChange,
}: UseFiltersProps = {}): UseFiltersReturn {
  const [search, setSearchState] = useState(initialSearch);
  const [status, setStatusState] = useState(initialStatus);
  const [store, setStoreState] = useState(initialStore);

  const debouncedSearch = useDebounce(search, debounceMs);

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
  }, []);

  const setStatus = useCallback((value: string) => {
    setStatusState(value);
  }, []);

  const setStore = useCallback((value: string) => {
    setStoreState(value);
  }, []);

  const reset = useCallback(() => {
    setSearchState(initialSearch);
    setStatusState(initialStatus);
    setStoreState(initialStore);
  }, [initialSearch, initialStatus, initialStore]);

  const filters: FilterState = {
    search: debouncedSearch,
    status,
    store,
  };

  useEffect(() => {
    onFilterChange?.(filters);
  }, [debouncedSearch, status, store, onFilterChange]);

  return {
    search,
    status,
    store,
    debouncedSearch,
    setSearch,
    setStatus,
    setStore,
    reset,
    filters,
  };
}

