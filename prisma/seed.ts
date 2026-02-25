import { PrismaClient, TemplateType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await Promise.all([
    prisma.user.upsert({
      where: { username: 'akbar' },
      update: {},
      create: { username: 'akbar', displayName: 'Fadhil Akbar' }
    }),
    prisma.user.upsert({
      where: { username: 'globaldev' },
      update: {},
      create: { username: 'globaldev', displayName: 'Global Dev' }
    })
  ]);

  const templates = [
    {
      slug: 'ultra-fast-nextjs-boilerplate',
      title: 'Ultra Fast Next.js Boilerplate',
      summary: 'Code template with production setup for Vercel + Railway + Prisma.',
      content: 'Production-ready starter with auth, API routes, metrics, edge cache, and CI.',
      type: TemplateType.CODE,
      tags: ['nextjs', 'prisma', 'vercel', 'railway'],
      featured: true,
      ownerId: users[0].id
    },
    {
      slug: 'startup-idea-ai-lms',
      title: 'Startup Idea: AI-Powered LMS',
      summary: 'Blueprint for an adaptive AI-powered education product.',
      content: 'Includes market analysis, GTM strategy, business model, and full technical architecture.',
      type: TemplateType.IDEA,
      tags: ['ai', 'edtech', 'startup'],
      featured: true,
      ownerId: users[1].id
    },
    {
      slug: 'short-story-neon-rain',
      title: 'Short Story: Neon Rain',
      summary: 'Short cyberpunk story template ready for remix.',
      content: 'Night falls over Neo-Jakarta. Neon rain reflects off an old visor...',
      type: TemplateType.STORY,
      tags: ['story', 'cyberpunk'],
      featured: true,
      ownerId: users[1].id
    }
  ];

  for (const t of templates) {
    await prisma.template.upsert({
      where: { slug: t.slug },
      update: {
        ...t,
        searchDocument: `${t.title} ${t.summary} ${t.content} ${t.tags.join(' ')}`
      },
      create: {
        ...t,
        searchDocument: `${t.title} ${t.summary} ${t.content} ${t.tags.join(' ')}`
      }
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
