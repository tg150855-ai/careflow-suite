export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          parent_id: string | null
          type: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          type: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          type?: string
        }
        Relationships: []
      }
      admission_notes: {
        Row: {
          admission_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string
        }
        Insert: {
          admission_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note: string
        }
        Update: {
          admission_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "admission_notes_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
        ]
      }
      admissions: {
        Row: {
          admission_no: string
          admitted_at: string
          attender_mobile: string | null
          attender_name: string | null
          bed_id: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          discharged_at: string | null
          doctor_id: string
          emergency_contact: string | null
          estimated_stay_days: number | null
          id: string
          initial_diagnosis: string | null
          insurance_policy_no: string | null
          insurance_provider: string | null
          is_emergency: boolean
          notes: string | null
          patient_id: string
          reason: string | null
          status: Database["public"]["Enums"]["admission_status"]
          updated_at: string
          ward_id: string | null
        }
        Insert: {
          admission_no?: string
          admitted_at?: string
          attender_mobile?: string | null
          attender_name?: string | null
          bed_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          discharged_at?: string | null
          doctor_id: string
          emergency_contact?: string | null
          estimated_stay_days?: number | null
          id?: string
          initial_diagnosis?: string | null
          insurance_policy_no?: string | null
          insurance_provider?: string | null
          is_emergency?: boolean
          notes?: string | null
          patient_id: string
          reason?: string | null
          status?: Database["public"]["Enums"]["admission_status"]
          updated_at?: string
          ward_id?: string | null
        }
        Update: {
          admission_no?: string
          admitted_at?: string
          attender_mobile?: string | null
          attender_name?: string | null
          bed_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          discharged_at?: string | null
          doctor_id?: string
          emergency_contact?: string | null
          estimated_stay_days?: number | null
          id?: string
          initial_diagnosis?: string | null
          insurance_policy_no?: string | null
          insurance_provider?: string | null
          is_emergency?: boolean
          notes?: string | null
          patient_id?: string
          reason?: string | null
          status?: Database["public"]["Enums"]["admission_status"]
          updated_at?: string
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admissions_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          messages: Json | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          messages?: Json | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          messages?: Json | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_insights: {
        Row: {
          body: Json
          category: string
          confidence: number | null
          created_by: string | null
          generated_at: string
          id: string
          title: string
        }
        Insert: {
          body?: Json
          category: string
          confidence?: number | null
          created_by?: string | null
          generated_at?: string
          id?: string
          title: string
        }
        Update: {
          body?: Json
          category?: string
          confidence?: number | null
          created_by?: string | null
          generated_at?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      ai_recommendations: {
        Row: {
          category: string
          confidence: number | null
          created_at: string
          created_by: string | null
          id: string
          recommendation: string
          status: string | null
          target_id: string | null
          target_type: string | null
          title: string
        }
        Insert: {
          category: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          recommendation: string
          status?: string | null
          target_id?: string | null
          target_type?: string | null
          title: string
        }
        Update: {
          category?: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          recommendation?: string
          status?: string | null
          target_id?: string | null
          target_type?: string | null
          title?: string
        }
        Relationships: []
      }
      ambulance_dispatches: {
        Row: {
          ambulance_id: string | null
          arrived_at: string | null
          caller_name: string | null
          caller_phone: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          destination: string | null
          destination_lat: number | null
          destination_lng: number | null
          dispatch_no: string
          dispatched_at: string | null
          eta_minutes: number | null
          fare: number
          id: string
          notes: string | null
          patient_id: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_location: string
          status: Database["public"]["Enums"]["dispatch_status"]
          updated_at: string
        }
        Insert: {
          ambulance_id?: string | null
          arrived_at?: string | null
          caller_name?: string | null
          caller_phone?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          destination?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          dispatch_no?: string
          dispatched_at?: string | null
          eta_minutes?: number | null
          fare?: number
          id?: string
          notes?: string | null
          patient_id?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_location: string
          status?: Database["public"]["Enums"]["dispatch_status"]
          updated_at?: string
        }
        Update: {
          ambulance_id?: string | null
          arrived_at?: string | null
          caller_name?: string | null
          caller_phone?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          destination?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          dispatch_no?: string
          dispatched_at?: string | null
          eta_minutes?: number | null
          fare?: number
          id?: string
          notes?: string | null
          patient_id?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_location?: string
          status?: Database["public"]["Enums"]["dispatch_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambulance_dispatches_ambulance_id_fkey"
            columns: ["ambulance_id"]
            isOneToOne: false
            referencedRelation: "ambulances"
            referencedColumns: ["id"]
          },
        ]
      }
      ambulances: {
        Row: {
          active: boolean
          created_at: string
          driver_name: string | null
          driver_phone: string | null
          equipment: string | null
          id: string
          status: Database["public"]["Enums"]["ambulance_status"]
          updated_at: string
          vehicle_number: string
          vehicle_type: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          driver_name?: string | null
          driver_phone?: string | null
          equipment?: string | null
          id?: string
          status?: Database["public"]["Enums"]["ambulance_status"]
          updated_at?: string
          vehicle_number: string
          vehicle_type?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          driver_name?: string | null
          driver_phone?: string | null
          equipment?: string | null
          id?: string
          status?: Database["public"]["Enums"]["ambulance_status"]
          updated_at?: string
          vehicle_number?: string
          vehicle_type?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          created_at: string
          created_by: string | null
          doctor_id: string
          id: string
          notes: string | null
          patient_id: string
          scheduled_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          token_no: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          doctor_id: string
          id?: string
          notes?: string | null
          patient_id: string
          scheduled_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          token_no?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          doctor_id?: string
          id?: string
          notes?: string | null
          patient_id?: string
          scheduled_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          token_no?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_assignments: {
        Row: {
          asset_id: string
          assigned_at: string
          assigned_to_employee: string | null
          department: string | null
          id: string
          notes: string | null
          returned_at: string | null
        }
        Insert: {
          asset_id: string
          assigned_at?: string
          assigned_to_employee?: string | null
          department?: string | null
          id?: string
          notes?: string | null
          returned_at?: string | null
        }
        Update: {
          asset_id?: string
          assigned_at?: string
          assigned_to_employee?: string | null
          department?: string | null
          id?: string
          notes?: string | null
          returned_at?: string | null
        }
        Relationships: []
      }
      assets: {
        Row: {
          amc_until: string | null
          asset_no: string
          branch_id: string | null
          category: string
          created_at: string
          department: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          purchase_cost: number
          purchase_date: string | null
          serial_no: string | null
          status: string
          updated_at: string
          vendor_id: string | null
          warranty_until: string | null
        }
        Insert: {
          amc_until?: string | null
          asset_no?: string
          branch_id?: string | null
          category: string
          created_at?: string
          department?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          purchase_cost?: number
          purchase_date?: string | null
          serial_no?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
          warranty_until?: string | null
        }
        Update: {
          amc_until?: string | null
          asset_no?: string
          branch_id?: string | null
          category?: string
          created_at?: string
          department?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          purchase_cost?: number
          purchase_date?: string | null
          serial_no?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
          warranty_until?: string | null
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          method: string
          notes: string | null
          overtime_hours: number
          status: string
          working_hours: number
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          employee_id: string
          id?: string
          method?: string
          notes?: string | null
          overtime_hours?: number
          status?: string
          working_hours?: number
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          method?: string
          notes?: string | null
          overtime_hours?: number
          status?: string
          working_hours?: number
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          payload: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          payload?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          payload?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_logs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          size_mb: number | null
          status: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          size_mb?: number | null
          status?: string
          type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          size_mb?: number | null
          status?: string
          type?: string
        }
        Relationships: []
      }
      bed_transfers: {
        Row: {
          admission_id: string
          created_by: string | null
          from_bed_id: string | null
          id: string
          reason: string | null
          to_bed_id: string
          transferred_at: string
        }
        Insert: {
          admission_id: string
          created_by?: string | null
          from_bed_id?: string | null
          id?: string
          reason?: string | null
          to_bed_id: string
          transferred_at?: string
        }
        Update: {
          admission_id?: string
          created_by?: string | null
          from_bed_id?: string | null
          id?: string
          reason?: string | null
          to_bed_id?: string
          transferred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bed_transfers_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bed_transfers_from_bed_id_fkey"
            columns: ["from_bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bed_transfers_to_bed_id_fkey"
            columns: ["to_bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
        ]
      }
      beds: {
        Row: {
          bed_number: string
          charge_per_day: number
          created_at: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["bed_status"]
          updated_at: string
          ward_id: string
        }
        Insert: {
          bed_number: string
          charge_per_day?: number
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["bed_status"]
          updated_at?: string
          ward_id: string
        }
        Update: {
          bed_number?: string
          charge_per_day?: number
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["bed_status"]
          updated_at?: string
          ward_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beds_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_items: {
        Row: {
          amount: number
          bill_id: string
          category: string
          description: string
          id: string
          position: number
          quantity: number
          unit_price: number
        }
        Insert: {
          amount?: number
          bill_id: string
          category: string
          description: string
          id?: string
          position?: number
          quantity?: number
          unit_price?: number
        }
        Update: {
          amount?: number
          bill_id?: string
          category?: string
          description?: string
          id?: string
          position?: number
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          bill_no: string
          created_at: string
          created_by: string | null
          discount: number
          doctor_id: string | null
          gst: number
          id: string
          notes: string | null
          opd_visit_id: string | null
          paid: number
          patient_id: string
          pending: number
          status: Database["public"]["Enums"]["bill_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          bill_no?: string
          created_at?: string
          created_by?: string | null
          discount?: number
          doctor_id?: string | null
          gst?: number
          id?: string
          notes?: string | null
          opd_visit_id?: string | null
          paid?: number
          patient_id: string
          pending?: number
          status?: Database["public"]["Enums"]["bill_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          bill_no?: string
          created_at?: string
          created_by?: string | null
          discount?: number
          doctor_id?: string | null
          gst?: number
          id?: string
          notes?: string | null
          opd_visit_id?: string | null
          paid?: number
          patient_id?: string
          pending?: number
          status?: Database["public"]["Enums"]["bill_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_opd_visit_id_fkey"
            columns: ["opd_visit_id"]
            isOneToOne: false
            referencedRelation: "opd_visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      biomedical_assets: {
        Row: {
          amc_expiry: string | null
          asset_no: string | null
          category: string | null
          created_at: string
          id: string
          location: string | null
          manufacturer: string | null
          name: string
          next_service_date: string | null
          purchase_date: string | null
          serial_number: string | null
          status: string
          updated_at: string
          warranty_expiry: string | null
        }
        Insert: {
          amc_expiry?: string | null
          asset_no?: string | null
          category?: string | null
          created_at?: string
          id?: string
          location?: string | null
          manufacturer?: string | null
          name: string
          next_service_date?: string | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          warranty_expiry?: string | null
        }
        Update: {
          amc_expiry?: string | null
          asset_no?: string | null
          category?: string | null
          created_at?: string
          id?: string
          location?: string | null
          manufacturer?: string | null
          name?: string
          next_service_date?: string | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          warranty_expiry?: string | null
        }
        Relationships: []
      }
      blood_donors: {
        Row: {
          address: string | null
          blood_group: string
          created_at: string
          dob: string | null
          donor_no: string | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          last_donation_at: string | null
          mobile: string | null
          total_donations: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          blood_group: string
          created_at?: string
          dob?: string | null
          donor_no?: string | null
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          last_donation_at?: string | null
          mobile?: string | null
          total_donations?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          blood_group?: string
          created_at?: string
          dob?: string | null
          donor_no?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          last_donation_at?: string | null
          mobile?: string | null
          total_donations?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      blood_inventory: {
        Row: {
          bag_no: string | null
          blood_group: string
          collection_date: string
          component: string
          created_at: string
          donor_id: string | null
          expiry_date: string
          id: string
          status: string
          updated_at: string
          volume_ml: number | null
        }
        Insert: {
          bag_no?: string | null
          blood_group: string
          collection_date?: string
          component: string
          created_at?: string
          donor_id?: string | null
          expiry_date: string
          id?: string
          status?: string
          updated_at?: string
          volume_ml?: number | null
        }
        Update: {
          bag_no?: string | null
          blood_group?: string
          collection_date?: string
          component?: string
          created_at?: string
          donor_id?: string | null
          expiry_date?: string
          id?: string
          status?: string
          updated_at?: string
          volume_ml?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blood_inventory_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "blood_donors"
            referencedColumns: ["id"]
          },
        ]
      }
      blood_requests: {
        Row: {
          approved_by: string | null
          blood_group: string
          component: string
          created_at: string
          id: string
          issued_inventory_id: string | null
          notes: string | null
          patient_id: string | null
          priority: string | null
          requested_by: string | null
          status: string
          units: number
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          blood_group: string
          component: string
          created_at?: string
          id?: string
          issued_inventory_id?: string | null
          notes?: string | null
          patient_id?: string | null
          priority?: string | null
          requested_by?: string | null
          status?: string
          units?: number
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          blood_group?: string
          component?: string
          created_at?: string
          id?: string
          issued_inventory_id?: string | null
          notes?: string | null
          patient_id?: string | null
          priority?: string | null
          requested_by?: string | null
          status?: string
          units?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blood_requests_issued_inventory_id_fkey"
            columns: ["issued_inventory_id"]
            isOneToOne: false
            referencedRelation: "blood_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blood_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          active: boolean
          address: string | null
          city: string | null
          code: string
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          state: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          city?: string | null
          code: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          state?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          city?: string | null
          code?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          state?: string | null
        }
        Relationships: []
      }
      clinical_alerts: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          id: string
          message: string
          override_reason: string | null
          patient_id: string | null
          recommendation: string | null
          severity: string
          trigger_source: string | null
          updated_at: string
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string
          id?: string
          message: string
          override_reason?: string | null
          patient_id?: string | null
          recommendation?: string | null
          severity?: string
          trigger_source?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          id?: string
          message?: string
          override_reason?: string | null
          patient_id?: string | null
          recommendation?: string | null
          severity?: string
          trigger_source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_audits: {
        Row: {
          audit_date: string
          audit_type: string
          auditor: string | null
          compliance_pct: number | null
          created_at: string
          findings: string | null
          id: string
          recommendations: string | null
          sample_size: number | null
          scope: string | null
          status: string
          updated_at: string
        }
        Insert: {
          audit_date?: string
          audit_type: string
          auditor?: string | null
          compliance_pct?: number | null
          created_at?: string
          findings?: string | null
          id?: string
          recommendations?: string | null
          sample_size?: number | null
          scope?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          audit_date?: string
          audit_type?: string
          auditor?: string | null
          compliance_pct?: number | null
          created_at?: string
          findings?: string | null
          id?: string
          recommendations?: string | null
          sample_size?: number | null
          scope?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      communication_logs: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          id: string
          metadata: Json | null
          patient_id: string | null
          recipient: string
          sent_at: string | null
          status: string
          subject: string | null
          template: string | null
        }
        Insert: {
          body?: string | null
          channel: string
          created_at?: string
          id?: string
          metadata?: Json | null
          patient_id?: string | null
          recipient: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          patient_id?: string | null
          recipient?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template?: string | null
        }
        Relationships: []
      }
      compliance_assessments: {
        Row: {
          action_items: Json | null
          area: string
          assessed_at: string
          assessed_by: string | null
          findings: string | null
          id: string
          score: number | null
          standard: string
        }
        Insert: {
          action_items?: Json | null
          area: string
          assessed_at?: string
          assessed_by?: string | null
          findings?: string | null
          id?: string
          score?: number | null
          standard: string
        }
        Update: {
          action_items?: Json | null
          area?: string
          assessed_at?: string
          assessed_by?: string | null
          findings?: string | null
          id?: string
          score?: number | null
          standard?: string
        }
        Relationships: []
      }
      compliance_documents: {
        Row: {
          content: string | null
          created_at: string
          department: string | null
          doc_type: string
          effective_date: string | null
          file_url: string | null
          id: string
          review_date: string | null
          status: string
          title: string
          updated_at: string
          version: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          department?: string | null
          doc_type: string
          effective_date?: string | null
          file_url?: string | null
          id?: string
          review_date?: string | null
          status?: string
          title: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          department?: string | null
          doc_type?: string
          effective_date?: string | null
          file_url?: string | null
          id?: string
          review_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: []
      }
      consent_forms: {
        Row: {
          content: string | null
          created_at: string
          form_type: string
          id: string
          patient_id: string
          procedure: string | null
          signature_data: string | null
          signed: boolean | null
          signed_at: string | null
          updated_at: string
          witness_name: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          form_type: string
          id?: string
          patient_id: string
          procedure?: string | null
          signature_data?: string | null
          signed?: boolean | null
          signed_at?: string | null
          updated_at?: string
          witness_name?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          form_type?: string
          id?: string
          patient_id?: string
          procedure?: string | null
          signature_data?: string | null
          signed?: boolean | null
          signed_at?: string | null
          updated_at?: string
          witness_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_forms_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      corrective_actions: {
        Row: {
          action: string
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          incident_id: string
          owner: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          incident_id: string
          owner?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          incident_id?: string
          owner?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "corrective_actions_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campaigns: {
        Row: {
          audience_filter: Json | null
          campaign_type: string
          channel: string
          created_at: string
          id: string
          message: string | null
          metrics: Json | null
          name: string
          scheduled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          audience_filter?: Json | null
          campaign_type: string
          channel?: string
          created_at?: string
          id?: string
          message?: string | null
          metrics?: Json | null
          name: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          audience_filter?: Json | null
          campaign_type?: string
          channel?: string
          created_at?: string
          id?: string
          message?: string | null
          metrics?: Json | null
          name?: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      device_readings: {
        Row: {
          device_id: string | null
          id: string
          is_alert: boolean | null
          patient_id: string | null
          payload: Json
          reading_type: string | null
          recorded_at: string
        }
        Insert: {
          device_id?: string | null
          id?: string
          is_alert?: boolean | null
          patient_id?: string | null
          payload: Json
          reading_type?: string | null
          recorded_at?: string
        }
        Update: {
          device_id?: string | null
          id?: string
          is_alert?: boolean | null
          patient_id?: string | null
          payload?: Json
          reading_type?: string | null
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_readings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "iot_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_readings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      dialysis_sessions: {
        Row: {
          created_at: string
          doctor_id: string | null
          duration_min: number | null
          end_time: string | null
          id: string
          machine_no: string | null
          notes: string | null
          patient_id: string
          post_weight: number | null
          pre_weight: number | null
          session_date: string
          start_time: string | null
          status: string
          updated_at: string
          vitals: Json | null
        }
        Insert: {
          created_at?: string
          doctor_id?: string | null
          duration_min?: number | null
          end_time?: string | null
          id?: string
          machine_no?: string | null
          notes?: string | null
          patient_id: string
          post_weight?: number | null
          pre_weight?: number | null
          session_date?: string
          start_time?: string | null
          status?: string
          updated_at?: string
          vitals?: Json | null
        }
        Update: {
          created_at?: string
          doctor_id?: string | null
          duration_min?: number | null
          end_time?: string | null
          id?: string
          machine_no?: string | null
          notes?: string | null
          patient_id?: string
          post_weight?: number | null
          pre_weight?: number | null
          session_date?: string
          start_time?: string | null
          status?: string
          updated_at?: string
          vitals?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "dialysis_sessions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dialysis_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      dicom_files: {
        Row: {
          acquisition_date: string | null
          created_at: string
          file_name: string
          file_url: string | null
          id: string
          metadata: Json | null
          modality: string | null
          series_id: string | null
          size_bytes: number | null
          study_id: string | null
        }
        Insert: {
          acquisition_date?: string | null
          created_at?: string
          file_name: string
          file_url?: string | null
          id?: string
          metadata?: Json | null
          modality?: string | null
          series_id?: string | null
          size_bytes?: number | null
          study_id?: string | null
        }
        Update: {
          acquisition_date?: string | null
          created_at?: string
          file_name?: string
          file_url?: string | null
          id?: string
          metadata?: Json | null
          modality?: string | null
          series_id?: string | null
          size_bytes?: number | null
          study_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dicom_files_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "imaging_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dicom_files_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "imaging_studies"
            referencedColumns: ["id"]
          },
        ]
      }
      discharge_medications: {
        Row: {
          discharge_id: string
          dosage: string | null
          duration: string | null
          id: string
          instructions: string | null
          medicine_name: string
          position: number
        }
        Insert: {
          discharge_id: string
          dosage?: string | null
          duration?: string | null
          id?: string
          instructions?: string | null
          medicine_name: string
          position?: number
        }
        Update: {
          discharge_id?: string
          dosage?: string | null
          duration?: string | null
          id?: string
          instructions?: string | null
          medicine_name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "discharge_medications_discharge_id_fkey"
            columns: ["discharge_id"]
            isOneToOne: false
            referencedRelation: "discharge_summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      discharge_summaries: {
        Row: {
          admission_id: string
          advice: string | null
          condition_at_discharge: string | null
          created_at: string
          created_by: string | null
          discharge_date: string
          final_diagnosis: string | null
          follow_up_date: string | null
          follow_up_instructions: string | null
          hospital_course: string | null
          id: string
          procedures_performed: string | null
          updated_at: string
        }
        Insert: {
          admission_id: string
          advice?: string | null
          condition_at_discharge?: string | null
          created_at?: string
          created_by?: string | null
          discharge_date?: string
          final_diagnosis?: string | null
          follow_up_date?: string | null
          follow_up_instructions?: string | null
          hospital_course?: string | null
          id?: string
          procedures_performed?: string | null
          updated_at?: string
        }
        Update: {
          admission_id?: string
          advice?: string | null
          condition_at_discharge?: string | null
          created_at?: string
          created_by?: string | null
          discharge_date?: string
          final_diagnosis?: string | null
          follow_up_date?: string | null
          follow_up_instructions?: string | null
          hospital_course?: string | null
          id?: string
          procedures_performed?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discharge_summaries_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: true
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_rounds: {
        Row: {
          admission_id: string
          clinical_findings: string | null
          created_at: string
          created_by: string | null
          doctor_id: string | null
          follow_up_orders: string | null
          id: string
          progress_notes: string | null
          rounded_at: string
          template_used: string | null
          updated_diagnosis: string | null
        }
        Insert: {
          admission_id: string
          clinical_findings?: string | null
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          follow_up_orders?: string | null
          id?: string
          progress_notes?: string | null
          rounded_at?: string
          template_used?: string | null
          updated_diagnosis?: string | null
        }
        Update: {
          admission_id?: string
          clinical_findings?: string | null
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          follow_up_orders?: string | null
          id?: string
          progress_notes?: string | null
          rounded_at?: string
          template_used?: string | null
          updated_diagnosis?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_rounds_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_rounds_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          active: boolean
          consultation_fee: number | null
          created_at: string
          department_id: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          specialization: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean
          consultation_fee?: number | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          specialization?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean
          consultation_fee?: number | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          specialization?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctors_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      document_access_logs: {
        Row: {
          action: string
          created_at: string
          document_id: string
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          document_id: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          document_id?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_access_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          change_note: string | null
          created_at: string
          document_id: string
          file_size_bytes: number | null
          file_url: string
          id: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          change_note?: string | null
          created_at?: string
          document_id: string
          file_size_bytes?: number | null
          file_url: string
          id?: string
          uploaded_by?: string | null
          version: number
        }
        Update: {
          change_note?: string | null
          created_at?: string
          document_id?: string
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          access_level: string
          category: string
          created_at: string
          description: string | null
          file_size_bytes: number | null
          file_url: string
          id: string
          mime_type: string | null
          patient_id: string | null
          tags: string[] | null
          title: string
          updated_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          access_level?: string
          category?: string
          created_at?: string
          description?: string | null
          file_size_bytes?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          patient_id?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          access_level?: string
          category?: string
          created_at?: string
          description?: string | null
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          patient_id?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      ehr_records: {
        Row: {
          created_at: string
          external_facility: string | null
          id: string
          patient_id: string
          payload: Json | null
          record_type: string
          shared_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_facility?: string | null
          id?: string
          patient_id: string
          payload?: Json | null
          record_type: string
          shared_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_facility?: string | null
          id?: string
          patient_id?: string
          payload?: Json | null
          record_type?: string
          shared_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ehr_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          message_type: string
          patient_id: string | null
          recipient: string
          reference_id: string | null
          reference_type: string | null
          status: Database["public"]["Enums"]["comm_status"]
          subject: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          message_type: string
          patient_id?: string | null
          recipient: string
          reference_id?: string | null
          reference_type?: string | null
          status?: Database["public"]["Enums"]["comm_status"]
          subject: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          message_type?: string
          patient_id?: string | null
          recipient?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: Database["public"]["Enums"]["comm_status"]
          subject?: string
        }
        Relationships: []
      }
      emergency_cases: {
        Row: {
          approx_age: number | null
          arrival_time: string
          attending_doctor_id: string | null
          chief_complaint: string | null
          created_at: string
          created_by: string | null
          emergency_no: string
          emergency_type: string | null
          full_name: string
          gender: string | null
          id: string
          mobile: string | null
          notes: string | null
          patient_id: string | null
          status: Database["public"]["Enums"]["emergency_status"]
          treatment_end: string | null
          treatment_start: string | null
          triage: Database["public"]["Enums"]["triage_level"] | null
          updated_at: string
        }
        Insert: {
          approx_age?: number | null
          arrival_time?: string
          attending_doctor_id?: string | null
          chief_complaint?: string | null
          created_at?: string
          created_by?: string | null
          emergency_no?: string
          emergency_type?: string | null
          full_name: string
          gender?: string | null
          id?: string
          mobile?: string | null
          notes?: string | null
          patient_id?: string | null
          status?: Database["public"]["Enums"]["emergency_status"]
          treatment_end?: string | null
          treatment_start?: string | null
          triage?: Database["public"]["Enums"]["triage_level"] | null
          updated_at?: string
        }
        Update: {
          approx_age?: number | null
          arrival_time?: string
          attending_doctor_id?: string | null
          chief_complaint?: string | null
          created_at?: string
          created_by?: string | null
          emergency_no?: string
          emergency_type?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          mobile?: string | null
          notes?: string | null
          patient_id?: string | null
          status?: Database["public"]["Enums"]["emergency_status"]
          treatment_end?: string | null
          treatment_start?: string | null
          triage?: Database["public"]["Enums"]["triage_level"] | null
          updated_at?: string
        }
        Relationships: []
      }
      employee_documents: {
        Row: {
          doc_type: string
          doc_url: string | null
          employee_id: string
          id: string
          notes: string | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          doc_type: string
          doc_url?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          doc_type?: string
          doc_url?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          aadhaar: string | null
          address: string | null
          bank_account: string | null
          bank_ifsc: string | null
          bank_name: string | null
          branch_id: string | null
          created_at: string
          department: string
          designation: string | null
          dob: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_no: string
          full_name: string
          gender: string | null
          id: string
          joining_date: string | null
          pan: string | null
          phone: string | null
          photo_url: string | null
          qualification: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          aadhaar?: string | null
          address?: string | null
          bank_account?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          branch_id?: string | null
          created_at?: string
          department: string
          designation?: string | null
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_no?: string
          full_name: string
          gender?: string | null
          id?: string
          joining_date?: string | null
          pan?: string | null
          phone?: string | null
          photo_url?: string | null
          qualification?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          aadhaar?: string | null
          address?: string | null
          bank_account?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          branch_id?: string | null
          created_at?: string
          department?: string
          designation?: string | null
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_no?: string
          full_name?: string
          gender?: string | null
          id?: string
          joining_date?: string | null
          pan?: string | null
          phone?: string | null
          photo_url?: string | null
          qualification?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      emr_records: {
        Row: {
          created_at: string
          data: Json | null
          department: string | null
          doctor_id: string | null
          event_date: string
          id: string
          patient_id: string
          record_type: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          department?: string | null
          doctor_id?: string | null
          event_date?: string
          id?: string
          patient_id: string
          record_type: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          department?: string | null
          doctor_id?: string | null
          event_date?: string
          id?: string
          patient_id?: string
          record_type?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "emr_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_audit_logs: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      fhir_resources: {
        Row: {
          created_at: string
          id: string
          last_updated: string
          patient_id: string | null
          payload: Json
          resource_id: string
          resource_type: string
          updated_at: string
          version_id: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_updated?: string
          patient_id?: string | null
          payload?: Json
          resource_id: string
          resource_type: string
          updated_at?: string
          version_id?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_updated?: string
          patient_id?: string | null
          payload?: Json
          resource_id?: string
          resource_type?: string
          updated_at?: string
          version_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fhir_resources_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_results: {
        Row: {
          confidence: number | null
          created_at: string
          domain: string
          forecast_date: string
          id: string
          metric: string
          model_id: string | null
          value: number
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          domain: string
          forecast_date: string
          id?: string
          metric: string
          model_id?: string | null
          value: number
        }
        Update: {
          confidence?: number | null
          created_at?: string
          domain?: string
          forecast_date?: string
          id?: string
          metric?: string
          model_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "forecast_results_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "prediction_models"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          accepted: boolean
          damaged_quantity: number
          grn_no: string
          id: string
          notes: string | null
          po_id: string
          received_at: string
          received_by: string | null
          received_quantity: number
        }
        Insert: {
          accepted?: boolean
          damaged_quantity?: number
          grn_no?: string
          id?: string
          notes?: string | null
          po_id: string
          received_at?: string
          received_by?: string | null
          received_quantity?: number
        }
        Update: {
          accepted?: boolean
          damaged_quantity?: number
          grn_no?: string
          id?: string
          notes?: string | null
          po_id?: string
          received_at?: string
          received_by?: string | null
          received_quantity?: number
        }
        Relationships: []
      }
      health_package_bookings: {
        Row: {
          amount: number | null
          booked_for: string | null
          created_at: string
          id: string
          package_id: string
          patient_id: string
          status: string
        }
        Insert: {
          amount?: number | null
          booked_for?: string | null
          created_at?: string
          id?: string
          package_id: string
          patient_id: string
          status?: string
        }
        Update: {
          amount?: number | null
          booked_for?: string | null
          created_at?: string
          id?: string
          package_id?: string
          patient_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_package_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "health_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      health_packages: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          description: string | null
          duration_days: number | null
          id: string
          includes: Json | null
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          duration_days?: number | null
          id?: string
          includes?: Json | null
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          duration_days?: number | null
          id?: string
          includes?: Json | null
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      health_records: {
        Row: {
          attachments: Json | null
          created_at: string
          id: string
          metadata: Json | null
          patient_id: string
          record_date: string
          record_type: string
          source_id: string | null
          source_table: string | null
          summary: string | null
          title: string
        }
        Insert: {
          attachments?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          patient_id: string
          record_date?: string
          record_type: string
          source_id?: string | null
          source_table?: string | null
          summary?: string | null
          title: string
        }
        Update: {
          attachments?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          patient_id?: string
          record_date?: string
          record_type?: string
          source_id?: string | null
          source_table?: string | null
          summary?: string | null
          title?: string
        }
        Relationships: []
      }
      hl7_messages: {
        Row: {
          created_at: string
          destination_system: string | null
          direction: string
          error: string | null
          hl7_version: string | null
          id: string
          message_type: string
          parsed: Json | null
          processed_at: string | null
          raw_message: string | null
          source_system: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination_system?: string | null
          direction?: string
          error?: string | null
          hl7_version?: string | null
          id?: string
          message_type: string
          parsed?: Json | null
          processed_at?: string | null
          raw_message?: string | null
          source_system?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination_system?: string | null
          direction?: string
          error?: string | null
          hl7_version?: string | null
          id?: string
          message_type?: string
          parsed?: Json | null
          processed_at?: string | null
          raw_message?: string | null
          source_system?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      icu_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          message: string | null
          patient_id: string
          resolved: boolean | null
          severity: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          message?: string | null
          patient_id: string
          resolved?: boolean | null
          severity?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          message?: string | null
          patient_id?: string
          resolved?: boolean | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "icu_alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      icu_monitoring: {
        Row: {
          admission_id: string | null
          bp_dia: number | null
          bp_sys: number | null
          created_at: string
          heart_rate: number | null
          id: string
          notes: string | null
          on_ventilator: boolean | null
          patient_id: string
          recorded_at: string
          recorded_by: string | null
          resp_rate: number | null
          spo2: number | null
          temperature: number | null
        }
        Insert: {
          admission_id?: string | null
          bp_dia?: number | null
          bp_sys?: number | null
          created_at?: string
          heart_rate?: number | null
          id?: string
          notes?: string | null
          on_ventilator?: boolean | null
          patient_id: string
          recorded_at?: string
          recorded_by?: string | null
          resp_rate?: number | null
          spo2?: number | null
          temperature?: number | null
        }
        Update: {
          admission_id?: string | null
          bp_dia?: number | null
          bp_sys?: number | null
          created_at?: string
          heart_rate?: number | null
          id?: string
          notes?: string | null
          on_ventilator?: boolean | null
          patient_id?: string
          recorded_at?: string
          recorded_by?: string | null
          resp_rate?: number | null
          spo2?: number | null
          temperature?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "icu_monitoring_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      imaging_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          study_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          study_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          study_id?: string | null
        }
        Relationships: []
      }
      imaging_series: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_count: number | null
          series_uid: string | null
          study_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_count?: number | null
          series_uid?: string | null
          study_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_count?: number | null
          series_uid?: string | null
          study_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "imaging_series_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "imaging_studies"
            referencedColumns: ["id"]
          },
        ]
      }
      imaging_studies: {
        Row: {
          created_at: string
          description: string | null
          id: string
          modality: string | null
          order_id: string | null
          patient_id: string
          study_date: string | null
          study_uid: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          modality?: string | null
          order_id?: string | null
          patient_id: string
          study_date?: string | null
          study_uid?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          modality?: string | null
          order_id?: string | null
          patient_id?: string
          study_date?: string | null
          study_uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imaging_studies_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "radiology_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imaging_studies_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          closed_at: string | null
          created_at: string
          description: string
          id: string
          immediate_action: string | null
          incident_no: string | null
          incident_type: string
          location: string | null
          occurred_at: string
          patient_id: string | null
          reported_by: string | null
          root_cause: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          description: string
          id?: string
          immediate_action?: string | null
          incident_no?: string | null
          incident_type: string
          location?: string | null
          occurred_at?: string
          patient_id?: string | null
          reported_by?: string | null
          root_cause?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          immediate_action?: string | null
          incident_no?: string | null
          incident_type?: string
          location?: string | null
          occurred_at?: string
          patient_id?: string | null
          reported_by?: string | null
          root_cause?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      infection_control: {
        Row: {
          antibiotic: string | null
          created_at: string
          id: string
          infection_type: string
          is_hai: boolean | null
          isolation_required: boolean | null
          isolation_type: string | null
          notes: string | null
          onset_date: string | null
          patient_id: string | null
          resolved_date: string | null
          updated_at: string
        }
        Insert: {
          antibiotic?: string | null
          created_at?: string
          id?: string
          infection_type: string
          is_hai?: boolean | null
          isolation_required?: boolean | null
          isolation_type?: string | null
          notes?: string | null
          onset_date?: string | null
          patient_id?: string | null
          resolved_date?: string | null
          updated_at?: string
        }
        Update: {
          antibiotic?: string | null
          created_at?: string
          id?: string
          infection_type?: string
          is_hai?: boolean | null
          isolation_required?: boolean | null
          isolation_type?: string | null
          notes?: string | null
          onset_date?: string | null
          patient_id?: string | null
          resolved_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "infection_control_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_claims: {
        Row: {
          admission_id: string | null
          approved_amount: number
          bill_id: string | null
          claim_amount: number
          claim_no: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          patient_id: string
          patient_insurance_id: string | null
          pre_auth_no: string | null
          rejection_reason: string | null
          settled_at: string | null
          status: Database["public"]["Enums"]["claim_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          admission_id?: string | null
          approved_amount?: number
          bill_id?: string | null
          claim_amount?: number
          claim_no?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          patient_insurance_id?: string | null
          pre_auth_no?: string | null
          rejection_reason?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          admission_id?: string | null
          approved_amount?: number
          bill_id?: string | null
          claim_amount?: number
          claim_no?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          patient_insurance_id?: string | null
          pre_auth_no?: string | null
          rejection_reason?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_claims_patient_insurance_id_fkey"
            columns: ["patient_insurance_id"]
            isOneToOne: false
            referencedRelation: "patient_insurance"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_companies: {
        Row: {
          active: boolean
          contact_person: string | null
          coverage_rules: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          policy_type: string | null
          tpa: string | null
        }
        Insert: {
          active?: boolean
          contact_person?: string | null
          coverage_rules?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          policy_type?: string | null
          tpa?: string | null
        }
        Update: {
          active?: boolean
          contact_person?: string | null
          coverage_rules?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          policy_type?: string | null
          tpa?: string | null
        }
        Relationships: []
      }
      insurance_documents: {
        Row: {
          claim_id: string
          created_at: string
          document_type: string
          file_url: string | null
          id: string
          uploaded_by: string | null
        }
        Insert: {
          claim_id: string
          created_at?: string
          document_type: string
          file_url?: string | null
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          claim_id?: string
          created_at?: string
          document_type?: string
          file_url?: string | null
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurance_documents_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "insurance_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          endpoint: string | null
          error: string | null
          id: string
          integration_name: string
          method: string | null
          request_payload: Json | null
          response_payload: Json | null
          status_code: number | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          endpoint?: string | null
          error?: string | null
          id?: string
          integration_name: string
          method?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          status_code?: number | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          endpoint?: string | null
          error?: string | null
          id?: string
          integration_name?: string
          method?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          status_code?: number | null
        }
        Relationships: []
      }
      iot_devices: {
        Row: {
          config: Json | null
          created_at: string
          device_name: string
          device_type: string
          id: string
          last_seen_at: string | null
          location: string | null
          serial_no: string | null
          status: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string
          device_name: string
          device_type: string
          id?: string
          last_seen_at?: string | null
          location?: string | null
          serial_no?: string | null
          status?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string
          device_name?: string
          device_type?: string
          id?: string
          last_seen_at?: string | null
          location?: string | null
          serial_no?: string | null
          status?: string | null
        }
        Relationships: []
      }
      jci_audits: {
        Row: {
          audit_date: string
          auditor: string | null
          category: string | null
          created_at: string
          findings: string | null
          id: string
          recommendations: string | null
          score: number | null
          standard_code: string
          standard_name: string
          status: string
          updated_at: string
        }
        Insert: {
          audit_date?: string
          auditor?: string | null
          category?: string | null
          created_at?: string
          findings?: string | null
          id?: string
          recommendations?: string | null
          score?: number | null
          standard_code: string
          standard_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          audit_date?: string
          auditor?: string | null
          category?: string | null
          created_at?: string
          findings?: string | null
          id?: string
          recommendations?: string | null
          score?: number | null
          standard_code?: string
          standard_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          credit: number
          debit: number
          description: string | null
          entry_date: string
          id: string
          reference: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          credit?: number
          debit?: number
          description?: string | null
          entry_date?: string
          id?: string
          reference?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          credit?: number
          debit?: number
          description?: string | null
          entry_date?: string
          id?: string
          reference?: string | null
        }
        Relationships: []
      }
      kiosk_sessions: {
        Row: {
          appointment_id: string | null
          check_in_method: string
          created_at: string
          id: string
          kiosk_id: string | null
          meta: Json | null
          patient_id: string | null
          status: string
        }
        Insert: {
          appointment_id?: string | null
          check_in_method?: string
          created_at?: string
          id?: string
          kiosk_id?: string | null
          meta?: Json | null
          patient_id?: string | null
          status?: string
        }
        Update: {
          appointment_id?: string | null
          check_in_method?: string
          created_at?: string
          id?: string
          kiosk_id?: string | null
          meta?: Json | null
          patient_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          tags: string[] | null
          title: string
          updated_at: string
          version: number | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          version?: number | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          version?: number | null
        }
        Relationships: []
      }
      lab_orders: {
        Row: {
          created_at: string
          created_by: string | null
          doctor_id: string | null
          id: string
          notes: string | null
          opd_visit_id: string | null
          order_no: string
          patient_id: string
          status: Database["public"]["Enums"]["lab_order_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          id?: string
          notes?: string | null
          opd_visit_id?: string | null
          order_no?: string
          patient_id: string
          status?: Database["public"]["Enums"]["lab_order_status"]
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          id?: string
          notes?: string | null
          opd_visit_id?: string | null
          order_no?: string
          patient_id?: string
          status?: Database["public"]["Enums"]["lab_order_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_orders_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_opd_visit_id_fkey"
            columns: ["opd_visit_id"]
            isOneToOne: false
            referencedRelation: "opd_visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_results: {
        Row: {
          flag: string | null
          id: string
          order_id: string
          reference_range: string | null
          report_url: string | null
          result_entered_at: string | null
          result_entered_by: string | null
          result_value: string | null
          test_id: string
          test_name: string
          unit: string | null
        }
        Insert: {
          flag?: string | null
          id?: string
          order_id: string
          reference_range?: string | null
          report_url?: string | null
          result_entered_at?: string | null
          result_entered_by?: string | null
          result_value?: string | null
          test_id: string
          test_name: string
          unit?: string | null
        }
        Update: {
          flag?: string | null
          id?: string
          order_id?: string
          reference_range?: string | null
          report_url?: string | null
          result_entered_at?: string | null
          result_entered_by?: string | null
          result_value?: string | null
          test_id?: string
          test_name?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "lab_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "lab_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_tests: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          department: string | null
          id: string
          name: string
          price: number
          turnaround_hours: number
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          department?: string | null
          id?: string
          name: string
          price?: number
          turnaround_hours?: number
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          department?: string | null
          id?: string
          name?: string
          price?: number
          turnaround_hours?: number
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approver_id: string | null
          created_at: string
          days: number
          employee_id: string
          from_date: string
          id: string
          leave_type: string
          reason: string | null
          rejection_reason: string | null
          status: string
          to_date: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approver_id?: string | null
          created_at?: string
          days?: number
          employee_id: string
          from_date: string
          id?: string
          leave_type: string
          reason?: string | null
          rejection_reason?: string | null
          status?: string
          to_date: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approver_id?: string | null
          created_at?: string
          days?: number
          employee_id?: string
          from_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          rejection_reason?: string | null
          status?: string
          to_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_logs: {
        Row: {
          asset_id: string
          cost: number | null
          created_at: string
          description: string | null
          id: string
          log_date: string
          next_due_date: string | null
          performed_by: string | null
          type: string
        }
        Insert: {
          asset_id: string
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          log_date?: string
          next_due_date?: string | null
          performed_by?: string | null
          type?: string
        }
        Update: {
          asset_id?: string
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          log_date?: string
          next_due_date?: string | null
          performed_by?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "biomedical_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_records_archive: {
        Row: {
          archived_at: string
          created_at: string
          destroyed_at: string | null
          id: string
          location: string | null
          notes: string | null
          patient_id: string
          record_no: string | null
          retention_until: string | null
          status: string
          updated_at: string
        }
        Insert: {
          archived_at?: string
          created_at?: string
          destroyed_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          patient_id: string
          record_no?: string | null
          retention_until?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string
          created_at?: string
          destroyed_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          patient_id?: string
          record_no?: string | null
          retention_until?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_records_archive_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_administration: {
        Row: {
          administered_at: string | null
          administered_by: string | null
          admission_id: string
          created_at: string
          dosage: string | null
          id: string
          medicine_name: string
          notes: string | null
          route: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["mar_status"]
        }
        Insert: {
          administered_at?: string | null
          administered_by?: string | null
          admission_id: string
          created_at?: string
          dosage?: string | null
          id?: string
          medicine_name: string
          notes?: string | null
          route?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["mar_status"]
        }
        Update: {
          administered_at?: string | null
          administered_by?: string | null
          admission_id?: string
          created_at?: string
          dosage?: string | null
          id?: string
          medicine_name?: string
          notes?: string | null
          route?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["mar_status"]
        }
        Relationships: [
          {
            foreignKeyName: "medication_administration_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
        ]
      }
      medicine_batches: {
        Row: {
          batch_no: string
          created_at: string
          expiry_date: string
          id: string
          medicine_id: string
          mrp: number
          purchase_price: number
          quantity: number
        }
        Insert: {
          batch_no: string
          created_at?: string
          expiry_date: string
          id?: string
          medicine_id: string
          mrp?: number
          purchase_price?: number
          quantity?: number
        }
        Update: {
          batch_no?: string
          created_at?: string
          expiry_date?: string
          id?: string
          medicine_id?: string
          mrp?: number
          purchase_price?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "medicine_batches_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
        ]
      }
      medicines: {
        Row: {
          active: boolean
          created_at: string
          generic_name: string | null
          gst_percent: number
          id: string
          manufacturer: string | null
          minimum_stock: number
          name: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          generic_name?: string | null
          gst_percent?: number
          id?: string
          manufacturer?: string | null
          minimum_stock?: number
          name: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          generic_name?: string | null
          gst_percent?: number
          id?: string
          manufacturer?: string | null
          minimum_stock?: number
          name?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mobile_device_tokens: {
        Row: {
          app_role: string
          created_at: string
          device_token: string
          id: string
          last_active_at: string
          platform: string
          user_id: string
        }
        Insert: {
          app_role?: string
          created_at?: string
          device_token: string
          id?: string
          last_active_at?: string
          platform: string
          user_id: string
        }
        Update: {
          app_role?: string
          created_at?: string
          device_token?: string
          id?: string
          last_active_at?: string
          platform?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          id: string
          link: string | null
          priority: Database["public"]["Enums"]["notification_priority"]
          read_at: string | null
          reference_id: string | null
          reference_type: string | null
          target_role: Database["public"]["Enums"]["app_role"] | null
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          category: string
          created_at?: string
          id?: string
          link?: string | null
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          link?: string | null
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      nursing_notes: {
        Row: {
          admission_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string
          shift: string | null
        }
        Insert: {
          admission_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note: string
          shift?: string | null
        }
        Update: {
          admission_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
          shift?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nursing_notes_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
        ]
      }
      online_payments: {
        Row: {
          amount: number
          bill_id: string | null
          created_at: string
          gateway: string | null
          gateway_ref: string | null
          id: string
          method: string
          paid_at: string | null
          patient_id: string
          purpose: string | null
          status: string
        }
        Insert: {
          amount: number
          bill_id?: string | null
          created_at?: string
          gateway?: string | null
          gateway_ref?: string | null
          id?: string
          method: string
          paid_at?: string | null
          patient_id: string
          purpose?: string | null
          status?: string
        }
        Update: {
          amount?: number
          bill_id?: string | null
          created_at?: string
          gateway?: string | null
          gateway_ref?: string | null
          id?: string
          method?: string
          paid_at?: string | null
          patient_id?: string
          purpose?: string | null
          status?: string
        }
        Relationships: []
      }
      opd_visits: {
        Row: {
          appointment_id: string | null
          chief_complaints: string | null
          clinical_findings: string | null
          created_at: string
          created_by: string | null
          diagnosis: string | null
          doctor_id: string
          follow_up_date: string | null
          id: string
          notes: string | null
          patient_id: string
          symptoms: string | null
          vitals: Json | null
        }
        Insert: {
          appointment_id?: string | null
          chief_complaints?: string | null
          clinical_findings?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          doctor_id: string
          follow_up_date?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          symptoms?: string | null
          vitals?: Json | null
        }
        Update: {
          appointment_id?: string | null
          chief_complaints?: string | null
          clinical_findings?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          doctor_id?: string
          follow_up_date?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          symptoms?: string | null
          vitals?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "opd_visits_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opd_visits_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opd_visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      ot_rooms: {
        Row: {
          active: boolean
          created_at: string
          id: string
          location: string | null
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          location?: string | null
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          location?: string | null
          name?: string
        }
        Relationships: []
      }
      patient_consents: {
        Row: {
          consent_type: string
          created_at: string
          expires_at: string | null
          granted: boolean
          granted_at: string | null
          id: string
          notes: string | null
          patient_id: string
          scope: string | null
          signature_url: string | null
          updated_at: string
        }
        Insert: {
          consent_type: string
          created_at?: string
          expires_at?: string | null
          granted?: boolean
          granted_at?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          scope?: string | null
          signature_url?: string | null
          updated_at?: string
        }
        Update: {
          consent_type?: string
          created_at?: string
          expires_at?: string | null
          granted?: boolean
          granted_at?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          scope?: string | null
          signature_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_consents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_engagement_logs: {
        Row: {
          channel: string | null
          content: string | null
          created_at: string
          engagement_type: string
          id: string
          metadata: Json | null
          patient_id: string | null
          status: string | null
        }
        Insert: {
          channel?: string | null
          content?: string | null
          created_at?: string
          engagement_type: string
          id?: string
          metadata?: Json | null
          patient_id?: string | null
          status?: string | null
        }
        Update: {
          channel?: string | null
          content?: string | null
          created_at?: string
          engagement_type?: string
          id?: string
          metadata?: Json | null
          patient_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_engagement_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_family_members: {
        Row: {
          can_book: boolean
          can_view: boolean
          created_at: string
          id: string
          member_patient_id: string
          primary_user_id: string
          relationship: string
        }
        Insert: {
          can_book?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          member_patient_id: string
          primary_user_id: string
          relationship: string
        }
        Update: {
          can_book?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          member_patient_id?: string
          primary_user_id?: string
          relationship?: string
        }
        Relationships: []
      }
      patient_insurance: {
        Row: {
          active: boolean
          authorization_number: string | null
          company_id: string | null
          coverage_limit: number
          created_at: string
          id: string
          patient_id: string
          policy_number: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          active?: boolean
          authorization_number?: string | null
          company_id?: string | null
          coverage_limit?: number
          created_at?: string
          id?: string
          patient_id: string
          policy_number: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          active?: boolean
          authorization_number?: string | null
          company_id?: string | null
          coverage_limit?: number
          created_at?: string
          id?: string
          patient_id?: string
          policy_number?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_insurance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "insurance_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_insurance_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_portal_accounts: {
        Row: {
          created_at: string
          id: string
          patient_id: string
          preferences: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          patient_id: string
          preferences?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          patient_id?: string
          preferences?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      patient_safety_alerts: {
        Row: {
          active: boolean | null
          alert_type: string
          created_at: string
          id: string
          message: string
          patient_id: string
          resolved_at: string | null
          severity: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          alert_type: string
          created_at?: string
          id?: string
          message: string
          patient_id: string
          resolved_at?: string | null
          severity?: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          alert_type?: string
          created_at?: string
          id?: string
          message?: string
          patient_id?: string
          resolved_at?: string | null
          severity?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_safety_alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          aadhaar: string | null
          address_line: string | null
          allergies: string | null
          blood_group: string | null
          chronic_diseases: string | null
          city: string | null
          created_at: string
          created_by: string | null
          dob: string | null
          email: string | null
          emergency_contact_mobile: string | null
          emergency_contact_name: string | null
          full_name: string
          gender: Database["public"]["Enums"]["gender_type"]
          id: string
          mobile: string
          photo_url: string | null
          pincode: string | null
          state: string | null
          uhid: string
          updated_at: string
        }
        Insert: {
          aadhaar?: string | null
          address_line?: string | null
          allergies?: string | null
          blood_group?: string | null
          chronic_diseases?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          dob?: string | null
          email?: string | null
          emergency_contact_mobile?: string | null
          emergency_contact_name?: string | null
          full_name: string
          gender: Database["public"]["Enums"]["gender_type"]
          id?: string
          mobile: string
          photo_url?: string | null
          pincode?: string | null
          state?: string | null
          uhid?: string
          updated_at?: string
        }
        Update: {
          aadhaar?: string | null
          address_line?: string | null
          allergies?: string | null
          blood_group?: string | null
          chronic_diseases?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          dob?: string | null
          email?: string | null
          emergency_contact_mobile?: string | null
          emergency_contact_name?: string | null
          full_name?: string
          gender?: Database["public"]["Enums"]["gender_type"]
          id?: string
          mobile?: string
          photo_url?: string | null
          pincode?: string | null
          state?: string | null
          uhid?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          bill_id: string
          created_by: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_at: string
          reference: string | null
        }
        Insert: {
          amount: number
          bill_id: string
          created_by?: string | null
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          reference?: string | null
        }
        Update: {
          amount?: number
          bill_id?: string
          created_by?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          created_at: string
          id: string
          period_month: number
          period_year: number
          processed_at: string | null
          processed_by: string | null
          status: string
          total_deductions: number
          total_gross: number
          total_net: number
        }
        Insert: {
          created_at?: string
          id?: string
          period_month: number
          period_year: number
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          total_deductions?: number
          total_gross?: number
          total_net?: number
        }
        Update: {
          created_at?: string
          id?: string
          period_month?: number
          period_year?: number
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          total_deductions?: number
          total_gross?: number
          total_net?: number
        }
        Relationships: []
      }
      pharmacy_forecasts: {
        Row: {
          created_at: string
          current_stock: number | null
          expiry_risk: number | null
          forecast_date: string
          id: string
          medicine_id: string | null
          notes: string | null
          predicted_demand: number | null
          reorder_qty: number | null
        }
        Insert: {
          created_at?: string
          current_stock?: number | null
          expiry_risk?: number | null
          forecast_date: string
          id?: string
          medicine_id?: string | null
          notes?: string | null
          predicted_demand?: number | null
          reorder_qty?: number | null
        }
        Update: {
          created_at?: string
          current_stock?: number | null
          expiry_risk?: number | null
          forecast_date?: string
          id?: string
          medicine_id?: string | null
          notes?: string | null
          predicted_demand?: number | null
          reorder_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_forecasts_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_sale_items: {
        Row: {
          amount: number
          batch_id: string | null
          gst_percent: number
          id: string
          medicine_id: string
          medicine_name: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          amount: number
          batch_id?: string | null
          gst_percent?: number
          id?: string
          medicine_id: string
          medicine_name: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        Update: {
          amount?: number
          batch_id?: string | null
          gst_percent?: number
          id?: string
          medicine_id?: string
          medicine_name?: string
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_sale_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "medicine_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_sale_items_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_sales: {
        Row: {
          created_at: string
          created_by: string | null
          discount: number
          gst: number
          id: string
          invoice_no: string
          patient_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          subtotal: number
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discount?: number
          gst?: number
          id?: string
          invoice_no?: string
          patient_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          subtotal?: number
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discount?: number
          gst?: number
          id?: string
          invoice_no?: string
          patient_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_sales_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_models: {
        Row: {
          active: boolean | null
          config: Json | null
          created_at: string
          description: string | null
          domain: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean | null
          config?: Json | null
          created_at?: string
          description?: string | null
          domain: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean | null
          config?: Json | null
          created_at?: string
          description?: string | null
          domain?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      predictive_forecasts: {
        Row: {
          confidence: number | null
          data: Json
          forecast_type: string
          generated_at: string
          generated_by: string | null
          horizon_days: number
          id: string
        }
        Insert: {
          confidence?: number | null
          data?: Json
          forecast_type: string
          generated_at?: string
          generated_by?: string | null
          horizon_days?: number
          id?: string
        }
        Update: {
          confidence?: number | null
          data?: Json
          forecast_type?: string
          generated_at?: string
          generated_by?: string | null
          horizon_days?: number
          id?: string
        }
        Relationships: []
      }
      prescription_items: {
        Row: {
          dosage: string | null
          duration_days: number | null
          food_instruction: string | null
          id: string
          medicine_name: string
          notes: string | null
          position: number | null
          prescription_id: string
          timing: string | null
        }
        Insert: {
          dosage?: string | null
          duration_days?: number | null
          food_instruction?: string | null
          id?: string
          medicine_name: string
          notes?: string | null
          position?: number | null
          prescription_id: string
          timing?: string | null
        }
        Update: {
          dosage?: string | null
          duration_days?: number | null
          food_instruction?: string | null
          id?: string
          medicine_name?: string
          notes?: string | null
          position?: number | null
          prescription_id?: string
          timing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          created_at: string
          id: string
          opd_visit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          opd_visit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          opd_visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_opd_visit_id_fkey"
            columns: ["opd_visit_id"]
            isOneToOne: false
            referencedRelation: "opd_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          meta: Json | null
          patient_id: string | null
          resource: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          meta?: Json | null
          patient_id?: string | null
          resource?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          meta?: Json | null
          patient_id?: string | null
          resource?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "privacy_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          login_disabled: boolean
          password_changed: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          login_disabled?: boolean
          password_changed?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          login_disabled?: boolean
          password_changed?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          amount: number
          id: string
          item_name: string
          po_id: string
          position: number
          quantity: number
          rate: number
          tax_percent: number
          unit: string | null
        }
        Insert: {
          amount?: number
          id?: string
          item_name: string
          po_id: string
          position?: number
          quantity?: number
          rate?: number
          tax_percent?: number
          unit?: string | null
        }
        Update: {
          amount?: number
          id?: string
          item_name?: string
          po_id?: string
          position?: number
          quantity?: number
          rate?: number
          tax_percent?: number
          unit?: string | null
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          expected_delivery: string | null
          id: string
          notes: string | null
          order_date: string
          po_no: string
          pr_id: string | null
          status: string
          subtotal: number
          tax: number
          total: number
          vendor_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_no?: string
          pr_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          vendor_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_no?: string
          pr_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          vendor_id?: string
        }
        Relationships: []
      }
      purchase_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          department: string
          estimated_cost: number
          id: string
          item_name: string
          notes: string | null
          pr_no: string
          priority: string
          quantity: number
          requested_by: string | null
          status: string
          unit: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          department: string
          estimated_cost?: number
          id?: string
          item_name: string
          notes?: string | null
          pr_no?: string
          priority?: string
          quantity?: number
          requested_by?: string | null
          status?: string
          unit?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          department?: string
          estimated_cost?: number
          id?: string
          item_name?: string
          notes?: string | null
          pr_no?: string
          priority?: string
          quantity?: number
          requested_by?: string | null
          status?: string
          unit?: string | null
        }
        Relationships: []
      }
      quality_indicators: {
        Row: {
          category: string | null
          created_at: string
          denominator: number | null
          id: string
          indicator_code: string
          name: string
          notes: string | null
          numerator: number | null
          period_end: string
          period_start: string
          target: number | null
          updated_at: string
          value: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          denominator?: number | null
          id?: string
          indicator_code: string
          name: string
          notes?: string | null
          numerator?: number | null
          period_end: string
          period_start: string
          target?: number | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          denominator?: number | null
          id?: string
          indicator_code?: string
          name?: string
          notes?: string | null
          numerator?: number | null
          period_end?: string
          period_start?: string
          target?: number | null
          updated_at?: string
          value?: number | null
        }
        Relationships: []
      }
      quality_metrics: {
        Row: {
          created_at: string
          department: string | null
          id: string
          metric: string
          period: string
          target: number | null
          value: number
        }
        Insert: {
          created_at?: string
          department?: string | null
          id?: string
          metric: string
          period: string
          target?: number | null
          value: number
        }
        Update: {
          created_at?: string
          department?: string | null
          id?: string
          metric?: string
          period?: string
          target?: number | null
          value?: number
        }
        Relationships: []
      }
      queue_tokens: {
        Row: {
          called_at: string | null
          counter: string
          estimated_minutes: number | null
          id: string
          issued_at: string
          patient_id: string | null
          served_at: string | null
          status: string
          token_no: number
        }
        Insert: {
          called_at?: string | null
          counter: string
          estimated_minutes?: number | null
          id?: string
          issued_at?: string
          patient_id?: string | null
          served_at?: string | null
          status?: string
          token_no?: number
        }
        Update: {
          called_at?: string | null
          counter?: string
          estimated_minutes?: number | null
          id?: string
          issued_at?: string
          patient_id?: string | null
          served_at?: string | null
          status?: string
          token_no?: number
        }
        Relationships: []
      }
      radiology_orders: {
        Row: {
          amount: number | null
          created_at: string
          doctor_id: string | null
          id: string
          instructions: string | null
          investigation: string
          modality: string
          patient_id: string
          performed_at: string | null
          priority: string
          scheduled_at: string | null
          status: string
          technician_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          doctor_id?: string | null
          id?: string
          instructions?: string | null
          investigation: string
          modality: string
          patient_id: string
          performed_at?: string | null
          priority?: string
          scheduled_at?: string | null
          status?: string
          technician_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          doctor_id?: string | null
          id?: string
          instructions?: string | null
          investigation?: string
          modality?: string
          patient_id?: string
          performed_at?: string | null
          priority?: string
          scheduled_at?: string | null
          status?: string
          technician_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "radiology_orders_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radiology_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      radiology_reports: {
        Row: {
          created_at: string
          finalized_at: string | null
          findings: string | null
          id: string
          impression: string | null
          order_id: string
          radiologist_id: string | null
          status: string
          template_key: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          finalized_at?: string | null
          findings?: string | null
          id?: string
          impression?: string | null
          order_id: string
          radiologist_id?: string | null
          status?: string
          template_key?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          finalized_at?: string | null
          findings?: string | null
          id?: string
          impression?: string | null
          order_id?: string
          radiologist_id?: string | null
          status?: string
          template_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "radiology_reports_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "radiology_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_logs: {
        Row: {
          created_at: string
          data_size_mb: number | null
          duration_seconds: number | null
          id: string
          notes: string | null
          recovery_type: string
          status: string
        }
        Insert: {
          created_at?: string
          data_size_mb?: number | null
          duration_seconds?: number | null
          id?: string
          notes?: string | null
          recovery_type: string
          status: string
        }
        Update: {
          created_at?: string
          data_size_mb?: number | null
          duration_seconds?: number | null
          id?: string
          notes?: string | null
          recovery_type?: string
          status?: string
        }
        Relationships: []
      }
      recovery_notes: {
        Row: {
          created_at: string
          created_by: string | null
          discharge_recommendation: string | null
          icu_transfer: boolean
          id: string
          notes: string | null
          recovery_status: string | null
          surgery_id: string
          vitals: Json | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discharge_recommendation?: string | null
          icu_transfer?: boolean
          id?: string
          notes?: string | null
          recovery_status?: string | null
          surgery_id: string
          vitals?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discharge_recommendation?: string | null
          icu_transfer?: boolean
          id?: string
          notes?: string | null
          recovery_status?: string | null
          surgery_id?: string
          vitals?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "recovery_notes_surgery_id_fkey"
            columns: ["surgery_id"]
            isOneToOne: false
            referencedRelation: "surgeries"
            referencedColumns: ["id"]
          },
        ]
      }
      remote_monitoring: {
        Row: {
          alert: boolean | null
          followup_status: string | null
          id: string
          medication_compliance: number | null
          notes: string | null
          patient_id: string | null
          program_type: string
          recorded_at: string
          vitals: Json | null
        }
        Insert: {
          alert?: boolean | null
          followup_status?: string | null
          id?: string
          medication_compliance?: number | null
          notes?: string | null
          patient_id?: string | null
          program_type: string
          recorded_at?: string
          vitals?: Json | null
        }
        Update: {
          alert?: boolean | null
          followup_status?: string | null
          id?: string
          medication_compliance?: number | null
          notes?: string | null
          patient_id?: string | null
          program_type?: string
          recorded_at?: string
          vitals?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "remote_monitoring_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      research_studies: {
        Row: {
          created_at: string
          department: string | null
          description: string | null
          end_date: string | null
          ethics_approval: string | null
          id: string
          phase: string | null
          pi_name: string | null
          start_date: string | null
          status: string
          study_code: string
          target_enrollment: number | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          description?: string | null
          end_date?: string | null
          ethics_approval?: string | null
          id?: string
          phase?: string | null
          pi_name?: string | null
          start_date?: string | null
          status?: string
          study_code: string
          target_enrollment?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          description?: string | null
          end_date?: string | null
          ethics_approval?: string | null
          id?: string
          phase?: string | null
          pi_name?: string | null
          start_date?: string | null
          status?: string
          study_code?: string
          target_enrollment?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      resource_schedules: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          notes: string | null
          patient_id: string | null
          resource_name: string
          resource_type: string
          starts_at: string
          status: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          notes?: string | null
          patient_id?: string | null
          resource_name: string
          resource_type: string
          starts_at: string
          status?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          notes?: string | null
          patient_id?: string | null
          resource_name?: string
          resource_type?: string
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_schedules_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_assessments: {
        Row: {
          created_at: string
          factors: Json | null
          id: string
          patient_id: string | null
          recommendation: string | null
          risk_level: string
          risk_type: string
          score: number | null
          status: string | null
        }
        Insert: {
          created_at?: string
          factors?: Json | null
          id?: string
          patient_id?: string | null
          recommendation?: string | null
          risk_level: string
          risk_type: string
          score?: number | null
          status?: string | null
        }
        Update: {
          created_at?: string
          factors?: Json | null
          id?: string
          patient_id?: string | null
          recommendation?: string | null
          risk_level?: string
          risk_type?: string
          score?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          action: string
          created_at: string
          id: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      salary_slips: {
        Row: {
          allowances: number
          basic: number
          created_at: string
          da: number
          employee_id: string
          esi: number
          gross: number
          hra: number
          id: string
          leave_deduction: number
          net_pay: number
          other_deductions: number
          overtime: number
          payroll_run_id: string
          pf: number
          present_days: number
          professional_tax: number
          total_deductions: number
        }
        Insert: {
          allowances?: number
          basic?: number
          created_at?: string
          da?: number
          employee_id: string
          esi?: number
          gross?: number
          hra?: number
          id?: string
          leave_deduction?: number
          net_pay?: number
          other_deductions?: number
          overtime?: number
          payroll_run_id: string
          pf?: number
          present_days?: number
          professional_tax?: number
          total_deductions?: number
        }
        Update: {
          allowances?: number
          basic?: number
          created_at?: string
          da?: number
          employee_id?: string
          esi?: number
          gross?: number
          hra?: number
          id?: string
          leave_deduction?: number
          net_pay?: number
          other_deductions?: number
          overtime?: number
          payroll_run_id?: string
          pf?: number
          present_days?: number
          professional_tax?: number
          total_deductions?: number
        }
        Relationships: []
      }
      salary_structures: {
        Row: {
          allowances: number
          basic: number
          created_at: string
          da: number
          effective_from: string
          employee_id: string
          esi: number
          hra: number
          id: string
          other_deductions: number
          pf: number
          professional_tax: number
          updated_at: string
        }
        Insert: {
          allowances?: number
          basic?: number
          created_at?: string
          da?: number
          effective_from?: string
          employee_id: string
          esi?: number
          hra?: number
          id?: string
          other_deductions?: number
          pf?: number
          professional_tax?: number
          updated_at?: string
        }
        Update: {
          allowances?: number
          basic?: number
          created_at?: string
          da?: number
          effective_from?: string
          employee_id?: string
          esi?: number
          hra?: number
          id?: string
          other_deductions?: number
          pf?: number
          professional_tax?: number
          updated_at?: string
        }
        Relationships: []
      }
      scheme_beneficiaries: {
        Row: {
          coverage_balance: number
          created_at: string
          eligibility_status: string
          family_id: string | null
          id: string
          notes: string | null
          patient_id: string
          scheme_id: string
          scheme_name: string
          verified_at: string | null
        }
        Insert: {
          coverage_balance?: number
          created_at?: string
          eligibility_status?: string
          family_id?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          scheme_id: string
          scheme_name: string
          verified_at?: string | null
        }
        Update: {
          coverage_balance?: number
          created_at?: string
          eligibility_status?: string
          family_id?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          scheme_id?: string
          scheme_name?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      scheme_claims: {
        Row: {
          amount: number
          approved_at: string | null
          beneficiary_id: string
          created_at: string
          id: string
          notes: string | null
          package_id: string | null
          patient_id: string
          status: Database["public"]["Enums"]["claim_status"]
          submitted_at: string | null
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          beneficiary_id: string
          created_at?: string
          id?: string
          notes?: string | null
          package_id?: string | null
          patient_id: string
          status?: Database["public"]["Enums"]["claim_status"]
          submitted_at?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          beneficiary_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          package_id?: string | null
          patient_id?: string
          status?: Database["public"]["Enums"]["claim_status"]
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheme_claims_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "scheme_beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheme_claims_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "scheme_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      scheme_packages: {
        Row: {
          active: boolean
          amount: number
          created_at: string
          id: string
          package_code: string
          package_name: string
          scheme_name: string
        }
        Insert: {
          active?: boolean
          amount?: number
          created_at?: string
          id?: string
          package_code: string
          package_name: string
          scheme_name: string
        }
        Update: {
          active?: boolean
          amount?: number
          created_at?: string
          id?: string
          package_code?: string
          package_name?: string
          scheme_name?: string
        }
        Relationships: []
      }
      security_monitoring: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          risk_score: number | null
          severity: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          risk_score?: number | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          risk_score?: number | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          message_type: string
          patient_id: string | null
          recipient: string
          reference_id: string | null
          reference_type: string | null
          status: Database["public"]["Enums"]["comm_status"]
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          message_type: string
          patient_id?: string | null
          recipient: string
          reference_id?: string | null
          reference_type?: string | null
          status?: Database["public"]["Enums"]["comm_status"]
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          message_type?: string
          patient_id?: string | null
          recipient?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: Database["public"]["Enums"]["comm_status"]
        }
        Relationships: []
      }
      staffing_forecasts: {
        Row: {
          created_at: string
          department: string
          forecast_date: string
          id: string
          notes: string | null
          required_doctors: number | null
          required_nurses: number | null
          required_support: number | null
          workload_score: number | null
        }
        Insert: {
          created_at?: string
          department: string
          forecast_date: string
          id?: string
          notes?: string | null
          required_doctors?: number | null
          required_nurses?: number | null
          required_support?: number | null
          workload_score?: number | null
        }
        Update: {
          created_at?: string
          department?: string
          forecast_date?: string
          id?: string
          notes?: string | null
          required_doctors?: number | null
          required_nurses?: number | null
          required_support?: number | null
          workload_score?: number | null
        }
        Relationships: []
      }
      study_participants: {
        Row: {
          arm: string | null
          created_at: string
          enrollment_date: string
          id: string
          notes: string | null
          outcome: string | null
          patient_id: string
          status: string
          study_id: string
          updated_at: string
        }
        Insert: {
          arm?: string | null
          created_at?: string
          enrollment_date?: string
          id?: string
          notes?: string | null
          outcome?: string | null
          patient_id: string
          status?: string
          study_id: string
          updated_at?: string
        }
        Update: {
          arm?: string | null
          created_at?: string
          enrollment_date?: string
          id?: string
          notes?: string | null
          outcome?: string | null
          patient_id?: string
          status?: string
          study_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_participants_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_participants_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "research_studies"
            referencedColumns: ["id"]
          },
        ]
      }
      surgeries: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          admission_id: string | null
          anesthetist_id: string | null
          created_at: string
          created_by: string | null
          estimated_cost: number
          id: string
          notes: string | null
          ot_room_id: string | null
          patient_id: string
          primary_surgeon_id: string | null
          priority: Database["public"]["Enums"]["surgery_priority"]
          procedure_code: string | null
          procedure_name: string
          scheduled_end: string
          scheduled_start: string
          status: Database["public"]["Enums"]["surgery_status"]
          surgery_no: string
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          admission_id?: string | null
          anesthetist_id?: string | null
          created_at?: string
          created_by?: string | null
          estimated_cost?: number
          id?: string
          notes?: string | null
          ot_room_id?: string | null
          patient_id: string
          primary_surgeon_id?: string | null
          priority?: Database["public"]["Enums"]["surgery_priority"]
          procedure_code?: string | null
          procedure_name: string
          scheduled_end: string
          scheduled_start: string
          status?: Database["public"]["Enums"]["surgery_status"]
          surgery_no?: string
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          admission_id?: string | null
          anesthetist_id?: string | null
          created_at?: string
          created_by?: string | null
          estimated_cost?: number
          id?: string
          notes?: string | null
          ot_room_id?: string | null
          patient_id?: string
          primary_surgeon_id?: string | null
          priority?: Database["public"]["Enums"]["surgery_priority"]
          procedure_code?: string | null
          procedure_name?: string
          scheduled_end?: string
          scheduled_start?: string
          status?: Database["public"]["Enums"]["surgery_status"]
          surgery_no?: string
          updated_at?: string
        }
        Relationships: []
      }
      surgery_checklists: {
        Row: {
          anesthesia_clearance: boolean
          blood_available: boolean
          consent_signed: boolean
          fitness_clearance: boolean
          id: string
          insurance_approved: boolean
          lab_completed: boolean
          notes: string | null
          surgery_id: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          anesthesia_clearance?: boolean
          blood_available?: boolean
          consent_signed?: boolean
          fitness_clearance?: boolean
          id?: string
          insurance_approved?: boolean
          lab_completed?: boolean
          notes?: string | null
          surgery_id: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          anesthesia_clearance?: boolean
          blood_available?: boolean
          consent_signed?: boolean
          fitness_clearance?: boolean
          id?: string
          insurance_approved?: boolean
          lab_completed?: boolean
          notes?: string | null
          surgery_id?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surgery_checklists_surgery_id_fkey"
            columns: ["surgery_id"]
            isOneToOne: false
            referencedRelation: "surgeries"
            referencedColumns: ["id"]
          },
        ]
      }
      surgery_notes: {
        Row: {
          blood_loss_ml: number | null
          complications: string | null
          created_at: string
          created_by: string | null
          findings: string | null
          id: string
          implants_used: string | null
          procedure_performed: string | null
          remarks: string | null
          surgery_id: string
        }
        Insert: {
          blood_loss_ml?: number | null
          complications?: string | null
          created_at?: string
          created_by?: string | null
          findings?: string | null
          id?: string
          implants_used?: string | null
          procedure_performed?: string | null
          remarks?: string | null
          surgery_id: string
        }
        Update: {
          blood_loss_ml?: number | null
          complications?: string | null
          created_at?: string
          created_by?: string | null
          findings?: string | null
          id?: string
          implants_used?: string | null
          procedure_performed?: string | null
          remarks?: string | null
          surgery_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "surgery_notes_surgery_id_fkey"
            columns: ["surgery_id"]
            isOneToOne: false
            referencedRelation: "surgeries"
            referencedColumns: ["id"]
          },
        ]
      }
      surgery_team: {
        Row: {
          created_at: string
          id: string
          member_name: string
          role: string
          surgery_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          member_name: string
          role: string
          surgery_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          member_name?: string
          role?: string
          surgery_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surgery_team_surgery_id_fkey"
            columns: ["surgery_id"]
            isOneToOne: false
            referencedRelation: "surgeries"
            referencedColumns: ["id"]
          },
        ]
      }
      telemedicine_messages: {
        Row: {
          attachment_url: string | null
          body: string | null
          created_at: string
          id: string
          sender_id: string
          session_id: string
        }
        Insert: {
          attachment_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          sender_id: string
          session_id: string
        }
        Update: {
          attachment_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          sender_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telemedicine_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "telemedicine_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      telemedicine_sessions: {
        Row: {
          appointment_id: string | null
          created_at: string
          doctor_id: string
          ended_at: string | null
          id: string
          notes: string | null
          patient_id: string
          room_url: string | null
          scheduled_at: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          doctor_id: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          room_url?: string | null
          scheduled_at: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          doctor_id?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          room_url?: string | null
          scheduled_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          branch_id: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          txn_date: string
          type: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          branch_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          txn_date?: string
          type: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          branch_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          txn_date?: string
          type?: string
        }
        Relationships: []
      }
      triage_records: {
        Row: {
          assessed_by: string | null
          assessment: string | null
          created_at: string
          emergency_case_id: string
          id: string
          level: Database["public"]["Enums"]["triage_level"]
          vitals: Json | null
        }
        Insert: {
          assessed_by?: string | null
          assessment?: string | null
          created_at?: string
          emergency_case_id: string
          id?: string
          level: Database["public"]["Enums"]["triage_level"]
          vitals?: Json | null
        }
        Update: {
          assessed_by?: string | null
          assessment?: string | null
          created_at?: string
          emergency_case_id?: string
          id?: string
          level?: Database["public"]["Enums"]["triage_level"]
          vitals?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "triage_records_emergency_case_id_fkey"
            columns: ["emergency_case_id"]
            isOneToOne: false
            referencedRelation: "emergency_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vaccinations: {
        Row: {
          administered_by: string | null
          batch_no: string | null
          created_at: string
          dose_number: number | null
          due_date: string | null
          given_date: string | null
          id: string
          notes: string | null
          patient_id: string
          status: string
          updated_at: string
          vaccine_name: string
        }
        Insert: {
          administered_by?: string | null
          batch_no?: string | null
          created_at?: string
          dose_number?: number | null
          due_date?: string | null
          given_date?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          status?: string
          updated_at?: string
          vaccine_name: string
        }
        Update: {
          administered_by?: string | null
          batch_no?: string | null
          created_at?: string
          dose_number?: number | null
          due_date?: string | null
          given_date?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          status?: string
          updated_at?: string
          vaccine_name?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          active: boolean
          address: string | null
          category: string
          contact_person: string | null
          created_at: string
          email: string | null
          gst_number: string | null
          id: string
          name: string
          payment_terms: string | null
          phone: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          category: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          name: string
          payment_terms?: string | null
          phone?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          category?: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          name?: string
          payment_terms?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      vitals: {
        Row: {
          admission_id: string | null
          diastolic: number | null
          id: string
          notes: string | null
          oxygen: number | null
          patient_id: string
          pulse: number | null
          recorded_at: string
          recorded_by: string | null
          sugar: number | null
          systolic: number | null
          temperature: number | null
          weight: number | null
        }
        Insert: {
          admission_id?: string | null
          diastolic?: number | null
          id?: string
          notes?: string | null
          oxygen?: number | null
          patient_id: string
          pulse?: number | null
          recorded_at?: string
          recorded_by?: string | null
          sugar?: number | null
          systolic?: number | null
          temperature?: number | null
          weight?: number | null
        }
        Update: {
          admission_id?: string | null
          diastolic?: number | null
          id?: string
          notes?: string | null
          oxygen?: number | null
          patient_id?: string
          pulse?: number | null
          recorded_at?: string
          recorded_by?: string | null
          sugar?: number | null
          systolic?: number | null
          temperature?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vitals_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitals_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      wards: {
        Row: {
          created_at: string
          description: string | null
          floor: string | null
          id: string
          name: string
          type: Database["public"]["Enums"]["ward_type"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          floor?: string | null
          id?: string
          name: string
          type: Database["public"]["Enums"]["ward_type"]
        }
        Update: {
          created_at?: string
          description?: string | null
          floor?: string | null
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["ward_type"]
        }
        Relationships: []
      }
      whatsapp_campaigns: {
        Row: {
          audience: Json | null
          created_at: string
          delivered_count: number | null
          id: string
          name: string
          read_count: number | null
          sent_count: number | null
          status: string
          template: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          audience?: Json | null
          created_at?: string
          delivered_count?: number | null
          id?: string
          name: string
          read_count?: number | null
          sent_count?: number | null
          status?: string
          template: string
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          audience?: Json | null
          created_at?: string
          delivered_count?: number | null
          id?: string
          name?: string
          read_count?: number | null
          sent_count?: number | null
          status?: string
          template?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_logs: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          message_type: string
          patient_id: string | null
          recipient: string
          reference_id: string | null
          reference_type: string | null
          status: Database["public"]["Enums"]["comm_status"]
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          message_type: string
          patient_id?: string | null
          recipient: string
          reference_id?: string | null
          reference_type?: string | null
          status?: Database["public"]["Enums"]["comm_status"]
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          message_type?: string
          patient_id?: string | null
          recipient?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: Database["public"]["Enums"]["comm_status"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gen_admission_no: { Args: never; Returns: string }
      gen_asset_no: { Args: never; Returns: string }
      gen_bill_no: { Args: never; Returns: string }
      gen_claim_no: { Args: never; Returns: string }
      gen_dispatch_no: { Args: never; Returns: string }
      gen_emergency_no: { Args: never; Returns: string }
      gen_employee_no: { Args: never; Returns: string }
      gen_grn_no: { Args: never; Returns: string }
      gen_lab_order_no: { Args: never; Returns: string }
      gen_pharm_invoice_no: { Args: never; Returns: string }
      gen_po_no: { Args: never; Returns: string }
      gen_pr_no: { Args: never; Returns: string }
      gen_surgery_no: { Args: never; Returns: string }
      generate_uhid: { Args: never; Returns: string }
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_module_permission: {
        Args: { _action?: string; _module: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      log_audit_event: {
        Args: {
          _action: string
          _after?: Json
          _before?: Json
          _entity: string
          _entity_id?: string
        }
        Returns: string
      }
      mark_password_changed: { Args: never; Returns: undefined }
    }
    Enums: {
      admission_status: "active" | "discharged" | "transferred" | "cancelled"
      ambulance_status:
        | "available"
        | "on_duty"
        | "maintenance"
        | "out_of_service"
      app_role:
        | "admin"
        | "doctor"
        | "receptionist"
        | "nurse"
        | "pharmacist"
        | "lab_technician"
        | "accountant"
        | "lab_tech"
        | "surgeon"
        | "insurance_officer"
        | "ot_coordinator"
        | "ambulance_driver"
        | "super_admin"
        | "hr_manager"
        | "finance_manager"
        | "dept_head"
        | "procurement_officer"
        | "patient"
      appointment_status:
        | "booked"
        | "checked_in"
        | "waiting"
        | "completed"
        | "cancelled"
      bed_status:
        | "available"
        | "occupied"
        | "cleaning"
        | "reserved"
        | "maintenance"
      bill_status: "draft" | "partial" | "paid" | "cancelled"
      claim_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "settled"
      comm_status: "queued" | "sent" | "delivered" | "read" | "failed"
      dispatch_status:
        | "requested"
        | "dispatched"
        | "en_route"
        | "arrived"
        | "returning"
        | "completed"
        | "cancelled"
      emergency_status:
        | "waiting"
        | "in_treatment"
        | "admitted"
        | "discharged"
        | "referred"
        | "deceased"
      gender_type: "male" | "female" | "other"
      lab_order_status:
        | "ordered"
        | "sample_collected"
        | "in_progress"
        | "completed"
        | "cancelled"
      mar_status: "scheduled" | "administered" | "missed" | "held"
      notification_priority: "low" | "normal" | "high" | "critical"
      payment_method:
        | "cash"
        | "upi"
        | "card"
        | "bank_transfer"
        | "insurance"
        | "credit"
      surgery_priority: "emergency" | "urgent" | "elective"
      surgery_status:
        | "scheduled"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "postponed"
      triage_level: "red" | "orange" | "yellow" | "green"
      ward_type: "icu" | "general" | "semi_private" | "private" | "emergency"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admission_status: ["active", "discharged", "transferred", "cancelled"],
      ambulance_status: [
        "available",
        "on_duty",
        "maintenance",
        "out_of_service",
      ],
      app_role: [
        "admin",
        "doctor",
        "receptionist",
        "nurse",
        "pharmacist",
        "lab_technician",
        "accountant",
        "lab_tech",
        "surgeon",
        "insurance_officer",
        "ot_coordinator",
        "ambulance_driver",
        "super_admin",
        "hr_manager",
        "finance_manager",
        "dept_head",
        "procurement_officer",
        "patient",
      ],
      appointment_status: [
        "booked",
        "checked_in",
        "waiting",
        "completed",
        "cancelled",
      ],
      bed_status: [
        "available",
        "occupied",
        "cleaning",
        "reserved",
        "maintenance",
      ],
      bill_status: ["draft", "partial", "paid", "cancelled"],
      claim_status: [
        "draft",
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "settled",
      ],
      comm_status: ["queued", "sent", "delivered", "read", "failed"],
      dispatch_status: [
        "requested",
        "dispatched",
        "en_route",
        "arrived",
        "returning",
        "completed",
        "cancelled",
      ],
      emergency_status: [
        "waiting",
        "in_treatment",
        "admitted",
        "discharged",
        "referred",
        "deceased",
      ],
      gender_type: ["male", "female", "other"],
      lab_order_status: [
        "ordered",
        "sample_collected",
        "in_progress",
        "completed",
        "cancelled",
      ],
      mar_status: ["scheduled", "administered", "missed", "held"],
      notification_priority: ["low", "normal", "high", "critical"],
      payment_method: [
        "cash",
        "upi",
        "card",
        "bank_transfer",
        "insurance",
        "credit",
      ],
      surgery_priority: ["emergency", "urgent", "elective"],
      surgery_status: [
        "scheduled",
        "in_progress",
        "completed",
        "cancelled",
        "postponed",
      ],
      triage_level: ["red", "orange", "yellow", "green"],
      ward_type: ["icu", "general", "semi_private", "private", "emergency"],
    },
  },
} as const
