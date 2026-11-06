// Minimal GitHub REST client for the CI scripts: GITHUB_TOKEN and GITHUB_REPOSITORY come from Actions.
import { readFileSync } from 'node:fs';
import type { RunSummary } from '../src/summary.ts';

export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export async function gh<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://api.github.com/repos/${env('GITHUB_REPOSITORY')}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${env('GITHUB_TOKEN')}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Every page of a list endpoint. */
export async function ghAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; ; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const batch = await gh<T[]>('GET', `${path}${sep}per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) return out;
  }
}

export function readSummary(file: string): RunSummary {
  return JSON.parse(readFileSync(file, 'utf8')) as RunSummary;
}
