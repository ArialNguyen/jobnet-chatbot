import ProfessionType from './profession';
import { BusinessPostType } from './business';
import LevelType from './level';
import BenefitType from './benefit';
import RecruiterType from './recruiter';
import LocationType from './location';

export type PostActiveStatus =
  | 'Pending'
  | 'Opening'
  | 'Closed'
  | 'Stopped'
  | 'Blocked'
  | 'Rejected';

export default interface PostType {
  id: string;
  title: string;
  profession: ProfessionType | undefined;
  minSalary: string | number;
  minSalaryString: string;
  maxSalary: string | number; 
  maxSalaryString: string;
  level: LevelType;
  locations: Array<LocationType>;
  workingFormat: string;
  benefits: Array<BenefitType>;
  description: string;
  yearsOfExperience: string;
  // degrees: Array<DegreeType>
  otherRequirements: string;
  requisitionNumber: number;
  // internalContact: string
  applicationDeadline: string;
  jdId: string | null;
  recruiterId: RecruiterType | null;
  business: BusinessPostType;
  activeStatus: PostActiveStatus;
  totalViews: number;
  createdAt: string;
}

