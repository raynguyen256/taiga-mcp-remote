import NodeCache from 'node-cache';

export class Cache {
  private store: NodeCache;

  constructor(defaultTtl = 300) {
    this.store = new NodeCache({ stdTTL: defaultTtl });
  }

  get<T>(key: string): T | undefined {
    return this.store.get<T>(key);
  }

  set<T>(key: string, value: T, ttl?: number): void {
    this.store.set(key, value, ttl ?? 0);
  }

  del(key: string): void {
    this.store.del(key);
  }

  flush(): void {
    this.store.flushAll();
  }
}

export const cacheKey = {
  projectStats: (id: number) => `project:${id}:stats`,
  projectIssuesStats: (id: number) => `project:${id}:issues-stats`,
  userstoryStatuses: (projectId: number) => `project:${projectId}:us-statuses`,
  taskStatuses: (projectId: number) => `project:${projectId}:task-statuses`,
  issueStatuses: (projectId: number) => `project:${projectId}:issue-statuses`,
  issueTypes: (projectId: number) => `project:${projectId}:issue-types`,
  priorities: (projectId: number) => `project:${projectId}:priorities`,
  severities: (projectId: number) => `project:${projectId}:severities`,
  members: (projectId: number) => `project:${projectId}:members`,
};
