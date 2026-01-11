import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: './postcss.config.js',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
  build: {
    // 소스맵 비활성화 (프로덕션)
    sourcemap: false,
    // 최소화 설정
    minify: 'esbuild',
    // CSS 코드 스플리팅
    cssCodeSplit: true,
    // 타겟 브라우저
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          // React 관련 라이브러리
          'vendor-react': ['react', 'react-dom'],
          // 애니메이션 라이브러리
          'vendor-motion': ['motion'],
          // UI 컴포넌트 라이브러리
          'vendor-radix': [
            '@radix-ui/react-label',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
          ],
          // 드래그앤드롭
          'vendor-dnd': [
            '@dnd-kit/core',
            '@dnd-kit/sortable',
            '@dnd-kit/utilities',
          ],
          // 유틸리티 라이브러리
          'vendor-utils': ['axios', 'clsx', 'tailwind-merge', 'class-variance-authority'],
          // 아이콘 라이브러리
          'vendor-icons': ['lucide-react'],
        },
        // 에셋 파일명 최적화
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|webp|ico/i.test(ext)) {
            return 'assets/images/[name]-[hash][extname]';
          }
          if (/woff2?|ttf|eot/i.test(ext)) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
    chunkSizeWarningLimit: 500,
  },
  // 개발 서버 최적화
  server: {
    port: 3000,
    open: true,
    host: '0.0.0.0',
  },
  preview: {
    port: 80,
    host: '0.0.0.0',
  },
  // 의존성 사전 번들링 최적화
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'motion',
      'axios',
      'lucide-react',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
    ],
  },
});
