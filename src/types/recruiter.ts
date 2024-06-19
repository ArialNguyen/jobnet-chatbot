import BusinessType from "./business";

export default interface RecruiterType {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string;
  profileImageId: string;
  nation: string;
  activeBusiness: boolean;
  business: BusinessType;
  locked: boolean;
}

export interface FormUpdateProfileRCProps {
  email: string;
  name: string;
  phone: string;
  nation: string;
}
