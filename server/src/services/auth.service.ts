import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error.middleware.js';

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  profile?: {
    full_name: string;
    display_name: string | null;
    timezone: string;
  };
}

export class AuthService {
  static async register(name: string, email: string, password: string): Promise<{ user: UserDTO; token: string }> {
    const normalizedEmail = email.trim().toLowerCase();

    // Check existing email
    const existing = await query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      throw new AppError('An account with this email already exists.', 409);
    }

    // Hash password with 10 salt rounds
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const userResult = await query<{ id: string; name: string; email: string }>(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name.trim(), normalizedEmail, passwordHash]
    );

    const newUser = userResult.rows[0];

    // Initialize default profile
    await query(
      `INSERT INTO profiles (id, full_name, display_name, timezone)
       VALUES ($1, $2, $3, 'UTC')
       ON CONFLICT (id) DO NOTHING`,
      [newUser.id, newUser.name, newUser.name]
    );

    const token = this.generateToken(newUser);

    return {
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        profile: {
          full_name: newUser.name,
          display_name: newUser.name,
          timezone: 'UTC'
        }
      },
      token
    };
  }

  static async login(email: string, password: string): Promise<{ user: UserDTO; token: string }> {
    const normalizedEmail = email.trim().toLowerCase();

    const userResult = await query<{ id: string; name: string; email: string; password_hash: string }>(
      'SELECT id, name, email, password_hash FROM users WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      throw new AppError('Invalid email or password.', 401);
    }

    const user = userResult.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      throw new AppError('Invalid email or password.', 401);
    }

    // Fetch user profile
    const profileResult = await query<{ full_name: string; display_name: string | null; timezone: string }>(
      'SELECT full_name, display_name, timezone FROM profiles WHERE id = $1',
      [user.id]
    );

    const profile = profileResult.rows[0] ?? {
      full_name: user.name,
      display_name: user.name,
      timezone: 'UTC'
    };

    const token = this.generateToken({ id: user.id, email: user.email, name: user.name });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profile
      },
      token
    };
  }

  static async getCurrentUser(userId: string): Promise<UserDTO> {
    const userResult = await query<{ id: string; name: string; email: string }>(
      'SELECT id, name, email FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new AppError('User not found.', 404);
    }

    const user = userResult.rows[0];
    const profileResult = await query<{ full_name: string; display_name: string | null; timezone: string }>(
      'SELECT full_name, display_name, timezone FROM profiles WHERE id = $1',
      [user.id]
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      profile: profileResult.rows[0] ?? {
        full_name: user.name,
        display_name: user.name,
        timezone: 'UTC'
      }
    };
  }

  static async updateProfile(
    userId: string,
    profileData: { full_name?: string; display_name?: string | null; timezone?: string }
  ) {
    const existing = await query('SELECT id FROM profiles WHERE id = $1', [userId]);

    if (existing.rows.length > 0) {
      const result = await query(
        `UPDATE profiles
         SET full_name = COALESCE($2, full_name),
             display_name = COALESCE($3, display_name),
             timezone = COALESCE($4, timezone),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING full_name, display_name, timezone`,
        [userId, profileData.full_name, profileData.display_name, profileData.timezone]
      );
      return result.rows[0];
    } else {
      const result = await query(
        `INSERT INTO profiles (id, full_name, display_name, timezone)
         VALUES ($1, $2, $3, $4)
         RETURNING full_name, display_name, timezone`,
        [
          userId,
          profileData.full_name || '',
          profileData.display_name || null,
          profileData.timezone || 'UTC'
        ]
      );
      return result.rows[0];
    }
  }

  private static generateToken(user: { id: string; email: string; name: string }): string {
    return jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );
  }
}

