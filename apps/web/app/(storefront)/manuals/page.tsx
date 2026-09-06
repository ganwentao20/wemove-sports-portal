import { SectionLanding } from '../../../components/section-landing';
import { getSiteSection } from '../../../lib/site-sections';

export default function ManualsPage() {
  return <SectionLanding section={getSiteSection('/manuals')!} />;
}
