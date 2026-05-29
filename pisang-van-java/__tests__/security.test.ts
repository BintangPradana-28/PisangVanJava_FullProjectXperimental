import { z } from 'zod';
import { loginSchema } from '@/src/features/auth/schemas';

describe('Security & Validation Tests', () => {
  describe('Authentication Schema', () => {
    it('should reject SQL Injection payloads in login form', () => {
      const payload = {
        username: "admin' OR '1'='1",
        password: "password123"
      };
      
      const result = loginSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject extremely long passwords (DoS prevention)', () => {
      // Passwords over 100 characters should be rejected before hashing
      // according to our Zod schema
      const payload = {
        username: "test@example.com",
        password: "a".repeat(150)
      };
      
      const result = loginSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should accept valid credentials format', () => {
      const payload = {
        username: "user@example.com",
        password: "SecurePassword123!"
      };
      
      const result = loginSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });
});
