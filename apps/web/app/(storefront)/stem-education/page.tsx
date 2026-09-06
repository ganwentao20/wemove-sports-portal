import { SectionLanding } from '../../../components/section-landing';
import { getSiteSection } from '../../../lib/site-sections';

export default function StemEducationPage() {
  return <SectionLanding section={getSiteSection('/stem-education')!} />;
}
