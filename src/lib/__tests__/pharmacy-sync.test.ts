import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeMedicineName, syncPrescribedMedicinesToPharmacy } from "../pharmacy-sync";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
    },
  };
});

describe("pharmacy-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes medicine names correctly", () => {
    expect(normalizeMedicineName("  Paracetamol 650mg  ")).toBe("Paracetamol 650mg");
    expect(normalizeMedicineName('"Azithromycin 500"')).toBe("Azithromycin 500");
    expect(normalizeMedicineName("Tab   Pantoprazole   40mg")).toBe("Tab Pantoprazole 40mg");
    expect(normalizeMedicineName("")).toBe("");
  });

  it("handles empty items gracefully without calling supabase", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    await syncPrescribedMedicinesToPharmacy([], "test-hosp-id");
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("inserts new medicines and invalidates query caches", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        or: vi.fn().mockResolvedValue({
          data: [{ id: "1", name: "Existing Med" }],
          error: null,
        }),
      }),
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "medicines") {
        return {
          select: mockSelect,
          insert: mockInsert,
        };
      }
      return {};
    });

    (supabase.rpc as any).mockResolvedValue({ data: null, error: new Error("RPC not deployed") });

    const mockQc = {
      invalidateQueries: vi.fn(),
    } as any;

    await syncPrescribedMedicinesToPharmacy(
      [
        { name: "Existing Med" }, // Already exists, should skip
        { name: "Brand New Antibiotic 500mg" }, // New, should insert
      ],
      "test-hospital-id",
      mockQc
    );

    // Verify insert was called for the new medicine with active and hospital_id
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Brand New Antibiotic 500mg",
        active: true,
        hospital_id: "test-hospital-id",
      })
    );

    // Verify cache invalidations for medicines, suggestions, and pharmacy dashboard
    expect(mockQc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["medicines"] });
    expect(mockQc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["medicine-suggestions"] });
    expect(mockQc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["pharm-dashboard"] });
  });
});
