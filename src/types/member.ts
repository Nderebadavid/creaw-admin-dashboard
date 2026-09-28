export interface Member {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string | null;
  national_id: string | null;
  gender: string | null;
  date_joined: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
