import { SectionLanding } from '../../../components/section-landing';
import { getSiteSection } from '../../../lib/site-sections';

export default function CharityPage() {
  return <SectionLanding section={getSiteSection('/charity')!} />;
}
