import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const caseStudies = defineCollection({
  loader: glob({ pattern: 'case-study-*.md', base: './content', generateId: ({ entry }) => entry.replace(/^case-study-|\.md$/g, '') }),
  schema: z.object({
    title: z.string(),
    role: z.string(),
    company: z.string(),
    period: z.string(),
    status: z.enum(['draft', 'ready']),
    summary: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { caseStudies };
