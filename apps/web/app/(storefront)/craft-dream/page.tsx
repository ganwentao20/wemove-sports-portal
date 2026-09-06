import { SectionLanding } from '../../../components/section-landing';
import { getSiteSection } from '../../../lib/site-sections';

export default function CraftDreamPage() {
  return <SectionLanding section={getSiteSection('/craft-dream')!} />;
}
