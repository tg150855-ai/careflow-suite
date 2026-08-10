import { useQuery } from "@tanstack/react-query";
import { ALL_MODULE_KEYS, enabledKeysFrom, fetchDepartmentSettings, moduleForPath, type ModuleKey } from "@/lib/modules";
import { useMyHospital } from "@/lib/use-my-hospital";

/**
 * Modules the current user may actually reach:
 * super-admin allowance for the hospital tenant ∩ hospital's own Settings → Departments.
 */
export function useEnabledModules() {
  const { data, isLoading } = useQuery({
    queryKey: ["hospital-settings", "departments"],
    queryFn: fetchDepartmentSettings,
    staleTime: 60_000,
  });
  const { allowedModules, loading: hospitalLoading } = useMyHospital();

  const local = data ? enabledKeysFrom(data) : new Set<ModuleKey>(ALL_MODULE_KEYS);
  const enabled = allowedModules
    ? new Set<ModuleKey>([...local].filter((k) => allowedModules.has(k)))
    : local;

  return {
    loading: isLoading || hospitalLoading,
    enabled,
    isEnabled: (key: ModuleKey | null) => (key ? enabled.has(key) : true),
    isPathEnabled: (path: string) => {
      const key = moduleForPath(path);
      return key ? enabled.has(key) : true;
    },
  };
}
