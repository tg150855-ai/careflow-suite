import { useQuery } from "@tanstack/react-query";
import { ALL_MODULE_KEYS, enabledKeysFrom, fetchDepartmentSettings, moduleForPath, type ModuleKey } from "@/lib/modules";

/** Globally enabled modules from Admin → Settings → Departments. */
export function useEnabledModules() {
  const { data, isLoading } = useQuery({
    queryKey: ["hospital-settings", "departments"],
    queryFn: fetchDepartmentSettings,
    staleTime: 60_000,
  });

  const enabled = data ? enabledKeysFrom(data) : new Set<ModuleKey>(ALL_MODULE_KEYS);

  return {
    loading: isLoading,
    enabled,
    isEnabled: (key: ModuleKey | null) => (key ? enabled.has(key) : true),
    isPathEnabled: (path: string) => {
      const key = moduleForPath(path);
      return key ? enabled.has(key) : true;
    },
  };
}
