import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type JobRecord = { ownerId: string; createdAt: string };
type JobStore = Record<string, JobRecord>;

const storePath = path.join(process.cwd(), 'data', 'generation-jobs.json');

async function readJobs(): Promise<JobStore> {
  try {
    const parsed = JSON.parse(await readFile(storePath, 'utf8')) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as JobStore : {};
  } catch {
    return {};
  }
}

async function saveJobs(jobs: JobStore) {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(jobs, null, 2), 'utf8');
}

export async function registerGenerationJob(ticketId: string, ownerId: string) {
  const jobs = await readJobs();
  await saveJobs({ ...jobs, [ticketId]: { ownerId, createdAt: new Date().toISOString() } });
}

export async function canAccessGenerationJob(ticketId: string, ownerId: string) {
  const job = (await readJobs())[ticketId];
  return !!job && job.ownerId === ownerId;
}
