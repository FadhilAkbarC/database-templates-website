import { TemplateCard } from '@/components/TemplateCard';

export type FeaturedItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  type: string;
  tags: string[];
  featured: boolean;
  owner?: { displayName: string };
};

type Props = {
  items: FeaturedItem[];
  error?: string;
};

export function FeaturedTemplates({ items, error = '' }: Props) {
  if (error) {
    return <p className="muted">{error}</p>;
  }

  if (items.length === 0) {
    return <p className="muted">No featured templates yet.</p>;
  }

  return (
    <div className="grid">
      {items.map((item) => (
        <TemplateCard key={item.id} template={item} />
      ))}
    </div>
  );
}
