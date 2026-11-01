// Single loader for content.json. Strips TODO values and *Note fields, checks that
// referenced public assets exist, and collects everything missing as build warnings.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'astro/zod';

const root = process.cwd();

const month = z.string().regex(/^\d{4}-\d{2}$/);
const nullableStr = z.string().nullable().optional();

const schema = z.object({
  profile: z.object({
    name: z.string(),
    role: z.string(),
    headline: z.string(),
    valueProposition: z.string(),
    location: nullableStr,
    education: z.object({ school: z.string(), program: z.string() }).optional(),
    photo: nullableStr,
    cv: nullableStr,
  }),
  contact: z.object({ email: nullableStr, linkedin: nullableStr }),
  highlights: z.array(z.object({ label: z.string(), detail: z.string(), evidence: z.string() })),
  about: z.array(z.string()),
  howIWork: z.object({
    steps: z.array(z.object({ title: z.string(), icon: z.string(), text: z.string(), evidence: z.string(), anchor: z.string() })),
  }),
  experience: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      company: z.string(),
      legalEntity: nullableStr,
      type: nullableStr,
      start: month,
      end: month.nullable(),
      location: nullableStr,
      points: z.array(z.string()),
      award: nullableStr,
      certificate: nullableStr,
      caseStudy: nullableStr,
    }),
  ),
  skills: z.array(z.object({ group: z.string(), items: z.array(z.string()), evidence: z.array(z.string()) })),
  certificates: z.array(
    z.object({
      id: z.string(),
      group: z.enum(['Product', 'AI', 'Technical']),
      title: z.string(),
      issuer: z.string(),
      issued: month,
      credentialId: nullableStr,
      file: nullableStr,
    }),
  ),
});

export const missing: string[] = [];

const isTodo = (v: unknown) => typeof v === 'string' && /^TODO\b/.test(v.trim());

// Removes *Note fields and TODO values (recording each), recursively.
function clean(value: unknown, path: string): unknown {
  if (Array.isArray(value)) {
    return value.map((v, i) => clean(v, `${path}[${i}]`)).filter((v) => v !== undefined);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('_')) continue;
      // Notes are never rendered; what they ask for is reported by the concrete checks below.
      if (k.endsWith('Note')) continue;
      const c = clean(v, `${path}.${k}`);
      if (c !== undefined) out[k] = c;
    }
    return out;
  }
  if (isTodo(value)) {
    missing.push(`${path}: value is TODO`);
    return undefined;
  }
  return value;
}

const raw = JSON.parse(readFileSync(join(root, 'content.json'), 'utf8'));
const content = schema.parse(clean(raw, 'content'));

// Public asset paths that point to files that don't exist are dropped.
const publicFile = (p: string | null | undefined, label: string) => {
  if (!p) return null;
  if (existsSync(join(root, 'public', p))) return p;
  missing.push(`${label}: file not found at public${p}`);
  return null;
};

content.profile.photo = publicFile(content.profile.photo, 'profile.photo');
content.profile.cv = publicFile(content.profile.cv, 'profile.cv');
for (const e of content.experience) e.certificate = publicFile(e.certificate, `experience.${e.id}.certificate`);
for (const c of content.certificates) c.file = publicFile(c.file, `certificates.${c.id}.file`);
for (const e of content.experience) {
  if (e.points.length === 0) missing.push(`experience.${e.id}: no impact points (points list hidden)`);
}

// Case study status (rendering itself goes through the content collection).
const caseStudyMd = readFileSync(join(root, 'content/case-study-mepo.md'), 'utf8');
export const caseStudyReady = /^status:\s*ready\s*$/m.test(caseStudyMd);
if (!caseStudyReady) missing.push('content/case-study-mepo.md: status is not "ready" (page not rendered, card shows "Coming soon")');

export const { profile, contact, highlights, about, howIWork, experience, skills, certificates } = content;
export const initials = profile.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('');
export type Experience = (typeof experience)[number];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const formatMonth = (ym: string | null) => {
  if (!ym) return 'Present';
  const [y, m] = ym.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
};

export type Evidence = { label: string; href: string; external: boolean };

// "experience:<id>" | "certificate:<id>" | "skills" → a link on this page or to a PDF.
export function resolveEvidence(ref: string): Evidence | null {
  const [kind, id] = ref.split(':');
  if (kind === 'skills') return { label: 'See skills', href: '#skills', external: false };
  if (kind === 'experience') {
    const e = experience.find((x) => x.id === id);
    if (e) return { label: `${e.title}, ${e.company}`, href: `#exp-${e.id}`, external: false };
  }
  if (kind === 'certificate') {
    const c = certificates.find((x) => x.id === id);
    if (c?.file) return { label: `${c.title} (PDF)`, href: c.file, external: true };
  }
  return null;
}

// Report unresolved evidence once, at load time.
for (const ref of [...highlights.map((h) => h.evidence), ...skills.flatMap((s) => s.evidence)]) {
  if (!resolveEvidence(ref)) missing.push(`evidence "${ref}" does not resolve to an experience or certificate file`);
}
