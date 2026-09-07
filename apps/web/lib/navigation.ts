export type NavigationItem = {
  label: string;
  href: string;
  zh?: string;
  labels?: Record<string, string>;
  markets?: string[];
  children?: NavigationItem[];
};
