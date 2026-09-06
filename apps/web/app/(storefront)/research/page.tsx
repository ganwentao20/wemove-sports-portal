import { SectionLanding } from '../../../components/section-landing';
import { getSiteSection } from '../../../lib/site-sections';

export default function ResearchPage() {
  return <SectionLanding section={getSiteSection('/research')!} />;
}
