import { SectionLanding } from '../../../components/section-landing';
import { getSiteSection } from '../../../lib/site-sections';

export default function CustomFurniturePage() {
  return <SectionLanding section={getSiteSection('/custom-furniture')!} />;
}
