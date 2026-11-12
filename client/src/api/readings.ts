import { apiRequest } from './client';
import { type GlucoseReading } from '../lib/glucose';

export interface PaginatedReadings {
  data: GlucoseReading[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const readingsApi = {
  async list(params: { page?: number; limit?: number; readingDate?: string } = {}): Promise<PaginatedReadings> {
    const search = new URLSearchParams();
    if (params.page) search.set('page', String(params.page));
    if (params.limit) search.set('limit', String(params.limit));
    if (params.readingDate) search.set('readingDate', params.readingDate);

    const query = search.toString();
    return apiRequest<PaginatedReadings>(`/readings${query ? `?${query}` : ''}`);
  },

  async create(reading: { reading_date: string; time_slot: string; value_mg_dl: number }): Promise<{ data: GlucoseReading }> {
    return apiRequest<{ data: GlucoseReading }>('/readings', {
      method: 'POST',
      body: JSON.stringify(reading)
    });
  },

  async update(id: string, reading: { reading_date?: string; time_slot?: string; value_mg_dl?: number }): Promise<{ data: GlucoseReading }> {
    return apiRequest<{ data: GlucoseReading }>(`/readings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(reading)
    });
  },

  async delete(id: string): Promise<void> {
    await apiRequest(`/readings/${id}`, {
      method: 'DELETE'
    });
  }
};

