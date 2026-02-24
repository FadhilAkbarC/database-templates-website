import Link from 'next/link';

type Props = {
  template: {
    id: string;
    slug: string;
    title: string;
    summary: string;
    type: string;
    tags: string[];
    featured: boolean;
    owner?: { displayName: string };
  };
};

export function TemplateCard({ template }: Props) {
  return (
    <Link href={`/template/${template.slug}`} className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong>{template.title}</strong>
        {template.featured && <span style={{ color: '#ffd166' }}>* Featured</span>}
      </div>

      <p className="muted" style={{ minHeight: 48 }}>
        {template.summary}
      </p>

      <div className="row" style={{ flexWrap: 'wrap' }}>
        <small>{template.type}</small>
        {template.tags.slice(0, 4).map((tag) => (
          <small key={tag} className="muted">
            #{tag}
          </small>
        ))}
      </div>

      {template.owner && <small className="muted">by {template.owner.displayName}</small>}
    </Link>
  );
}
