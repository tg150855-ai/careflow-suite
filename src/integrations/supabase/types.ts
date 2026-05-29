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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gen_admission_no: { Args: never; Returns: string }
      gen_bill_no: { Args: never; Returns: string }
      gen_lab_order_no: { Args: never; Returns: string }
      gen_pharm_invoice_no: { Args: never; Returns: string }
      generate_uhid: { Args: never; Returns: string }
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      admission_status: "active" | "discharged" | "transferred" | "cancelled"
      app_role:
        | "admin"
        | "doctor"
        | "receptionist"
        | "nurse"
        | "pharmacist"
        | "lab_technician"
        | "accountant"
        | "lab_tech"
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
      gender_type: "male" | "female" | "other"
      lab_order_status:
        | "ordered"
        | "sample_collected"
        | "in_progress"
        | "completed"
        | "cancelled"
      mar_status: "scheduled" | "administered" | "missed" | "held"
      payment_method:
        | "cash"
        | "upi"
        | "card"
        | "bank_transfer"
        | "insurance"
        | "credit"
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
      app_role: [
        "admin",
        "doctor",
        "receptionist",
        "nurse",
        "pharmacist",
        "lab_technician",
        "accountant",
        "lab_tech",
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
      gender_type: ["male", "female", "other"],
      lab_order_status: [
        "ordered",
        "sample_collected",
        "in_progress",
        "completed",
        "cancelled",
      ],
      mar_status: ["scheduled", "administered", "missed", "held"],
      payment_method: [
        "cash",
        "upi",
        "card",
        "bank_transfer",
        "insurance",
        "credit",
      ],
      ward_type: ["icu", "general", "semi_private", "private", "emergency"],
    },
  },
} as const
