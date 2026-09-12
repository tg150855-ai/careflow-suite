import { ALL_MODULE_KEYS, type ModuleKey } from "@/lib/modules";

/**
 * Modules are open to everyone without module allocation or plan restrictions.
 */
export function useEnabledModules() {
  const enabled = new Set<ModuleKey>(ALL_MODULE_KEYS);

  return {
    loading: false,
    enabled,
    isEnabled: (_key: ModuleKey | null) => true,
    isPathEnabled: (_path: string) => true,
  };
}

