import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import obfuscatorPlugin from 'rollup-plugin-obfuscator'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    rollupOptions: {
      plugins: [
        obfuscatorPlugin({
          include: ['src/**/*.js', 'src/**/*.jsx'],
          exclude: ['node_modules/**'],
          options: {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.5,
            deadCodeInjection: false,
            identifierNamesGenerator: 'hexadecimal',
            splitStrings: true,
            splitStringsChunkLength: 5,
            stringArray: true,
            stringArrayEncoding: ['base64'],
            stringArrayThreshold: 0.75,
            transformObjectKeys: false,
            unicodeEscapeSequence: false,
          },
        }),
      ],
    },
  },
  server: {
    port: 3000
  }
})
