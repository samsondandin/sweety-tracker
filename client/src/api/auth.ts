import { apiRequest } from './client';

export interface User {
  id: string;
  name: string;
  email: string;
  profile?: {
    full_name: string;
    display_name: string | null;
    timezone: string;
  };
}

export interface AuthResponse {
  user: User;
  token: string;
}

export const authApi = {
  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const res = await apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    localStorage.setItem('sweety_auth_token', res.token);
    return res;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    localStorage.setItem('sweety_auth_token', res.token);
    return res;
  },

  async logout(): Promise<void> {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      localStorage.removeItem('sweety_auth_token');
    }
  },

  async getMe(): Promise<{ user: User }> {
    return apiRequest<{ user: User }>('/auth/me');
  },

  async updateProfile(profile: { full_name?: string; display_name?: string | null; timezone?: string }) {
    return apiRequest<{ profile: any }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profile)
    });
  }
};

