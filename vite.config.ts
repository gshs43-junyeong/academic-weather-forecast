import { defineConfig } from 'vite';
// 정적 사이트. 공개 애셋은 public(weather, video)만 포함된다. 키트의 assets·docs는 빌드에 들어가지 않는다.
export default defineConfig({
  publicDir: 'public',
  build: { outDir: 'dist', target: 'es2022' },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
} as any);
