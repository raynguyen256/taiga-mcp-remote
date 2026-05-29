import axios, { type AxiosInstance } from 'axios';
import FormData from 'form-data';
import type { SessionAuthManager } from './SessionAuthManager.js';
import type { AppConfig } from '../types/config.js';

export class TaigaClient {
  private http: AxiosInstance;

  constructor(
    private auth: SessionAuthManager,
    config: AppConfig,
  ) {
    this.http = axios.create({
      baseURL: config.baseUrl,
      timeout: config.requestTimeout,
    });

    this.http.interceptors.request.use(req => {
      req.headers.Authorization = `Bearer ${this.auth.getToken()}`;
      return req;
    });

    this.http.interceptors.response.use(
      res => res,
      async err => {
        const reqConfig = err.config as typeof err.config & { _retried?: boolean };
        const status = err.response?.status;

        if (status === 401 && !reqConfig._retried) {
          reqConfig._retried = true;
          try {
            await this.auth.refresh();
            reqConfig.headers.Authorization = `Bearer ${this.auth.getToken()}`;
            return this.http(reqConfig);
          } catch {
            return Promise.reject(err);
          }
        }

        if (status === 429) {
          const retryAfter = parseInt(err.response?.headers?.['retry-after'] ?? '5', 10);
          await new Promise(r => setTimeout(r, retryAfter * 1000));
          return this.http(reqConfig);
        }

        return Promise.reject(err);
      },
    );
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const r = await this.http.get<T>(path, { params });
    return r.data;
  }

  async getAll<T>(path: string, params?: Record<string, unknown>): Promise<T[]> {
    const r = await this.http.get<T[]>(path, {
      params,
      headers: { 'x-disable-pagination': 'True' },
    });
    return r.data;
  }

  async post<T>(path: string, data?: unknown): Promise<T> {
    const r = await this.http.post<T>(path, data);
    return r.data;
  }

  async patch<T>(path: string, data?: unknown): Promise<T> {
    const r = await this.http.patch<T>(path, data);
    return r.data;
  }

  async delete(path: string): Promise<void> {
    await this.http.delete(path);
  }

  async getRaw<T>(path: string, params?: Record<string, unknown>, extraConfig?: object): Promise<T> {
    const r = await this.http.get<T>(path, { params, ...extraConfig });
    return r.data;
  }

  async postFormData<T>(path: string, form: FormData): Promise<T> {
    const r = await this.http.post<T>(path, form, {
      headers: form.getHeaders(),
      timeout: 300_000,
    });
    return r.data;
  }
}
