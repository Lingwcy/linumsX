import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../../src/domain/tools/registry';

describe('ToolRegistry', () => {
  describe('register', () => {
    it('should register and retrieve tools', () => {
      const registry = new ToolRegistry();

      const mockTool = {
        name: 'test_tool',
        description: 'A test tool',
        execute: async (params) => ({ success: true }),
        schema: { type: 'object' },
      };

      registry.register(mockTool);

      expect(registry.get('test_tool')).toEqual(mockTool);
    });

    it('should throw on duplicate registration', () => {
      const registry = new ToolRegistry();

      registry.register({
        name: 'duplicate_tool',
        description: 'A tool',
        execute: async () => ({ success: true }),
        schema: { type: 'object' },
      });

      expect(() => {
        registry.register({
          name: 'duplicate_tool',
          description: 'Another tool',
          execute: async () => ({ success: true }),
          schema: { type: 'object' },
        });
      }).toThrow('Tool duplicate_tool already registered');
    });
  });

  describe('get', () => {
    it('should return undefined for non-existent tool', () => {
      const registry = new ToolRegistry();
      expect(registry.get('non_existent')).toBeUndefined();
    });
  });

  describe('execute', () => {
    it('should execute registered tool', async () => {
      const registry = new ToolRegistry();

      registry.register({
        name: 'echo',
        description: 'Echo tool',
        execute: async (params) => ({ success: true, data: params }),
        schema: { type: 'object' },
      });

      const result = await registry.execute('echo', { message: 'hello' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ message: 'hello' });
    });

    it('should return error for non-existent tool', async () => {
      const registry = new ToolRegistry();

      const result = await registry.execute('non_existent', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tool non_existent not found');
    });
  });

  describe('getAllDescriptions', () => {
    it('should return all tool descriptions', () => {
      const registry = new ToolRegistry();
      registry.register({
        name: 'tool1',
        description: 'Tool 1',
        execute: async () => ({}),
        schema: { type: 'object' },
      });

      const descriptions = registry.getAllDescriptions();
      expect(descriptions).toHaveLength(1);
      expect(descriptions[0].name).toBe('tool1');
    });

    it('should return empty array when no tools registered', () => {
      const registry = new ToolRegistry();
      expect(registry.getAllDescriptions()).toEqual([]);
    });
  });
});
